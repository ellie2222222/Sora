/**
 * The Idempotency-Key for a write whose caller didn't pin one (API spec §2.10).
 *
 * A write that got no answer (a timeout, a dropped connection) may still have landed. When the
 * user sends the identical request again, it goes out under that attempt's key, so the server
 * answers with the original result instead of recording it twice. Any answer from the server,
 * success or refusal, settles the request: the next one, even identical, is a new write.
 */

/** After a day an identical request is a new write, not a retry; well inside the server's 30-day key retention. */
export const UNANSWERED_KEY_TTL_MS = 23 * 60 * 60 * 1000;

export function mintIdempotencyKey(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function requestFingerprint(method: string, url: string, body: unknown): string {
  return `${method.toUpperCase()} ${url} ${typeof body === 'string' ? body : JSON.stringify(body ?? null)}`;
}

export class RetryKeys {
  private readonly unanswered = new Map<string, { key: string; at: number }>();
  private readonly mint: () => string;
  private readonly now: () => number;

  constructor(mint: () => string = mintIdempotencyKey, now: () => number = Date.now) {
    this.mint = mint;
    this.now = now;
  }

  /** The key to send: the unanswered attempt's for an identical request, else a fresh one. */
  keyFor(fingerprint: string): string {
    for (const [held, { at }] of this.unanswered) {
      if (this.now() - at >= UNANSWERED_KEY_TTL_MS) this.unanswered.delete(held);
    }
    const kept = this.unanswered.get(fingerprint);
    if (kept) return kept.key;
    const key = this.mint();
    this.unanswered.set(fingerprint, { key, at: this.now() });
    return key;
  }

  /** The server answered; the key has done its job. */
  answered(fingerprint: string): void {
    this.unanswered.delete(fingerprint);
  }
}
