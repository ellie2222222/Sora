import { strict as assert } from 'node:assert';
import { DatabaseSync } from 'node:sqlite';
import { describe, it } from 'node:test';

import { MemoryQueueDb } from './memoryQueueDb.ts';
import type { QueueDb } from './offlineQueueDb.ts';
import type { QueuedMutation } from './offlineQueueTypes.ts';
import { SqliteQueueDb, type QueueSqlDatabase } from './sqliteQueueDb.ts';

/** expo-sqlite's async surface over Node's built-in synchronous SQLite, so the real SQL runs here. */
function nodeSqlite(db: DatabaseSync = new DatabaseSync(':memory:')): QueueSqlDatabase {
  return {
    async execAsync(source) {
      db.exec(source);
    },
    async runAsync(source, params) {
      return { changes: Number(db.prepare(source).run(params).changes) };
    },
    async getAllAsync<T>(source: string, params: Record<string, string | number | null>) {
      return db.prepare(source).all(params) as T[];
    },
    async getFirstAsync<T>(source: string, params: Record<string, string | number | null>) {
      return (db.prepare(source).get(params) as T | undefined) ?? null;
    },
  };
}

function sqliteQueue(db?: DatabaseSync): QueueDb {
  const handle = nodeSqlite(db);
  return new SqliteQueueDb(async () => handle);
}

function mutation(queueId: string, overrides: Partial<QueuedMutation> = {}): QueuedMutation {
  return {
    queueId,
    entity: 'transaction',
    op: 'create',
    localId: `local-${queueId}`,
    serverId: null,
    idempotencyKey: `idem-${queueId}`,
    payload: { amount: '150000.0000', note: { nested: [1, 'two'] } },
    status: 'pending',
    errorCode: null,
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    attempts: 0,
    ownerUserId: 'user-a',
    ...overrides,
  };
}

/** One script of writes, run against both implementations so the SQLite one can't drift from the fake. */
async function exercise(db: QueueDb) {
  await db.insert(mutation('q-late', { createdAt: '2026-09-01T12:00:00.000Z' }));
  await db.insert(mutation('q-early', { createdAt: '2026-09-01T08:00:00.000Z', ownerUserId: null }));
  await db.insert(mutation('q-mid', { createdAt: '2026-09-01T10:00:00.000Z', entity: 'account', ownerUserId: null }));

  await db.updateStatus('q-mid', { status: 'synced', serverId: 'srv-1', attempts: 1, updatedAt: '2026-09-01T13:00:00.000Z' });
  await db.updateStatus('q-late', { status: 'failed', errorCode: 'ACCOUNT_ARCHIVED', attempts: 2, updatedAt: '2026-09-01T13:01:00.000Z' });
  // Omitted fields: serverId and attempts keep their value, errorCode is cleared.
  await db.updateStatus('q-mid', { status: 'conflict', updatedAt: '2026-09-01T13:02:00.000Z' });
  await db.updateStatus('q-missing', { status: 'synced', updatedAt: '2026-09-01T13:03:00.000Z' });

  const assigned = await db.assignUnowned('user-b');
  const assignedAgain = await db.assignUnowned('user-c');
  const open = await db.listByStatus(['pending', 'failed']);
  const byLocalId = await db.findByLocalId('account', 'local-q-mid');
  const wrongEntity = await db.findByLocalId('transaction', 'local-q-mid');
  await db.remove('q-early');
  const afterRemove = await db.listAll();

  return { assigned, assignedAgain, open, byLocalId, wrongEntity, afterRemove };
}

