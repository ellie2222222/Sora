/**
 * Optional `Idempotency-Key` replay protection (§2.10).
 *
 * The case this exists for is a mobile client retrying a transaction create over
 * a flaky connection, where a duplicate is a real financial error rather than a
 * cosmetic one. A replay with the same key *and* the same body returns the
 * stored response; the same key with a different body is rejected, because
 * silently serving the first response for a second, different request would hide
 * a client bug behind a success.
 *
 * The key is claimed in `idempotency_keys` when the first attempt starts, not when it
 * finishes: a retry that arrives while that attempt is still running waits for it rather
 * than running a second write. Kept in the database, so a retry is still recognised after
 * a restart or by another API process.
 */

import { createHash } from 'node:crypto';
import {
  Injectable,
  Logger,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { sql } from 'kysely';
import { catchError, defer, from, mergeMap, of, throwError, type Observable } from 'rxjs';
import type { Request } from 'express';

import { DatabaseService } from '../database/database.service.ts';
import { AppError } from './app-error.ts';

const MUTATING = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);
const MAX_KEY_LENGTH = 255;
// A write the app sent but never heard back from is queued and replayed once the API is back, possibly
// after a long outage and a fresh sign-in (refresh tokens last 7 days), and must still be recognised then.
export const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
/**
 * A claim whose attempt has been running this long belongs to one that died (a crash, a deploy):
 * every statement is cut off at DATABASE_STATEMENT_TIMEOUT_MS, so a live write ends well before.
 */
export const ABANDONED_MS = 2 * 60 * 1000;
/** How long a retry waits on a first attempt still in flight before answering IDEMPOTENCY_KEY_IN_USE. */
const WAIT_MS = 30 * 1000;
const POLL_MS = 100;
const PURGE_EVERY_MS = 60 * 60 * 1000;

export interface StoredClaim {
  fingerprint: string;
  response: unknown;
  completedAt: Date | null;
  claimedAt: Date;
  createdAt: Date;
}

export type ReplayDecision =
  | { kind: 'replay'; response: unknown }
  | { kind: 'mismatch' }
  | { kind: 'wait' }
  | { kind: 'take-over-expired' }
  | { kind: 'take-over-abandoned' };

/** What a request carrying an already-claimed key gets, judged on the stored claim alone. */
export function decideReplay(stored: StoredClaim, fingerprint: string, now: number): ReplayDecision {
  // Past retention the key is free again: whatever this request is, it is a new one.
  if (now - stored.createdAt.getTime() >= RETENTION_MS) return { kind: 'take-over-expired' };
  if (stored.fingerprint !== fingerprint) return { kind: 'mismatch' };
  if (stored.completedAt !== null) return { kind: 'replay', response: stored.response };
  if (now - stored.claimedAt.getTime() >= ABANDONED_MS) return { kind: 'take-over-abandoned' };
  return { kind: 'wait' };
}

