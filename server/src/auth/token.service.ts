/**
 * Token minting, hashing and storage.
 *
 * Only the SHA-256 hash of a refresh token is ever stored, so a database read —
 * a leaked backup, a SQL injection, an over-broad support query — cannot mint a
 * session. SHA-256 rather than Argon2 here on purpose: a refresh token is 384
 * bits of CSPRNG output, so there is no dictionary to slow down, and the hash is
 * on the hot path of every refresh.
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import type { Kysely, Transaction } from 'kysely';

import { CONFIG, type AppConfig } from '../config/env.ts';
import { AppError } from '../common/app-error.ts';
import type { AuthenticatedUser } from '../common/decorators.ts';
import { DatabaseService } from '../database/database.service.ts';
import type { DB } from '../database/types.ts';

type Executor = Kysely<DB> | Transaction<DB>;

interface AccessTokenClaims {
  sub: string;
  email: string;
  name: string;
}

export interface IssuedRefreshToken {
  token: string;
  expiresAt: Date;
}

@Injectable()
export class TokenService {
  constructor(
    @Inject(CONFIG) private readonly config: AppConfig,
    private readonly database: DatabaseService,
  ) {}

  get accessTokenTtlSeconds(): number {
    return this.config.ACCESS_TOKEN_TTL_SECONDS;
  }

  signAccessToken(user: AuthenticatedUser): string {
    const claims: AccessTokenClaims = {
      sub: user.id,
      email: user.email,
      name: user.displayName,
    };

    return jwt.sign(claims, this.config.JWT_SECRET, {
      algorithm: 'HS256',
      issuer: this.config.JWT_ISSUER,
      expiresIn: this.config.ACCESS_TOKEN_TTL_SECONDS,
    });
  }

  /**
   * Verify an access token.
   *
   * `algorithms` is pinned: without it a token could name its own algorithm and
   * `alg: none` would verify against any secret.
   */
  verifyAccessToken(token: string): AuthenticatedUser {
    try {
      const claims = jwt.verify(token, this.config.JWT_SECRET, {
        algorithms: ['HS256'],
        issuer: this.config.JWT_ISSUER,
      }) as AccessTokenClaims;

      return { id: claims.sub, email: claims.email, displayName: claims.name };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) throw new AppError('TOKEN_EXPIRED');
      throw new AppError('TOKEN_INVALID');
    }
  }

  hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  /** Constant-time comparison, for anywhere a hash is checked outside the database. */
  hashesMatch(a: string, b: string): boolean {
    const left = Buffer.from(a, 'utf8');
    const right = Buffer.from(b, 'utf8');
    return left.length === right.length && timingSafeEqual(left, right);
  }

  newOpaqueToken(): string {
    return randomBytes(48).toString('base64url');
  }

  async issueRefreshToken(userId: string, executor?: Executor): Promise<IssuedRefreshToken> {
    const db = executor ?? this.database.db;
    const token = this.newOpaqueToken();
    const expiresAt = new Date(
      Date.now() + this.config.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    await db
      .insertInto('refresh_tokens')
      .values({ user_id: userId, token_hash: this.hashToken(token), expires_at: expiresAt })
      .execute();

    return { token, expiresAt };
  }

  async revokeToken(tokenHash: string, executor?: Executor): Promise<void> {
    const db = executor ?? this.database.db;
    await db
      .updateTable('refresh_tokens')
      .set({ revoked_at: new Date() })
      .where('token_hash', '=', tokenHash)
      .where('revoked_at', 'is', null)
      .execute();
  }

  /**
   * Revoke every live refresh token for a user.
   *
   * The response to a replayed token: one presentation of an already-revoked
   * token means a copy of it exists somewhere it should not, and there is no way
   * to tell the thief's request from the victim's, so every session ends.
   */
  async revokeFamily(userId: string, executor?: Executor): Promise<number> {
    const db = executor ?? this.database.db;
    const result = await db
      .updateTable('refresh_tokens')
      .set({ revoked_at: new Date() })
      .where('user_id', '=', userId)
      .where('revoked_at', 'is', null)
      .executeTakeFirst();

    return Number(result.numUpdatedRows ?? 0n);
  }
}
