/**
 * The one place an RTK Query `queryFn` reaches to send or enqueue a signed-in
 * mutation, so every entity slice does the same thing: mint a local id (only
 * for `create`) and a stable idempotency key, then send it or hand the row to
 * the queue. The idempotency key is minted once here and never again — every
 * retry the sync engine performs reuses the value stored on the row.
 */

import { RetryKeys } from '@/services/api';
import { newLocalId } from '@/services/guest';
import { isNetworkError } from '../../utils/errors.ts';
import { isCurrentlyOnline, setCurrentlyOnline } from './networkState.ts';
import { offlineQueue } from './offlineQueueInstance.ts';
import type { QueueEntity, QueueOp } from './offlineQueueTypes.ts';
import { sendOrQueueWith } from './sendOrQueue.ts';

const writeKeys = new RetryKeys(newLocalId);

export interface EnqueueOfflineParams {
  entity: QueueEntity;
  op: QueueOp;
  /** The record's id as the UI will know it — a fresh local id for `create`, the existing id otherwise. */
  localId: string;
  serverId: string | null;
  payload: unknown;
}

/** Sends `send` now, or queues `row` when offline or unanswered; `whenQueued` is the optimistic result. */
export function sendOrQueue<T>(
  row: EnqueueOfflineParams,
  send: (idempotencyKey: string) => Promise<T>,
  whenQueued: () => T | Promise<T>,
): Promise<T> {
  return sendOrQueueWith(
    {
      isOnline: isCurrentlyOnline,
      setOnline: setCurrentlyOnline,
      isNetworkError,
      keys: writeKeys,
      enqueue: (queued) => offlineQueue.enqueue(queued),
    },
    row,
    send,
    whenQueued,
  );
}

/**
 * Whether `id` is still an unsynced offline-queue record — used to skip
 * `invalidatesTags` for a mutation that just enqueued instead of calling the
 * server: invalidating while offline would trigger a refetch that can only
 * fail, clobbering the optimistic cache patch with a network error. Works
 * for both a fresh `create`'s local id and an existing record's id under an
 * `update`/`cancel`/`archive`.
 */
export function isStillQueued(id: string): boolean {
  return offlineQueue.current().some((row) => row.localId === id && row.status !== 'synced');
}

export { newLocalId };
