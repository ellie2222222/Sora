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
 * The key is claimed when the first attempt starts, not when it finishes: a client that
 * retries while that attempt is still in flight must wait for it, not run a second write.
 *
 * In-memory and per process, with the same caveat as RateLimitService.
 */

import { createHash } from 'node:crypto';
import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { shareReplay, tap, type Observable } from 'rxjs';
import type { Request } from 'express';

import { AppError } from './app-error.ts';

const MUTATING = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);
const RETENTION_MS = 24 * 60 * 60 * 1000;

interface Recorded {
  fingerprint: string;
  /** The first attempt, shared: in flight it is awaited, once done its response is replayed. */
  result: Observable<unknown>;
  storedAt: number;
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly seen = new Map<string, Recorded>();

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request & { user?: { id: string } }>();
    const key = request.header('Idempotency-Key');

    if (!key || !MUTATING.has(request.method)) return next.handle();

    this.evictExpired();

    const identity = `${request.user?.id ?? 'anonymous'}|${key}`;
    const fingerprint = fingerprintOf(request);
    const recorded = this.seen.get(identity);

    if (recorded) {
      if (recorded.fingerprint !== fingerprint) {
        throw new AppError(
          'VALIDATION_FAILED',
          'This Idempotency-Key was already used with a different request body',
        );
      }
      return recorded.result;
    }

    const result = next.handle().pipe(
      // A failed attempt is forgotten, so the client's retry runs again rather than replaying the error.
      tap({ error: () => this.seen.delete(identity) }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.seen.set(identity, { fingerprint, result, storedAt: Date.now() });
    return result;
  }

  private evictExpired(): void {
    const cutoff = Date.now() - RETENTION_MS;
    for (const [identity, recorded] of this.seen) {
      if (recorded.storedAt < cutoff) this.seen.delete(identity);
    }
  }
}

function fingerprintOf(request: Request): string {
  return createHash('sha256')
    .update(`${request.method} ${request.originalUrl} ${JSON.stringify(request.body ?? null)}`)
    .digest('hex');
}
