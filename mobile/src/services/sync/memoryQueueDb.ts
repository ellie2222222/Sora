/**
 * A `Map`-backed `QueueDb`: the web build's queue, and the one the queue and sync-engine tests
 * run against. Kept apart from `offlineQueueDb.ts` so it loads without react-native or expo-sqlite.
 */

import type { QueueDb, QueueStatusPatch } from './offlineQueueDb.ts';
import type { QueueEntity, QueuedMutation, QueueStatus } from './offlineQueueTypes.ts';

export class MemoryQueueDb implements QueueDb {
  private rows = new Map<string, QueuedMutation>();

  async insert(row: QueuedMutation): Promise<void> {
    this.rows.set(row.queueId, { ...row });
  }

  async updateStatus(queueId: string, patch: QueueStatusPatch): Promise<void> {
    const existing = this.rows.get(queueId);
    if (!existing) return;
    this.rows.set(queueId, {
      ...existing,
      status: patch.status,
      serverId: patch.serverId ?? existing.serverId,
      errorCode: patch.errorCode ?? null,
      attempts: patch.attempts ?? existing.attempts,
      updatedAt: patch.updatedAt,
    });
  }

  async listByStatus(statuses: QueueStatus[]): Promise<QueuedMutation[]> {
    return [...this.rows.values()]
      .filter((row) => statuses.includes(row.status))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async listAll(): Promise<QueuedMutation[]> {
    return [...this.rows.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async findByLocalId(entity: QueueEntity, localId: string): Promise<QueuedMutation | null> {
    return [...this.rows.values()].find((row) => row.entity === entity && row.localId === localId) ?? null;
  }

  async remove(queueId: string): Promise<void> {
    this.rows.delete(queueId);
  }

  async assignUnowned(ownerUserId: string): Promise<number> {
    let count = 0;
    for (const row of this.rows.values()) {
      if (row.ownerUserId !== null) continue;
      row.ownerUserId = ownerUserId;
      count += 1;
    }
    return count;
  }
}
