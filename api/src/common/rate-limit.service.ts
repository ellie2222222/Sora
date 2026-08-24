/**
 * Per-IP request limiting and per-email login lockout (§2.9).
 *
 * In-memory, so the limits are per process: a multi-instance deployment needs a
 * shared store (Redis) before these numbers mean what they say. That is an
 * accepted v1 limitation rather than an oversight — the counters here still stop
 * a single-host brute force, which is what the spec's numbers are sized for.
 */

import { Injectable } from '@nestjs/common';

interface Window {
  count: number;
  resetAt: number;
}

interface Failures {
  count: number;
  lockedUntil: number | null;
}

export interface RateDecision {
  allowed: boolean;
  /** Seconds the caller should wait, for the Retry-After header. */
  retryAfterSeconds: number;
}

const ALLOWED: RateDecision = { allowed: true, retryAfterSeconds: 0 };

@Injectable()
export class RateLimitService {
  private readonly windows = new Map<string, Window>();
  private readonly failures = new Map<string, Failures>();

  /** Fixed-window counter. Returns the decision and consumes a slot when allowed. */
  hit(key: string, limit: number, windowMs: number, now = Date.now()): RateDecision {
    const existing = this.windows.get(key);

    if (!existing || existing.resetAt <= now) {
      this.windows.set(key, { count: 1, resetAt: now + windowMs });
      return ALLOWED;
    }

    if (existing.count >= limit) {
      return { allowed: false, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) };
    }

    existing.count += 1;
    return ALLOWED;
  }

  /** Whether an email is currently locked out by consecutive login failures. */
  lockoutFor(email: string, now = Date.now()): RateDecision {
    const record = this.failures.get(email);
    if (!record?.lockedUntil) return ALLOWED;

    if (record.lockedUntil <= now) {
      this.failures.delete(email);
      return ALLOWED;
    }

    return { allowed: false, retryAfterSeconds: Math.ceil((record.lockedUntil - now) / 1000) };
  }

  recordLoginFailure(email: string, limit: number, lockoutMs: number, now = Date.now()): void {
    const record = this.failures.get(email) ?? { count: 0, lockedUntil: null };
    record.count += 1;
    if (record.count >= limit) record.lockedUntil = now + lockoutMs;
    this.failures.set(email, record);
  }

  /** A success clears the streak: the limit counts *consecutive* failures. */
  recordLoginSuccess(email: string): void {
    this.failures.delete(email);
  }

  reset(): void {
    this.windows.clear();
    this.failures.clear();
  }
}
