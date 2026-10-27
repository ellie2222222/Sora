import { Inject, Injectable } from '@nestjs/common';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { sql } from 'kysely';

import { EMAIL_VERIFICATION_CODE_LENGTH, isLocale, type EmailVerificationSentResponse, type UserResponse } from '@sora/contracts';

import { AUDIT_EVENTS, ENTITY_TYPES } from '../audit/audit-events.ts';
import { AuditService } from '../audit/audit.service.ts';
import { AppError } from '../common/app-error.ts';
import type { AuthenticatedUser } from '../common/decorators.ts';
import { CONFIG, type AppConfig } from '../config/env.ts';
import { DatabaseService } from '../database/database.service.ts';
import { MailService } from '../mail/mail.service.ts';
import { verificationEmail } from '../mail/verification-email.ts';
import { AuthService } from './auth.service.ts';

/** Matches `chk_email_verification_attempts`: one code survives five guesses, a one-in-200,000 chance. */
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60_000;
/** Matches `chk_email_verification_sends`. */
const MAX_SENDS_PER_WINDOW = 5;
const SEND_WINDOW_MS = 24 * 60 * 60_000;

@Injectable()
export class EmailVerificationService {
  constructor(
    @Inject(CONFIG) private readonly config: AppConfig,
    private readonly database: DatabaseService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
  ) {}

  async send(user: AuthenticatedUser): Promise<EmailVerificationSentResponse> {
    const account = await this.database.db
      .selectFrom('users')
      .select(['email', 'locale', 'email_verified_at'])
      .where('id', '=', user.id)
      .executeTakeFirst();
    if (!account) throw new AppError('UNAUTHENTICATED');
    if (account.email_verified_at !== null) throw new AppError('EMAIL_ALREADY_VERIFIED');
    if (!this.mail.canDeliver) throw new AppError('EMAIL_DELIVERY_UNAVAILABLE');

    const now = new Date();
    const code = String(randomInt(0, 10 ** EMAIL_VERIFICATION_CODE_LENGTH)).padStart(EMAIL_VERIFICATION_CODE_LENGTH, '0');
    const codeHash = this.hash(user.id, code);
    const expiresAt = new Date(now.getTime() + this.config.EMAIL_VERIFICATION_TTL_MINUTES * 60_000);
    const cooldownOver = new Date(now.getTime() - RESEND_COOLDOWN_MS);
    const windowOver = new Date(now.getTime() - SEND_WINDOW_MS);
    // One statement, so concurrent sends queue on the row and see each other's send and count.
    const stored = await this.database.db
      .insertInto('email_verifications')
      .values({
        user_id: user.id,
        email: account.email,
        code_hash: codeHash,
        attempts: 0,
        expires_at: expiresAt,
        sent_at: now,
        window_started_at: now,
        sends_in_window: 1,
      })
      .onConflict((conflict) =>
        conflict
          .column('user_id')
          .doUpdateSet((eb) => ({
            email: eb.ref('excluded.email'),
            code_hash: eb.ref('excluded.code_hash'),
            attempts: 0,
            expires_at: eb.ref('excluded.expires_at'),
            sent_at: eb.ref('excluded.sent_at'),
            window_started_at: sql<Date>`CASE WHEN email_verifications.window_started_at <= ${windowOver}
              THEN excluded.window_started_at ELSE email_verifications.window_started_at END`,
            sends_in_window: sql<number>`CASE WHEN email_verifications.window_started_at <= ${windowOver}
              THEN 1 ELSE email_verifications.sends_in_window + 1 END`,
          }))
          .where('email_verifications.sent_at', '<=', cooldownOver)
          .where((eb) =>
            eb.or([
              eb('email_verifications.window_started_at', '<=', windowOver),
              eb('email_verifications.sends_in_window', '<', MAX_SENDS_PER_WINDOW),
            ]),
          ),
      )
      .returning(['window_started_at', 'sends_in_window'])
      .executeTakeFirst();
    if (!stored) throw await this.sendRefusal(user.id, now);

    try {
      const locale = isLocale(account.locale) ? account.locale : 'en';
      await this.mail.send(verificationEmail(account.email, locale, code, this.config.EMAIL_VERIFICATION_TTL_MINUTES));
    } catch (error) {
      // Undelivered, so neither the minute's wait nor the day's count holds back the retry.
      await this.database.db
        .deleteFrom('email_verifications')
        .where('user_id', '=', user.id)
        .where('code_hash', '=', codeHash)
        .execute();
      throw error;
    }

    return {
      email: account.email,
      expiresAt: expiresAt.toISOString(),
      resendAfter: nextSendAt(now, stored).toISOString(),
    };
  }

