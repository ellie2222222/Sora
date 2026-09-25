/**
 * SQLite-backed persistence for the offline write queue, in the shared sync database
 * (`syncDatabase.ts`). The rest of `services/sync/` depends on the `QueueDb` interface,
 * not this module — the same seam `guestStorage.ts` gives `GuestStore`.
 */

import { Platform } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { QueueEntity, QueuedMutation, QueueStatus } from './offlineQueueTypes.ts';
import { syncDatabase } from './syncDatabase.ts';

interface QueueRow {
  queue_id: string;
  entity: string;
  op: string;
  local_id: string;
  server_id: string | null;
  idempotency_key: string;
  payload: string;
  status: string;
  error_code: string | null;
  created_at: string;
  updated_at: string;
  attempts: number;
  owner_user_id: string | null;
}

function toRow(mutation: QueuedMutation): QueueRow {
  return {
    queue_id: mutation.queueId,
    entity: mutation.entity,
    op: mutation.op,
    local_id: mutation.localId,
    server_id: mutation.serverId,
    idempotency_key: mutation.idempotencyKey,
    payload: JSON.stringify(mutation.payload),
    status: mutation.status,
    error_code: mutation.errorCode,
    created_at: mutation.createdAt,
    updated_at: mutation.updatedAt,
    attempts: mutation.attempts,
    owner_user_id: mutation.ownerUserId,
  };
}

function fromRow(row: QueueRow): QueuedMutation {
  return {
    queueId: row.queue_id,
    entity: row.entity as QueuedMutation['entity'],
    op: row.op as QueuedMutation['op'],
    localId: row.local_id,
    serverId: row.server_id,
    idempotencyKey: row.idempotency_key,
    payload: JSON.parse(row.payload) as unknown,
    status: row.status as QueueStatus,
    errorCode: row.error_code as QueuedMutation['errorCode'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    attempts: row.attempts,
    ownerUserId: row.owner_user_id,
  };
}

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

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS queued_mutations (
    queue_id TEXT PRIMARY KEY,
    entity TEXT NOT NULL,
    op TEXT NOT NULL,
    local_id TEXT NOT NULL,
    server_id TEXT,
    idempotency_key TEXT NOT NULL,
    payload TEXT NOT NULL,
    status TEXT NOT NULL,
    error_code TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    owner_user_id TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_queued_mutations_status ON queued_mutations(status);
  CREATE INDEX IF NOT EXISTS idx_queued_mutations_local_id ON queued_mutations(entity, local_id);
`;

class SqliteQueueDb implements QueueDb {
  private ready: Promise<SQLiteDatabase> | null = null;

  private open(): Promise<SQLiteDatabase> {
    if (this.ready === null) {
      const attempt = syncDatabase().then(async (db) => {
        await this.migrate(db);
        return db;
      });
      attempt.catch(() => {
        if (this.ready === attempt) this.ready = null;
      });
      this.ready = attempt;
    }
    return this.ready;
  }

  private async migrate(db: SQLiteDatabase): Promise<void> {
    await db.execAsync(CREATE_TABLE_SQL);
    // Installs from before ownership have the table without the column; CREATE IF NOT EXISTS won't add it.
    const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(queued_mutations)', {});
    if (!columns.some((column) => column.name === 'owner_user_id')) {
      await db.execAsync('ALTER TABLE queued_mutations ADD COLUMN owner_user_id TEXT');
    }
  }

  async insert(row: QueuedMutation): Promise<void> {
    const r = toRow(row);
    await (await this.open()).runAsync(
      `INSERT INTO queued_mutations
        (queue_id, entity, op, local_id, server_id, idempotency_key, payload, status, error_code, created_at, updated_at, attempts, owner_user_id)
       VALUES ($queue_id, $entity, $op, $local_id, $server_id, $idempotency_key, $payload, $status, $error_code, $created_at, $updated_at, $attempts, $owner_user_id)`,
      {
        $queue_id: r.queue_id,
        $entity: r.entity,
        $op: r.op,
        $local_id: r.local_id,
        $server_id: r.server_id,
        $idempotency_key: r.idempotency_key,
        $payload: r.payload,
        $status: r.status,
        $error_code: r.error_code,
        $created_at: r.created_at,
        $updated_at: r.updated_at,
        $attempts: r.attempts,
        $owner_user_id: r.owner_user_id,
      },
    );
  }

  async updateStatus(queueId: string, patch: QueueStatusPatch): Promise<void> {
    await (await this.open()).runAsync(
      `UPDATE queued_mutations
       SET status = $status,
           server_id = COALESCE($server_id, server_id),
           error_code = $error_code,
           attempts = COALESCE($attempts, attempts),
           updated_at = $updated_at
       WHERE queue_id = $queue_id`,
      {
        $status: patch.status,
        $server_id: patch.serverId ?? null,
        $error_code: patch.errorCode ?? null,
        $attempts: patch.attempts ?? null,
        $updated_at: patch.updatedAt,
        $queue_id: queueId,
      },
    );
  }

  async listByStatus(statuses: QueueStatus[]): Promise<QueuedMutation[]> {
    const placeholders = statuses.map((_, i) => `$s${i}`).join(', ');
    const params = Object.fromEntries(statuses.map((status, i) => [`$s${i}`, status]));
    const rows = await (await this.open()).getAllAsync<QueueRow>(
      `SELECT * FROM queued_mutations WHERE status IN (${placeholders}) ORDER BY created_at ASC`,
      params,
    );
    return rows.map(fromRow);
  }

  async listAll(): Promise<QueuedMutation[]> {
    const rows = await (await this.open()).getAllAsync<QueueRow>(
      'SELECT * FROM queued_mutations ORDER BY created_at ASC',
      {},
    );
    return rows.map(fromRow);
  }

  async findByLocalId(entity: QueueEntity, localId: string): Promise<QueuedMutation | null> {
    const row = await (await this.open()).getFirstAsync<QueueRow>(
      'SELECT * FROM queued_mutations WHERE entity = $entity AND local_id = $local_id',
      { $entity: entity, $local_id: localId },
    );
    return row ? fromRow(row) : null;
  }

  async remove(queueId: string): Promise<void> {
    await (await this.open()).runAsync('DELETE FROM queued_mutations WHERE queue_id = $queue_id', {
      $queue_id: queueId,
    });
  }

  async assignUnowned(ownerUserId: string): Promise<number> {
    const result = await (await this.open()).runAsync(
      'UPDATE queued_mutations SET owner_user_id = $owner WHERE owner_user_id IS NULL',
      { $owner: ownerUserId },
    );
    return result.changes;
  }}

/** Web fallback when SQLite/SharedArrayBuffer is unavailable in browser workers. */
class MemoryQueueDb implements QueueDb {
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
  }}

export const offlineQueueDb: QueueDb =
  Platform.OS === 'web' ? new MemoryQueueDb() : new SqliteQueueDb();
