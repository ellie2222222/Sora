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
 * In-memory and per process, with the same caveat as RateLimitService.
 */

import { createHash } from 'node:crypto';
import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { of, tap, type Observable } from 'rxjs';
import type { Request } from 'express';

import { AppError } from './app-error.ts';

const MUTATING = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);
const RETENTION_MS = 24 * 60 * 60 * 1000;

interface Recorded {
  fingerprint: string;
  response: unknown;
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
      return of(recorded.response);
    }

    return next
      .handle()
      .pipe(tap((response) => this.seen.set(identity, { fingerprint, response, storedAt: Date.now() })));
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
