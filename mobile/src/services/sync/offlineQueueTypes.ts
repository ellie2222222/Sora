/**
 * Shapes for the offline write queue. A `QueuedMutation` is a pending intent
 * to call the API — the queue's persisted truth lives in SQLite
 * (`offlineQueueDb.ts`); nothing here touches a native module, so this file
 * stays importable under bare `node --test`.
 */

import type { ErrorCode } from '@sora/contracts';

export const QUEUE_ENTITIES = ['transaction', 'account', 'budget', 'goal', 'category', 'contribution'] as const;
export type QueueEntity = (typeof QUEUE_ENTITIES)[number];

/** Accounts/budgets/categories archive (status-based); transactions/goals cancel; `delete` is a category's permanent removal. */
export type QueueOp = 'create' | 'update' | 'cancel' | 'archive' | 'delete';

export const QUEUE_STATUSES = ['pending', 'syncing', 'synced', 'failed', 'conflict'] as const;
export type QueueStatus = (typeof QUEUE_STATUSES)[number];

/** A queue row's write is still open once it's anything but `synced`. */
export function isOpenStatus(status: QueueStatus): boolean {
  return status !== 'synced';
}

export interface QueuedMutation {
  queueId: string;
  entity: QueueEntity;
  op: QueueOp;
  /** The record's id as the UI already knows it — a client-generated id for a queued `create`. */
  localId: string;
  /** Filled in once a `create` round-trips, or already known for `update`/`cancel`/`archive`. */
  serverId: string | null;
  /** Minted once at enqueue time, reused on every retry, so a retry never moves money twice. */
  idempotencyKey: string;
  /** The validated request body (already Zod-parsed client-side, VL-01). */
  payload: unknown;
  status: QueueStatus;
  errorCode: ErrorCode | null;
  createdAt: string;
  updatedAt: string;
  attempts: number;
  /** The signed-in user who queued it; `null` only on rows written before ownership existed. */
  ownerUserId: string | null;
}

export type NewQueuedMutation = Omit<
  QueuedMutation,
  'queueId' | 'status' | 'errorCode' | 'createdAt' | 'updatedAt' | 'attempts' | 'ownerUserId'
>;
