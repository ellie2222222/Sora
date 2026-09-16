/**
 * SQLite-backed persistence for the offline write queue.
 *
 * The only file in this feature that imports `expo-sqlite` — everything else
 * in `services/sync/` depends on the `QueueDb` interface, not this module
 * directly, the same seam `guestStorage.ts` gives `GuestStore`. Scope is
 * deliberately narrow: this table is the *entire* SQLite footprint of the
 * app. RTK Query's cache remains the read path for every entity; nothing
 * here mirrors account/transaction/etc. data.
 */

import { Platform } from 'react-native';
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import type { QueueEntity, QueuedMutation, QueueStatus } from './offlineQueueTypes.ts';

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
  ensureSchema(): Promise<void>;
  insert(row: QueuedMutation): Promise<void>;
  updateStatus(queueId: string, patch: QueueStatusPatch): Promise<void>;
  listByStatus(statuses: QueueStatus[]): Promise<QueuedMutation[]>;
  listAll(): Promise<QueuedMutation[]>;
  findByLocalId(entity: QueueEntity, localId: string): Promise<QueuedMutation | null>;
  remove(queueId: string): Promise<void>;
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
    attempts INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_queued_mutations_status ON queued_mutations(status);
  CREATE INDEX IF NOT EXISTS idx_queued_mutations_local_id ON queued_mutations(entity, local_id);
`;

class SqliteQueueDb implements QueueDb {
  private db: SQLiteDatabase | null = null;
  private schemaReady: Promise<void> | null = null;

  private open(): SQLiteDatabase {
    if (!this.db) {
      this.db = openDatabaseSync('sora_sync.db');
    }
    return this.db;
  }

  ensureSchema(): Promise<void> {
    if (!this.schemaReady) {
      this.schemaReady = this.open().execAsync(CREATE_TABLE_SQL);
    }
    return this.schemaReady;
  }

  async insert(row: QueuedMutation): Promise<void> {
    await this.ensureSchema();
    const r = toRow(row);
    await this.open().runAsync(
      `INSERT INTO queued_mutations
        (queue_id, entity, op, local_id, server_id, idempotency_key, payload, status, error_code, created_at, updated_at, attempts)
       VALUES ($queue_id, $entity, $op, $local_id, $server_id, $idempotency_key, $payload, $status, $error_code, $created_at, $updated_at, $attempts)`,
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
      },
    );
  }

  async updateStatus(queueId: string, patch: QueueStatusPatch): Promise<void> {
    await this.ensureSchema();
    await this.open().runAsync(
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
    await this.ensureSchema();
    const placeholders = statuses.map((_, i) => `$s${i}`).join(', ');
    const params = Object.fromEntries(statuses.map((status, i) => [`$s${i}`, status]));
    const rows = await this.open().getAllAsync<QueueRow>(
      `SELECT * FROM queued_mutations WHERE status IN (${placeholders}) ORDER BY created_at ASC`,
      params,
    );
    return rows.map(fromRow);
  }

  async listAll(): Promise<QueuedMutation[]> {
    await this.ensureSchema();
    const rows = await this.open().getAllAsync<QueueRow>(
      'SELECT * FROM queued_mutations ORDER BY created_at ASC',
      {},
    );
    return rows.map(fromRow);
  }

  async findByLocalId(entity: QueueEntity, localId: string): Promise<QueuedMutation | null> {
    await this.ensureSchema();
    const row = await this.open().getFirstAsync<QueueRow>(
      'SELECT * FROM queued_mutations WHERE entity = $entity AND local_id = $local_id',
      { $entity: entity, $local_id: localId },
    );
    return row ? fromRow(row) : null;
  }

  async remove(queueId: string): Promise<void> {
    await this.ensureSchema();
    await this.open().runAsync('DELETE FROM queued_mutations WHERE queue_id = $queue_id', {
      $queue_id: queueId,
    });
  }
}

/** Web fallback when SQLite/SharedArrayBuffer is unavailable in browser workers. */
class MemoryQueueDb implements QueueDb {
  private rows = new Map<string, QueuedMutation>();

  async ensureSchema(): Promise<void> {}

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
}

export const offlineQueueDb: QueueDb =
  Platform.OS === 'web' ? new MemoryQueueDb() : new SqliteQueueDb();
