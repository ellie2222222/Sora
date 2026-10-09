import { Inject, Injectable, Logger } from '@nestjs/common';
import argon2 from 'argon2';
import { OAuth2Client } from 'google-auth-library';
import type { Transaction } from 'kysely';
import { randomUUID } from 'node:crypto';

import { STARTER_CASH_ACCOUNT_NAME, STARTER_CATEGORIES, isLocale, starterWalletName, type Locale } from '@sora/contracts';
import type {
  AuthResponse,
  AuthTokens,
  GoogleAuthRequest,
  LoginRequest,
  RefreshRequest,
  RegisterRequest,
  UpdatePreferencesRequest,
  UserResponse,
} from '@sora/contracts';

import { AUDIT_EVENTS, ENTITY_TYPES } from '../audit/audit-events.ts';
import { AuditService } from '../audit/audit.service.ts';
import { AppError } from '../common/app-error.ts';
import type { AuthenticatedUser } from '../common/decorators.ts';
import { isUniqueViolation, rethrowPgError, translatingPgErrors } from '../common/pg-error.ts';
import { RateLimitService } from '../common/rate-limit.service.ts';
import { CONFIG, type AppConfig } from '../config/env.ts';
import { DatabaseService } from '../database/database.service.ts';
import type { DB } from '../database/types.ts';
import { TokenService } from './token.service.ts';

/**
 * Argon2id parameters: the OWASP Password Storage Cheat Sheet's recommended
 * Argon2id baseline (19 MiB, 2 iterations, 1 lane).
 */
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

/** Base currency for an account with no explicit preference (Google sign-up supplies none). */
const DEFAULT_CURRENCY = 'VND';

