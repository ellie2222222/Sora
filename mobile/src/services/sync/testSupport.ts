/**
 * Shared fakes for the sync-layer tests. Not a `.test.ts` file so `node
 * --test`'s glob does not try to run it — mirrors `services/guest/testSupport.ts`.
 */

import type { QueueDb, QueueStatusPatch } from './offlineQueueDb.ts';
import type { QueueEntity, QueuedMutation, QueueStatus } from './offlineQueueTypes.ts';

/** A `Map`-backed `QueueDb`, so the offline-queue and sync-engine tests need no native SQLite module. */
export function memoryQueueDb(): QueueDb {
  const rows = new Map<string, QueuedMutation>();

  return {
    async insert(row) {
      rows.set(row.queueId, { ...row });
    },
    async updateStatus(queueId, patch: QueueStatusPatch) {
      const existing = rows.get(queueId);
      if (!existing) return;
      rows.set(queueId, {
        ...existing,
        status: patch.status,
        serverId: patch.serverId ?? existing.serverId,
        errorCode: patch.errorCode ?? null,
        attempts: patch.attempts ?? existing.attempts,
        updatedAt: patch.updatedAt,
      });
    },
    async listByStatus(statuses: QueueStatus[]) {
      return [...rows.values()]
        .filter((row) => statuses.includes(row.status))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
    async listAll() {
      return [...rows.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
    async findByLocalId(entity: QueueEntity, localId: string) {
      return [...rows.values()].find((row) => row.entity === entity && row.localId === localId) ?? null;
    },
    async remove(queueId) {
      rows.delete(queueId);
    },
    async assignUnowned(ownerUserId) {
      let count = 0;
      for (const row of rows.values()) {
        if (row.ownerUserId !== null) continue;
        row.ownerUserId = ownerUserId;
        count += 1;
      }
      return count;
    },  };
}

let counter = 0;
export function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}
