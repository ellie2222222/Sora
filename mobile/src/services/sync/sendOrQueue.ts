/**
 * A signed-in write: sent now while the API was last reachable, queued otherwise — and queued too when
 * the attempt gets no answer, under the key it was sent with. The API may have applied a write whose
 * answer was lost, so the queued replay must carry the same Idempotency-Key (API spec §2.10) or the
 * same money would be recorded twice.
 *
 * Platform-free (every dependency injected), so it runs under bare `node --test`.
 */

import type { EnqueueOfflineParams } from './offlineEnqueue.ts';

/** `RetryKeys`: an identical write still in flight gets the same key, so a double-tapped Save records once. */
export interface WriteKeys {
  keyFor(fingerprint: string): string;
  answered(fingerprint: string): void;
}

export interface SendOrQueueDeps {
  isOnline(): boolean;
  setOnline(online: boolean): void;
  isNetworkError(error: unknown): boolean;
  keys: WriteKeys;
  enqueue(row: EnqueueOfflineParams & { idempotencyKey: string }): Promise<unknown>;
}

/** What makes two writes the same write; a create's fresh local id is left out, it differs every time. */
export function writeFingerprint(row: EnqueueOfflineParams): string {
  return `${row.entity} ${row.op} ${row.serverId ?? ''} ${JSON.stringify(row.payload ?? null)}`;
}

export async function sendOrQueueWith<T>(
  deps: SendOrQueueDeps,
  row: EnqueueOfflineParams,
  send: (idempotencyKey: string) => Promise<T>,
  whenQueued: () => T | Promise<T>,
): Promise<T> {
  const fingerprint = writeFingerprint(row);
  const idempotencyKey = deps.keys.keyFor(fingerprint);
  if (deps.isOnline()) {
    try {
      const result = await send(idempotencyKey);
      deps.keys.answered(fingerprint);
      deps.setOnline(true);
      return result;
    } catch (error) {
      // A refusal (validation, role, conflict) is the user's to see now; only silence is queued.
      if (!deps.isNetworkError(error)) {
        deps.keys.answered(fingerprint);
        throw error;
      }
      deps.setOnline(false);
    }
  }
  try {
    await deps.enqueue({ ...row, idempotencyKey });
  } finally {
    // Queued, the row owns the key from here; an identical write made later is a new one, with its own.
    deps.keys.answered(fingerprint);
  }
  return whenQueued();
}
