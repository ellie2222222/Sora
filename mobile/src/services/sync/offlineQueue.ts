/**
 * The offline write queue's platform-free core.
 *
 * SQLite (`offlineQueueDb.ts`) is the single source of truth for these rows;
 * this class only orchestrates reads/writes against it and notifies
 * subscribers — the same "write, persist, notify" discipline
 * `GuestStore.mutate()` uses, just against SQLite rows instead of one JSON
 * blob. Persistence is injected (same seam as `GuestStore`'s
 * `GuestPersistence`) so this stays unit-testable under bare `node --test`
 * against an in-memory fake, with no native module in the graph.
 */

import type { ErrorCode } from '@sora/contracts';

import type { QueueDb } from './offlineQueueDb.ts';
import type { NewQueuedMutation, QueueEntity, QueuedMutation, QueueStatus } from './offlineQueueTypes.ts';

export type OfflineQueueListener = (rows: QueuedMutation[]) => void;

export class OfflineQueue {
  private db: QueueDb;
  private rows: QueuedMutation[] = [];
  private readonly listeners = new Set<OfflineQueueListener>();

  constructor(db: QueueDb) {
    this.db = db;
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.rows);
  }

  subscribe(listener: OfflineQueueListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  current(): QueuedMutation[] {
    return this.rows;
  }

  async refresh(): Promise<QueuedMutation[]> {
    this.rows = await this.db.listAll();
    this.emit();
    return this.rows;
  }

  async enqueue(entry: NewQueuedMutation): Promise<QueuedMutation> {
    const now = new Date().toISOString();
    const mutation: QueuedMutation = {
      ...entry,
      queueId: `${entry.entity}-${entry.localId}-${now}`,
      status: 'pending',
      errorCode: null,
      createdAt: now,
      updatedAt: now,
      attempts: 0,
    };
    await this.db.insert(mutation);
    return this.refresh().then(() => mutation);
  }

  async markSyncing(queueId: string): Promise<void> {
    await this.db.updateStatus(queueId, { status: 'syncing', updatedAt: new Date().toISOString() });
    await this.refresh();
  }

  async markSynced(queueId: string, serverId: string): Promise<void> {
    await this.db.updateStatus(queueId, {
      status: 'synced',
      serverId,
      errorCode: null,
      updatedAt: new Date().toISOString(),
    });
    await this.refresh();
  }

  async markFailed(queueId: string, errorCode: ErrorCode | null, attempts: number): Promise<void> {
    await this.db.updateStatus(queueId, {
      status: 'failed',
      errorCode,
      attempts,
      updatedAt: new Date().toISOString(),
    });
    await this.refresh();
  }

  async markConflict(queueId: string, errorCode: ErrorCode | null): Promise<void> {
    await this.db.updateStatus(queueId, {
      status: 'conflict',
      errorCode,
      updatedAt: new Date().toISOString(),
    });
    await this.refresh();
  }

  /** Back to `pending` for a manual retry from a `failed`/`conflict` row. */
  async markPending(queueId: string): Promise<void> {
    await this.db.updateStatus(queueId, { status: 'pending', errorCode: null, updatedAt: new Date().toISOString() });
    await this.refresh();
  }

  async findByLocalId(entity: QueueEntity, localId: string): Promise<QueuedMutation | null> {
    return this.db.findByLocalId(entity, localId);
  }

  statusFor(entity: QueueEntity, localId: string): QueueStatus | undefined {
    return this.rows.find((row) => row.entity === entity && row.localId === localId)?.status;
  }

  pendingCount(): number {
    return this.rows.filter((row) => row.status === 'pending' || row.status === 'syncing').length;
  }
}