interface GoogleIdentity {
  googleId: string;
  email: string;
  displayName: string;
}

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  base_currency: string;
  theme: string;
  locale: string;
  password_hash: string | null;
  created_at: Date;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly googleClient: OAuth2Client;

  /**
   * A real Argon2id hash no password will ever match, verified against when the
   * email is unknown. Without it "no such user" answers in microseconds while
   * "wrong password" takes ~50ms, and that difference enumerates accounts just
   * as effectively as a distinguishable response body would.
   */
  private decoyHash: Promise<string> | null = null;

  constructor(
    @Inject(CONFIG) private readonly config: AppConfig,
    private readonly database: DatabaseService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
    private readonly rateLimit: RateLimitService,
  ) {
    // No client_id: verifyIdToken (below) takes its own explicit `audience` list instead.
    this.googleClient = new OAuth2Client();
  }

  /**
   * Register, seed and sign in — all in one transaction.
   *
   * A user with no wallet cannot record anything, so registration that created
   * only the users row would strand them on a screen with nothing to write to.
   * The wallet, its OWNER membership, starter categories and default account
   * therefore commit with the user or not at all.
   */
  async register(request: RegisterRequest, ip: string | null): Promise<AuthResponse> {
    const passwordHash = await argon2.hash(request.password, ARGON2_OPTIONS);

    const created = await translatingPgErrors(() =>
      this.database.db.transaction().execute(async (trx) => {
        const user = await trx
          .insertInto('users')
          .values({
            email: request.email,
            password_hash: passwordHash,
            display_name: request.displayName,
            base_currency: request.baseCurrency,
            ...(request.locale ? { locale: request.locale } : {}),
          })
          .returning(USER_COLUMNS)
          .executeTakeFirstOrThrow();

        const { walletId } = await this.seedWallet(
          trx,
          user.id,
          user.display_name,
          user.base_currency,
          request.timeZone,
          user.locale,
        );
        const refresh = await this.tokens.issueRefreshToken(user.id, trx);

        await this.audit.record(
          {
            event: AUDIT_EVENTS.USER_REGISTERED,
            entityType: ENTITY_TYPES.USER,
            entityId: user.id,
            actorId: user.id,
            walletId,
            ip,
          },
          trx,
        );

        return { user, refreshToken: refresh.token };
      }),
    );

    return {
      user: toUserResponse(created.user),
      tokens: this.tokenPair(identityOf(created.user), created.refreshToken),
    };
  }

  /**
   * Identical failure for an unknown email and a wrong password: both paths run
   * an Argon2 verify and both raise the same CREDENTIALS_INVALID, so neither the
   * body nor the timing reveals whether an address is registered.
   */
  async login(request: LoginRequest, ip: string | null): Promise<AuthResponse> {
    const lockout = this.rateLimit.beginLoginAttempt(
      request.email,
      this.config.LOGIN_FAILURE_LIMIT,
      this.config.LOGIN_LOCKOUT_MINUTES * 60 * 1000,
    );
    if (!lockout.allowed) {
      throw new AppError(
        'RATE_LIMITED',
        `Too many failed sign-in attempts. Try again in ${lockout.retryAfterSeconds}s`,
        undefined,
        undefined,
        { retryAfterSeconds: lockout.retryAfterSeconds },
      );
    }

    const user = await this.database.db
      .selectFrom('users')
      .select(USER_COLUMNS)
      .where((eb) => eb(eb.fn('lower', ['email']), '=', request.email.toLowerCase()))
      .executeTakeFirst();

    // A Google-only user has no password_hash at all; that must fail the same
    // way a wrong password would, not throw out of argon2.verify(null, ...).
    const valid =
      user?.password_hash != null
        ? await argon2.verify(user.password_hash, request.password).catch(() => false)
        : await this.burnTime(request.password);

    if (!user || !valid) {
      await this.audit.record({
        event: AUDIT_EVENTS.USER_LOGIN,
        entityType: ENTITY_TYPES.USER,
        entityId: user?.id ?? null,
        actorId: user?.id ?? null,
        result: 'DENIED',
        note: `Failed sign-in for ${request.email}`,
        ip,
      });
      throw new AppError('CREDENTIALS_INVALID');
    }

    this.rateLimit.recordLoginSuccess(request.email);

    const refresh = await this.tokens.issueRefreshToken(user.id);
    await this.audit.record({
      event: AUDIT_EVENTS.USER_LOGIN,
      entityType: ENTITY_TYPES.USER,
      entityId: user.id,
      actorId: user.id,
      result: 'SUCCESS',
      ip,
    });

    return {
      user: toUserResponse(user),
      tokens: this.tokenPair(identityOf(user), refresh.token),
    };
  }

  /**
   * Verifies the ID token against Google's own signing keys (never the app's
   * own decoding of the JWT) and checks `aud` against GOOGLE_CLIENT_ID, so a
   * token minted for a different client cannot be replayed here.
   *
   * Three outcomes: the Google account is already linked (login), an existing
   * password-based account shares that verified email (link + login, so a
   * person who registered with a password and later taps "Sign in with
   * Google" keeps one account and one set of wallets), or neither (register +
   * seed, same as POST /auth/register).
   */
  async loginWithGoogle(request: GoogleAuthRequest, ip: string | null): Promise<AuthResponse> {
    const payload = await this.verifyGoogleIdToken(request.idToken);

    // Two first sign-ins for one Google account both miss the lookups and both insert; the loser's
    // unique violation means the user now exists, so one retry finds it and signs in instead.
    const result = await this.resolveGoogleUser(payload, request)
      .catch((error: unknown) => {
        if (!isUniqueViolation(error, ['uq_users_email', 'uq_users_google_id'])) throw error;
        return this.resolveGoogleUser(payload, request);
      })
      .catch((error: unknown) => rethrowPgError(error));

    const refresh = await this.tokens.issueRefreshToken(result.user.id);
    await this.audit.record({
      event: result.event,
      entityType: ENTITY_TYPES.USER,
      entityId: result.user.id,
      actorId: result.user.id,
      result: 'SUCCESS',
      note: result.isNew ? 'Registered via Google' : 'Signed in via Google',
      ip,
    });

    return {
      user: toUserResponse(result.user),
      tokens: this.tokenPair(identityOf(result.user), refresh.token),
    };
  }

  private resolveGoogleUser(payload: GoogleIdentity, request: GoogleAuthRequest) {
    return this.database.db.transaction().execute(async (trx) => {
      const byGoogleId = await trx
        .selectFrom('users')
        .select(USER_COLUMNS)
        .where('google_id', '=', payload.googleId)
        .executeTakeFirst();

      if (byGoogleId) return { user: byGoogleId, event: AUDIT_EVENTS.USER_LOGIN, isNew: false };

      const byEmail = await trx
        .selectFrom('users')
        .select('id')
        .where((eb) => eb(eb.fn('lower', ['email']), '=', payload.email.toLowerCase()))
        .executeTakeFirst();

      if (byEmail) {
        // A verified email proves who owns the address, not that this Google account should replace
        // the one already linked. Conditional, so a concurrent link by another Google account can't win
        // either, while a concurrent sign-in by this same one still matches.
        const linked = await trx
          .updateTable('users')
          .set({ google_id: payload.googleId })
          .where('id', '=', byEmail.id)
          .where((eb) => eb.or([eb('google_id', 'is', null), eb('google_id', '=', payload.googleId)]))
          .returning(USER_COLUMNS)
          .executeTakeFirst();
        if (!linked) throw new AppError('GOOGLE_ACCOUNT_MISMATCH');
        return { user: linked, event: AUDIT_EVENTS.USER_LOGIN, isNew: false };
      }

      const created = await trx
        .insertInto('users')
        .values({
          email: payload.email,
          google_id: payload.googleId,
          password_hash: null,
          display_name: payload.displayName,
          base_currency: DEFAULT_CURRENCY,
          ...(request.locale ? { locale: request.locale } : {}),
        })
        .returning(USER_COLUMNS)
        .executeTakeFirstOrThrow();

      await this.seedWallet(
        trx,
        created.id,
        created.display_name,
        created.base_currency,
        request.timeZone,
        created.locale,
      );
      return { user: created, event: AUDIT_EVENTS.USER_REGISTERED, isNew: true };
    });
  }

  /**
   * Rotation, with replay detection.
   *
   * A token that is present but already revoked has been used twice. There is no
   * way to tell the legitimate holder from whoever copied it, so the whole
   * family is revoked and the event audited rather than serving the replay.
   */
  async refresh(request: RefreshRequest, ip: string | null): Promise<AuthTokens> {
    const tokenHash = this.tokens.hashToken(request.refreshToken);

    const stored = await this.database.db
      .selectFrom('refresh_tokens')
      .innerJoin('users', 'users.id', 'refresh_tokens.user_id')
      .select([
        'refresh_tokens.id as token_id',
        'refresh_tokens.expires_at as expires_at',
        'refresh_tokens.revoked_at as revoked_at',
        'users.id as user_id',
        'users.email as email',
        'users.display_name as display_name',
      ])
      .where('refresh_tokens.token_hash', '=', tokenHash)
      .executeTakeFirst();

    if (!stored) throw new AppError('TOKEN_INVALID');

    if (stored.revoked_at !== null) return this.rejectReplay(stored.user_id, stored.token_id, ip);

    if (stored.expires_at.getTime() <= Date.now()) throw new AppError('TOKEN_EXPIRED');

    const rotated = await this.database.db.transaction().execute(async (trx) => {
      const spent = await this.tokens.revokeToken(tokenHash, stored.user_id, trx);
      return spent ? this.tokens.issueRefreshToken(stored.user_id, trx) : null;
    });
    // Another request spent this token between the read above and the revoke.
    if (rotated === null) return this.rejectReplay(stored.user_id, stored.token_id, ip);

    await this.audit.record({
      event: AUDIT_EVENTS.TOKEN_REFRESHED,
      entityType: ENTITY_TYPES.SESSION,
      entityId: stored.token_id,
      actorId: stored.user_id,
      ip,
    });

    return this.tokenPair(
      { id: stored.user_id, email: stored.email, displayName: stored.display_name },
      rotated.token,
    );
  }

  private async rejectReplay(userId: string, tokenId: string, ip: string | null): Promise<never> {
    const revoked = await this.tokens.revokeFamily(userId);
    this.logger.warn(`Refresh token replay for user=${userId}; revoked ${revoked} live token(s)`);
    await this.audit.record({
      event: AUDIT_EVENTS.TOKEN_REPLAY_DETECTED,
      entityType: ENTITY_TYPES.SESSION,
      entityId: tokenId,
      actorId: userId,
      result: 'DENIED',
      note: `Replayed refresh token; revoked ${revoked} live token(s) for this user`,
      ip,
    });
    throw new AppError('TOKEN_INVALID');
  }

  /** Idempotent: logging out twice still succeeds. */
  async logout(
    user: AuthenticatedUser,
    refreshToken: string | undefined,
    ip: string | null,
  ): Promise<void> {
    if (refreshToken) await this.tokens.revokeToken(this.tokens.hashToken(refreshToken), user.id);
    else await this.tokens.revokeFamily(user.id);

    await this.audit.record({
      event: AUDIT_EVENTS.USER_LOGOUT,
      entityType: ENTITY_TYPES.SESSION,
      actorId: user.id,
      ip,
    });
  }

  async me(user: AuthenticatedUser): Promise<UserResponse> {
    const row = await this.database.db
      .selectFrom('users')
      .select(USER_COLUMNS)
      .where('id', '=', user.id)
      .executeTakeFirst();

    // The token verified, so the account existed when it was minted; a missing
    // row means it was deleted mid-session, which is not authenticated.
    if (!row) throw new AppError('UNAUTHENTICATED');

    return toUserResponse(row);
  }

  /** Theme and locale are stored server-side (not just on-device) so a returning user on a new device sees the same choices. */
  async updatePreferences(
    user: AuthenticatedUser,
    request: UpdatePreferencesRequest,
  ): Promise<UserResponse> {
    const row = await this.database.db
      .updateTable('users')
      .set({
        ...(request.theme ? { theme: request.theme } : {}),
        ...(request.locale ? { locale: request.locale } : {}),
      })
      .where('id', '=', user.id)
      .returning(USER_COLUMNS)
      .executeTakeFirst();

    if (!row) throw new AppError('UNAUTHENTICATED');
    return toUserResponse(row);
  }

  /**
   * The wallet, its OWNER membership, starter categories and one default CASH
   * account — the seeding every new person needs before they can record
   * anything, shared by password registration and a first Google sign-in so
   * the two paths cannot drift apart.
   */
  private async seedWallet(
    trx: Transaction<DB>,
    userId: string,
    displayName: string,
    currency: string,
    timeZone: string,
    locale?: string,
  ): Promise<{ walletId: string }> {
    const seedLocale: Locale = locale !== undefined && isLocale(locale) ? locale : 'en';
    const walletName = starterWalletName(displayName, seedLocale);
    const accountName = STARTER_CASH_ACCOUNT_NAME[seedLocale];

    const wallet = await trx
      .insertInto('wallets')
      .values({ owner_user_id: userId, name: walletName, time_zone: timeZone })
      .returning(['id'])
      .executeTakeFirstOrThrow();

    await trx
      .insertInto('wallet_members')
      .values({ wallet_id: wallet.id, user_id: userId, role: 'OWNER' })
      .execute();

    await trx
      .insertInto('categories')
      .values(
        STARTER_CATEGORIES.map((category) => ({
          wallet_id: wallet.id,
          system_key: category.key,
          name: category.names.en,
          type: category.type,
          icon: category.icon,
          color: category.color,
        })),
      )
      .execute();

    await trx
      .insertInto('accounts')
      .values({
        wallet_id: wallet.id,
        name: accountName,
        type: 'CASH',
        currency,
        initial_balance: '0',
      })
      .execute();

    return { walletId: wallet.id };
  }

  private async verifyGoogleIdToken(
    idToken: string,
  ): Promise<GoogleIdentity> {
    let payload: import('google-auth-library').TokenPayload | undefined;
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: this.config.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (error) {
      this.logger.warn(`Google ID token verification failed: ${(error as Error).message}`);
      throw new AppError('GOOGLE_TOKEN_INVALID');
    }

    if (!payload?.email || payload.email_verified !== true || !payload.sub) {
      throw new AppError('GOOGLE_TOKEN_INVALID');
    }

    return {
      googleId: payload.sub,
      email: payload.email.toLowerCase(),
      displayName: payload.name ?? payload.email.split('@')[0] ?? `user-${randomUUID().slice(0, 8)}`,
    };
  }

  private tokenPair(user: AuthenticatedUser, refreshToken: string): AuthTokens {
    return {
      accessToken: this.tokens.signAccessToken(user),
      refreshToken,
      expiresIn: this.tokens.accessTokenTtlSeconds,
    };
  }

  private async burnTime(password: string): Promise<false> {
    this.decoyHash ??= argon2.hash(this.tokens.newOpaqueToken(), ARGON2_OPTIONS);
    await argon2.verify(await this.decoyHash, password).catch(() => false);
    return false;
  }
}

const USER_COLUMNS = [
  'id',
  'email',
  'display_name',
  'base_currency',
  'theme',
  'locale',
  'password_hash',
  'created_at',
] as const;

function toUserResponse(row: UserRow): UserResponse {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    baseCurrency: row.base_currency,
    theme: row.theme as UserResponse['theme'],
    locale: row.locale as UserResponse['locale'],
    hasPassword: row.password_hash != null,
    createdAt: row.created_at.toISOString(),
  };
}

function identityOf(row: UserRow): AuthenticatedUser {
  return { id: row.id, email: row.email, displayName: row.display_name };
}
