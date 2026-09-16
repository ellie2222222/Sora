/**
 * The one place an RTK Query `queryFn`'s offline branch reaches to enqueue a
 * mutation, so every entity slice does the same thing: mint a local id (only
 * for `create`) and a stable idempotency key, then hand the row to the
 * queue. The idempotency key is minted once here and never again — every
 * retry the sync engine performs reuses the value stored on the row.
 */

import { newLocalId } from '@/services/guest';
import { offlineQueue } from './offlineQueueInstance.ts';
import type { QueueEntity, QueueOp, QueuedMutation } from './offlineQueueTypes.ts';

export interface EnqueueOfflineParams {
  entity: QueueEntity;
  op: QueueOp;
  /** The record's id as the UI will know it — a fresh local id for `create`, the existing id otherwise. */
  localId: string;
  serverId: string | null;
  payload: unknown;
}

export async function enqueueOffline(params: EnqueueOfflineParams): Promise<QueuedMutation> {
  return offlineQueue.enqueue({ ...params, idempotencyKey: newLocalId() });
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