type Claim = { kind: 'run'; claimId: string } | { kind: 'replay'; response: unknown };

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);
  private nextPurgeAt = 0;

  constructor(private readonly database: DatabaseService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request & { user?: { id: string } }>();
    const key = request.header('Idempotency-Key');
    const userId = request.user?.id;

    // A key is scoped to its user; a public route (register, login) has none to scope it to.
    if (!key || !MUTATING.has(request.method) || !userId) return next.handle();
    if (key.length > MAX_KEY_LENGTH) {
      throw new AppError('VALIDATION_FAILED', `An Idempotency-Key is at most ${MAX_KEY_LENGTH} characters`);
    }

    const fingerprint = fingerprintOf(request);
    return defer(() => this.claim(userId, key, fingerprint)).pipe(
      mergeMap((claim) => (claim.kind === 'replay' ? of(claim.response) : this.run(next, claim.claimId))),
    );
  }

  private run(next: CallHandler, claimId: string): Observable<unknown> {
    return next.handle().pipe(
      mergeMap(async (response) => {
        await this.complete(claimId, response);
        return response;
      }),
      // A failed attempt is forgotten, so the client's retry runs again rather than replaying the error.
      catchError((error: unknown) => from(this.release(claimId)).pipe(mergeMap(() => throwError(() => error)))),
    );
  }

  private async claim(userId: string, key: string, fingerprint: string): Promise<Claim> {
    this.purgeExpiredSometimes();
    const db = this.database.db;
    const deadline = Date.now() + WAIT_MS;

    for (;;) {
      const claimed = await db
        .insertInto('idempotency_keys')
        .values({ user_id: userId, idempotency_key: key, fingerprint })
        .onConflict((conflict) => conflict.columns(['user_id', 'idempotency_key']).doNothing())
        .returning('id')
        .executeTakeFirst();
      if (claimed) return { kind: 'run', claimId: claimed.id };

      const stored = await db
        .selectFrom('idempotency_keys')
        .select(['id', 'fingerprint', 'response', 'completed_at', 'claimed_at', 'created_at'])
        .where('user_id', '=', userId)
        .where('idempotency_key', '=', key)
        .executeTakeFirst();
      // Released by a failed attempt between the insert and this read: claim it afresh.
      if (!stored) continue;

      const decision = decideReplay(
        {
          fingerprint: stored.fingerprint,
          response: stored.response,
          completedAt: stored.completed_at,
          claimedAt: stored.claimed_at,
          createdAt: stored.created_at,
        },
        fingerprint,
        Date.now(),
      );

      switch (decision.kind) {
        case 'replay':
          return { kind: 'replay', response: decision.response };
        case 'mismatch':
          throw new AppError('VALIDATION_FAILED', 'This Idempotency-Key was already used with a different request body');
        case 'take-over-expired':
        case 'take-over-abandoned': {
          // Re-checked in the UPDATE itself, so of two requests racing for the same stale claim only one wins it.
          const stale =
            decision.kind === 'take-over-expired'
              ? sql<boolean>`created_at < now() - make_interval(secs => ${RETENTION_MS / 1000})`
              : sql<boolean>`completed_at IS NULL AND claimed_at < now() - make_interval(secs => ${ABANDONED_MS / 1000})`;
          const taken = await db
            .updateTable('idempotency_keys')
            .set({ fingerprint, response: null, completed_at: null, claimed_at: sql`now()`, created_at: sql`now()` })
            .where('id', '=', stored.id)
            .where(stale)
            .returning('id')
            .executeTakeFirst();
          if (taken) {
            if (decision.kind === 'take-over-abandoned') {
              this.logger.warn(`Re-running idempotency claim ${stored.id}: its first attempt never completed`);
            }
            return { kind: 'run', claimId: taken.id };
          }
          continue;
        }
        case 'wait':
          if (Date.now() >= deadline) throw new AppError('IDEMPOTENCY_KEY_IN_USE');
          await new Promise((resolve) => setTimeout(resolve, POLL_MS));
          continue;
      }
    }
  }

  private async complete(claimId: string, response: unknown): Promise<void> {
    try {
      await this.database.db
        .updateTable('idempotency_keys')
        .set({ response: JSON.stringify(response ?? null), completed_at: new Date() })
        .where('id', '=', claimId)
        .execute();
    } catch (error) {
      // The write itself succeeded: failing the request now would invite the very retry this exists to absorb.
      this.logger.error(`Could not record the response of idempotency claim ${claimId}: ${(error as Error).message}`);
    }
  }

  private async release(claimId: string): Promise<void> {
    try {
      await this.database.db.deleteFrom('idempotency_keys').where('id', '=', claimId).where('completed_at', 'is', null).execute();
    } catch (error) {
      // Left claimed, the key is taken over as abandoned after ABANDONED_MS instead.
      this.logger.error(`Could not release idempotency claim ${claimId}: ${(error as Error).message}`);
    }
  }

  private purgeExpiredSometimes(): void {
    const now = Date.now();
    if (now < this.nextPurgeAt) return;
    this.nextPurgeAt = now + PURGE_EVERY_MS;
    void this.database.db
      .deleteFrom('idempotency_keys')
      .where('created_at', '<', new Date(now - RETENTION_MS))
      .execute()
      .catch((error: unknown) => this.logger.error(`Could not purge expired idempotency keys: ${(error as Error).message}`));
  }
}

function fingerprintOf(request: Request): string {
  return createHash('sha256')
    .update(`${request.method} ${request.originalUrl} ${JSON.stringify(request.body ?? null)}`)
    .digest('hex');
}
