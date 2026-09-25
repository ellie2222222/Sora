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

/** Owner of pre-ownership rows no restored session vouched for. No account id has this shape, so they are never shown or synced. */
export const ORPHANED_OWNER = 'orphaned:pre-ownership';

/** Where the owner chosen for pre-ownership rows is kept across launches. */
export interface PreOwnershipDecisions {
  read(): Promise<string | null>;
  write(owner: string): Promise<void>;
}

export class OfflineQueue {
  private db: QueueDb;
  private rows: QueuedMutation[] = [];
  private owner: string | null = null;
  private lastEnqueuedAt = 0;
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

  ownerId(): string | null {
    return this.owner;
  }

  /**
   * Only the signed-in user's rows are visible or synced: replaying one user's
   * queued writes under the next user's token would record them as that user.
   */
  async setOwner(userId: string | null): Promise<void> {
    this.owner = userId;
    await this.refresh();
  }

  /**
   * Pre-ownership rows record no author, so only the session persisted across the upgrade can
   * vouch for them — never a later login, or one person's writes could sync into another's
   * account. The first launch's decision goes into `decisions` (kept apart from SQLite) before
   * the queue is touched, and later launches reuse it, so a failed assignment is never redone
   * for a different saved session. An unrecordable or unreadable decision orphans the rows:
   * stranding them beats syncing them to the wrong person.
   */
  async resolvePreOwnershipRows(
    restoredUserId: string | null,
    decisions: PreOwnershipDecisions,
  ): Promise<{ owner: string; count: number }> {
    let owner: string;
    try {
      const recorded = await decisions.read();
      owner = recorded ?? restoredUserId ?? ORPHANED_OWNER;
      if (recorded === null) await decisions.write(owner);
    } catch {
      owner = ORPHANED_OWNER;
    }

    const count = await this.db.assignUnowned(owner);
    if (count > 0) await this.refresh();
    return { owner, count };
  }

  async refresh(): Promise<QueuedMutation[]> {
    const owner = this.owner;
    this.rows = owner === null ? [] : (await this.db.listAll()).filter((row) => row.ownerUserId === owner);
    this.emit();
    return this.rows;
  }

  async enqueue(entry: NewQueuedMutation): Promise<QueuedMutation> {
    if (this.owner === null) throw new Error('Offline queue has no signed-in owner');
    // Strictly after the previous row, so FIFO order survives two enqueues in one millisecond.
    this.lastEnqueuedAt = Math.max(Date.now(), this.lastEnqueuedAt + 1);
    const now = new Date(this.lastEnqueuedAt).toISOString();
    const mutation: QueuedMutation = {
      ...entry,
      // The idempotency key, not the clock: an offline create and its first edit can share a millisecond.
      queueId: `${entry.entity}-${entry.op}-${entry.idempotencyKey}`,
      status: 'pending',
      errorCode: null,
      createdAt: now,
      updatedAt: now,
      attempts: 0,
      ownerUserId: this.owner,
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
    const row = await this.db.findByLocalId(entity, localId);
    return row !== null && row.ownerUserId === this.owner ? row : null;
  }

  statusFor(entity: QueueEntity, localId: string): QueueStatus | undefined {
    return this.rows.find((row) => row.entity === entity && row.localId === localId)?.status;
  }

  /** Every account with writes still waiting here, whoever is signed in now. */
  async ownersWithOpenRows(): Promise<string[]> {
    const owners = (await this.db.listAll())
      .filter((row) => row.status !== 'synced' && row.ownerUserId !== null && row.ownerUserId !== ORPHANED_OWNER)
      .map((row) => row.ownerUserId as string);
    return [...new Set(owners)];
  }

  pendingCount(): number {
    return this.rows.filter((row) => row.status === 'pending' || row.status === 'syncing').length;
  }
}