  async confirm(user: AuthenticatedUser, code: string, ip: string | null): Promise<UserResponse> {
    const account = await this.database.db
      .selectFrom('users')
      .select(['email', 'email_verified_at'])
      .where('id', '=', user.id)
      .executeTakeFirst();
    if (!account) throw new AppError('UNAUTHENTICATED');
    if (account.email_verified_at !== null) throw new AppError('EMAIL_ALREADY_VERIFIED');

    // Claiming the attempt before comparing makes parallel guesses queue on the row instead of
    // each comparing against the same untouched count.
    const claimed = await this.database.db
      .updateTable('email_verifications')
      .set({ attempts: sql<number>`attempts + 1` })
      .where('user_id', '=', user.id)
      .where('attempts', '<', MAX_ATTEMPTS)
      .where('expires_at', '>', new Date())
      .returning(['code_hash', 'email'])
      .executeTakeFirst();
    if (!claimed || claimed.email !== account.email) throw new AppError('EMAIL_VERIFICATION_EXPIRED');

    const expected = Buffer.from(claimed.code_hash, 'hex');
    const given = Buffer.from(this.hash(user.id, code), 'hex');
    if (!timingSafeEqual(expected, given)) throw new AppError('EMAIL_VERIFICATION_CODE_INVALID');

    await this.database.db.transaction().execute(async (trx) => {
      const verified = await trx
        .updateTable('users')
        .set({ email_verified_at: new Date() })
        .where('id', '=', user.id)
        .where('email', '=', claimed.email)
        .where('email_verified_at', 'is', null)
        .executeTakeFirst();
      // A parallel confirm with the same code already verified, deleted the code and audited it.
      if (verified.numUpdatedRows === 0n) return;
      await trx.deleteFrom('email_verifications').where('user_id', '=', user.id).execute();
      await this.audit.record(
        {
          event: AUDIT_EVENTS.EMAIL_VERIFIED,
          entityType: ENTITY_TYPES.USER,
          entityId: user.id,
          actorId: user.id,
          note: 'Verified by emailed code',
          ip,
        },
        trx,
      );
    });

    return this.auth.me(user);
  }

  /** Keyed, because a bare hash of six digits is reversed by trying all million of them. */
  private hash(userId: string, code: string): string {
    return createHmac('sha256', this.config.JWT_SECRET).update(`email-verification:${userId}:${code}`).digest('hex');
  }

  private async sendRefusal(userId: string, now: Date): Promise<AppError> {
    const held = await this.database.db
      .selectFrom('email_verifications')
      .select(['sent_at', 'window_started_at', 'sends_in_window'])
      .where('user_id', '=', userId)
      .executeTakeFirst();
    // Gone between the upsert and this read (a parallel confirm used it, or its mail failed): a retry gets the real answer.
    const waitMs = held ? nextSendAt(held.sent_at, held).getTime() - now.getTime() : 1000;
    const capped =
      held !== undefined &&
      held.sends_in_window >= MAX_SENDS_PER_WINDOW &&
      held.window_started_at.getTime() + SEND_WINDOW_MS > now.getTime();
    return new AppError('RATE_LIMITED', capped ? 'Too many codes sent today' : 'A code was sent a moment ago', undefined, undefined, {
      retryAfterSeconds: Math.max(1, Math.ceil(waitMs / 1000)),
    });
  }
}

/** When the account may be sent another code: a minute after the last send, or when a full day's window ends. */
function nextSendAt(lastSentAt: Date, window: { window_started_at: Date; sends_in_window: number }): Date {
  const cooldownEnds = lastSentAt.getTime() + RESEND_COOLDOWN_MS;
  const windowEnds = window.window_started_at.getTime() + SEND_WINDOW_MS;
  return new Date(window.sends_in_window >= MAX_SENDS_PER_WINDOW ? Math.max(cooldownEnds, windowEnds) : cooldownEnds);
}
