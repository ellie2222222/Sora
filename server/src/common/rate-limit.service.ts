/**
 * Per-IP request limiting and per-email login lockout (§2.9).
 *
 * In-memory, so the limits are per process: a multi-instance deployment needs a
 * shared store (Redis) before these numbers mean what they say. That is an
 * accepted v1 limitation rather than an oversight — the counters here still stop
 * a single-host brute force, which is what the spec's numbers are sized for.
 */

import { Injectable, type OnModuleDestroy } from '@nestjs/common';

interface Window {
  count: number;
  resetAt: number;
}

interface Failures {
  count: number;
  lockedUntil: number | null;
  lastFailureAt: number;
}

export interface RateDecision {
  allowed: boolean;
  /** Seconds the caller should wait, for the Retry-After header. */
  retryAfterSeconds: number;
}

const ALLOWED: RateDecision = { allowed: true, retryAfterSeconds: 0 };

const SWEEP_INTERVAL_MS = 60_000;
/** An unlocked failure streak older than this is forgotten; a day covers any plausible slow guessing. */
const FAILURE_STREAK_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class RateLimitService implements OnModuleDestroy {
  private readonly windows = new Map<string, Window>();
  private readonly failures = new Map<string, Failures>();
  // Without a sweep, every distinct IP and email ever seen stays in memory for the life of the process.
  private readonly sweeper = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS).unref();

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
    const record = this.failures.get(email) ?? { count: 0, lockedUntil: null, lastFailureAt: now };
    record.count += 1;
    record.lastFailureAt = now;
    if (record.count >= limit) record.lockedUntil = now + lockoutMs;
    this.failures.set(email, record);
  }

  /** A success clears the streak: the limit counts *consecutive* failures. */
  recordLoginSuccess(email: string): void {
    this.failures.delete(email);
  }

  /** Drops expired windows, lapsed lockouts and stale unlocked streaks. */
  sweep(now = Date.now()): void {
    for (const [key, window] of this.windows) {
      if (window.resetAt <= now) this.windows.delete(key);
    }
    for (const [email, record] of this.failures) {
      const expired = record.lockedUntil !== null
        ? record.lockedUntil <= now
        : record.lastFailureAt + FAILURE_STREAK_TTL_MS <= now;
      if (expired) this.failures.delete(email);
    }
  }

  onModuleDestroy(): void {
    clearInterval(this.sweeper);
  }

  reset(): void {
    this.windows.clear();
    this.failures.clear();
  }
}