describe('SqliteQueueDb', () => {
  it('lists by created_at ascending, not insertion order, and filters by status', async () => {
    const db = sqliteQueue();
    await db.insert(mutation('q-2', { createdAt: '2026-09-02T00:00:00.000Z' }));
    await db.insert(mutation('q-3', { createdAt: '2026-09-03T00:00:00.000Z', status: 'synced' }));
    await db.insert(mutation('q-1', { createdAt: '2026-09-01T00:00:00.000Z', status: 'failed' }));

    assert.deepEqual((await db.listAll()).map((row) => row.queueId), ['q-1', 'q-2', 'q-3']);
    assert.deepEqual((await db.listByStatus(['pending', 'failed'])).map((row) => row.queueId), ['q-1', 'q-2']);
    assert.deepEqual(await db.listByStatus(['syncing']), []);
  });

  it('round-trips every field, payload JSON included', async () => {
    const db = sqliteQueue();
    const row = mutation('q-1', { serverId: 'srv-9', errorCode: 'VALIDATION_FAILED', attempts: 3, status: 'failed' });
    await db.insert(row);

    assert.deepEqual(await db.findByLocalId('transaction', 'local-q-1'), row);
    assert.equal(await db.findByLocalId('transaction', 'nope'), null);
  });

  it('updates status keeping serverId and attempts when omitted, and clearing errorCode', async () => {
    const db = sqliteQueue();
    await db.insert(mutation('q-1'));
    await db.updateStatus('q-1', { status: 'failed', serverId: 'srv-1', errorCode: 'ACCOUNT_ARCHIVED', attempts: 2, updatedAt: 'T1' });
    await db.updateStatus('q-1', { status: 'pending', updatedAt: 'T2' });

    const [row] = await db.listAll();
    assert.equal(row?.status, 'pending');
    assert.equal(row?.serverId, 'srv-1');
    assert.equal(row?.attempts, 2);
    assert.equal(row?.errorCode, null);
    assert.equal(row?.updatedAt, 'T2');
  });

  it('assignUnowned gives only ownerless rows to the user and reports how many', async () => {
    const db = sqliteQueue();
    await db.insert(mutation('q-owned', { ownerUserId: 'user-a' }));
    await db.insert(mutation('q-legacy-1', { ownerUserId: null }));
    await db.insert(mutation('q-legacy-2', { ownerUserId: null }));

    assert.equal(await db.assignUnowned('user-b'), 2);
    assert.equal(await db.assignUnowned('user-c'), 0);
    const owners = Object.fromEntries((await db.listAll()).map((row) => [row.queueId, row.ownerUserId]));
    assert.deepEqual(owners, { 'q-owned': 'user-a', 'q-legacy-1': 'user-b', 'q-legacy-2': 'user-b' });
  });

  it('behaves exactly like the in-memory fake over the same sequence of writes', async () => {
    const fromSqlite = await exercise(sqliteQueue());
    const fromMemory = await exercise(new MemoryQueueDb());

    assert.deepEqual(fromSqlite, fromMemory);
    assert.equal(fromSqlite.assigned, 2);
    assert.deepEqual(fromSqlite.open.map((row) => row.queueId), ['q-early', 'q-late']);
    assert.equal(fromSqlite.byLocalId?.serverId, 'srv-1');
    assert.equal(fromSqlite.byLocalId?.attempts, 1);
  });

  it('adds owner_user_id to a table created before ownership, leaving its rows ownerless', async () => {
    const raw = new DatabaseSync(':memory:');
    raw.exec(`CREATE TABLE queued_mutations (
      queue_id TEXT PRIMARY KEY, entity TEXT NOT NULL, op TEXT NOT NULL, local_id TEXT NOT NULL,
      server_id TEXT, idempotency_key TEXT NOT NULL, payload TEXT NOT NULL, status TEXT NOT NULL,
      error_code TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0)`);
    raw.exec(`INSERT INTO queued_mutations VALUES ('q-old', 'transaction', 'create', 'local-old', NULL, 'idem-old', '{}', 'pending', NULL, 'T0', 'T0', 0)`);
    const db = sqliteQueue(raw);

    assert.equal((await db.listAll())[0]?.ownerUserId, null);
    assert.equal(await db.assignUnowned('user-a'), 1);
  });

  it('retries opening after a failed open instead of caching the rejection', async () => {
    const handle = nodeSqlite();
    let opens = 0;
    const db = new SqliteQueueDb(async () => {
      opens += 1;
      if (opens === 1) throw new Error('keystore locked');
      return handle;
    });

    await assert.rejects(db.listAll(), /keystore locked/);
    assert.deepEqual(await db.listAll(), []);
    assert.equal(opens, 2);
  });
});
