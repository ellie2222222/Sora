/**
 * The offline write queue's storage seam: the `QueueDb` interface, and the platform's
 * implementation of it (SQLite in `sqliteQueueDb.ts`, memory on web). The rest of
 * `services/sync/` depends on the interface — the same seam `guestStorage.ts` gives `GuestStore`.
 */

import { Platform } from 'react-native';

import type { QueueEntity, QueuedMutation, QueueStatus } from './offlineQueueTypes.ts';
import { MemoryQueueDb } from './memoryQueueDb.ts';
import { SqliteQueueDb } from './sqliteQueueDb.ts';
import { syncDatabase } from './syncDatabase.ts';

export interface QueueStatusPatch {
  status: QueueStatus;
  serverId?: string | null;
  errorCode?: QueuedMutation['errorCode'];
  attempts?: number;
  updatedAt: string;
}

export interface QueueDb {
  insert(row: QueuedMutation): Promise<void>;
  updateStatus(queueId: string, patch: QueueStatusPatch): Promise<void>;
  listByStatus(statuses: QueueStatus[]): Promise<QueuedMutation[]>;
  listAll(): Promise<QueuedMutation[]>;
  findByLocalId(entity: QueueEntity, localId: string): Promise<QueuedMutation | null>;
  remove(queueId: string): Promise<void>;
  /** Gives every ownerless (pre-ownership) row to `ownerUserId`; returns how many there were. */
  assignUnowned(ownerUserId: string): Promise<number>;
}

// The web build keeps its queue in memory: SQLite needs SharedArrayBuffer, which browser workers may lack.
export const offlineQueueDb: QueueDb =
  Platform.OS === 'web' ? new MemoryQueueDb() : new SqliteQueueDb(syncDatabase);
