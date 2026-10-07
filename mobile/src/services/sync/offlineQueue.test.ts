import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { OfflineQueue, ORPHANED_OWNER } from './offlineQueue.ts';
import { memoryQueueDb, nextId } from './testSupport.ts';
import type { NewQueuedMutation } from './offlineQueueTypes.ts';

function newEntry(overrides: Partial<NewQueuedMutation> = {}): NewQueuedMutation {
  return {
    entity: 'transaction',
    op: 'create',
    localId: nextId('local'),
    serverId: null,
    idempotencyKey: nextId('key'),
    payload: { amount: '10.0000' },
    ...overrides,
  };
}

describe('OfflineQueue.enqueue', () => {
  it('persists a pending row and notifies subscribers', async () => {
    const queue = new OfflineQueue(memoryQueueDb());
    await queue.setOwner('user-a');
    const seen: number[] = [];
    queue.subscribe((rows) => seen.push(rows.length));

    const mutation = await queue.enqueue(newEntry());

    assert.equal(mutation.status, 'pending');
    assert.equal(queue.current().length, 1);
    assert.deepEqual(seen, [1]);
  });
});

describe('OfflineQueue status transitions', () => {
  it('markSynced records the server id and flips status', async () => {
    const queue = new OfflineQueue(memoryQueueDb());
    await queue.setOwner('user-a');
    const mutation = await queue.enqueue(newEntry());

    await queue.markSyncing(mutation.queueId);
    assert.equal(queue.current()[0]?.status, 'syncing');

    await queue.markSynced(mutation.queueId, 'server-1');
    const row = queue.current()[0]!;
    assert.equal(row.status, 'synced');
    assert.equal(row.serverId, 'server-1');
  });

  it('markConflict never drops the row', async () => {
    const queue = new OfflineQueue(memoryQueueDb());
    await queue.setOwner('user-a');
    const mutation = await queue.enqueue(newEntry());

    await queue.markConflict(mutation.queueId, 'FORBIDDEN');

    const row = queue.current()[0]!;
    assert.equal(row.status, 'conflict');
    assert.equal(row.errorCode, 'FORBIDDEN');
  });

  it('markFailed increments attempts without deleting the row', async () => {
    const queue = new OfflineQueue(memoryQueueDb());
    await queue.setOwner('user-a');
    const mutation = await queue.enqueue(newEntry());

    await queue.markFailed(mutation.queueId, 'TRANSACTION_ALREADY_DELETED', 1);

    const row = queue.current()[0]!;
    assert.equal(row.status, 'failed');
    assert.equal(row.attempts, 1);
  });
});

describe('OfflineQueue.pendingCount', () => {
  it('counts pending and syncing rows, not synced/failed/conflict ones', async () => {
    const queue = new OfflineQueue(memoryQueueDb());
    await queue.setOwner('user-a');
    const a = await queue.enqueue(newEntry());
    const b = await queue.enqueue(newEntry());
    const c = await queue.enqueue(newEntry());

    await queue.markSyncing(a.queueId);
    await queue.markSynced(b.queueId, 'server-b');
    await queue.markFailed(c.queueId, null, 1);

    assert.equal(queue.pendingCount(), 1);
  });
});

describe('OfflineQueue.statusFor / findByLocalId', () => {
  it('finds a row by entity and local id', async () => {
    const queue = new OfflineQueue(memoryQueueDb());
    await queue.setOwner('user-a');
    const mutation = await queue.enqueue(newEntry({ localId: 'local-42' }));

    assert.equal(queue.statusFor('transaction', 'local-42'), 'pending');
    assert.equal(queue.statusFor('transaction', 'missing'), undefined);

    const found = await queue.findByLocalId('transaction', 'local-42');
    assert.equal(found?.queueId, mutation.queueId);
  });
});

describe('OfflineQueue ownership', () => {
  it("hides and never syncs another user's rows after a user switch", async () => {
    const queue = new OfflineQueue(memoryQueueDb());
    await queue.setOwner('user-a');
    const queued = await queue.enqueue(newEntry());

    await queue.setOwner('user-b');
    assert.deepEqual(queue.current(), []);
    assert.equal(await queue.findByLocalId('transaction', queued.localId), null);

    await queue.setOwner('user-a');
    assert.deepEqual(queue.current().map((row) => row.queueId), [queued.queueId]);
  });

  it('shows nothing and refuses to enqueue while signed out', async () => {
    const queue = new OfflineQueue(memoryQueueDb());
    await queue.setOwner('user-a');
    await queue.enqueue(newEntry());

    await queue.setOwner(null);
    assert.deepEqual(queue.current(), []);
    await assert.rejects(queue.enqueue(newEntry()));
  });
});

describe('OfflineQueue pre-ownership rows', () => {
  async function legacyDb(count: number) {
    const db = memoryQueueDb();
    const now = new Date().toISOString();
    for (let index = 0; index < count; index += 1) {
      await db.insert({
        ...newEntry(),
        queueId: `legacy-${index}`,
        status: 'pending',
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        attempts: 0,
        ownerUserId: null,
      });
    }
    return db;
  }

  /** The store that outlives each launch, as AsyncStorage does beside the SQLite file. */
  function memoryDecisions(options: { failRead?: boolean; failWrite?: boolean } = {}) {
    let recorded: string | null = null;
    return {
      read: async () => {
        if (options.failRead) throw new Error('storage unavailable');
        return recorded;
      },
      write: async (owner: string) => {
        if (options.failWrite) throw new Error('storage unavailable');
        recorded = owner;
      },
      recorded: () => recorded,
    };
  }

  it('never gives them to whoever signs in', async () => {
    const queue = new OfflineQueue(await legacyDb(1));
    await queue.setOwner('user-a');
    assert.deepEqual(queue.current(), []);
    assert.deepEqual(await queue.ownersWithOpenRows(), []);
  });

  it('gives them to the account whose session was restored at startup, and only to it', async () => {
    const queue = new OfflineQueue(await legacyDb(2));
    const decisions = memoryDecisions();
    await queue.setOwner('user-a');
    assert.deepEqual(await queue.resolvePreOwnershipRows('user-a', decisions), { owner: 'user-a', count: 2 });
    assert.equal(queue.current().length, 2);
    assert.equal(decisions.recorded(), 'user-a');

    await queue.setOwner('user-b');
    assert.deepEqual(queue.current(), []);
  });

  it('orphans them for good when no session was restored: never shown, synced or claimed later', async () => {
    const queue = new OfflineQueue(await legacyDb(1));
    const decisions = memoryDecisions();
    assert.deepEqual(await queue.resolvePreOwnershipRows(null, decisions), { owner: ORPHANED_OWNER, count: 1 });

    await queue.setOwner('user-a');
    assert.deepEqual(queue.current(), []);
    assert.equal(queue.pendingCount(), 0);
    assert.deepEqual(await queue.ownersWithOpenRows(), []);
    assert.equal((await queue.resolvePreOwnershipRows('user-a', decisions)).count, 0);
    assert.deepEqual(queue.current(), []);
  });

  it('keeps the first launch\'s owner when that launch fails to assign, whoever is signed in next launch', async () => {
    const db = await legacyDb(1);
    const decisions = memoryDecisions();
    const failingDb = { ...db, assignUnowned: async () => Promise.reject(new Error('SQLITE_BUSY')) };

    // Launch 1: A's session was saved, but the SQLite write fails.
    await assert.rejects(new OfflineQueue(failingDb).resolvePreOwnershipRows('user-a', decisions), /SQLITE_BUSY/);
    assert.equal(decisions.recorded(), 'user-a');

    // Launch 2: A signed out and B signed in during launch 1, so B's session is the saved one now.
    const queue = new OfflineQueue(db);
    await queue.setOwner('user-b');
    assert.deepEqual(await queue.resolvePreOwnershipRows('user-b', decisions), { owner: 'user-a', count: 1 });
    assert.deepEqual(queue.current(), []);
    assert.equal(queue.pendingCount(), 0);
    assert.deepEqual(await queue.ownersWithOpenRows(), ['user-a']);

    await queue.setOwner('user-a');
    assert.equal(queue.current().length, 1);
  });

  it('keeps an orphaning decision when that launch fails to assign, even once a session exists', async () => {
    const db = await legacyDb(1);
    const decisions = memoryDecisions();
    const failingDb = { ...db, assignUnowned: async () => Promise.reject(new Error('SQLITE_BUSY')) };
    await assert.rejects(new OfflineQueue(failingDb).resolvePreOwnershipRows(null, decisions));

    const queue = new OfflineQueue(db);
    assert.deepEqual(await queue.resolvePreOwnershipRows('user-b', decisions), { owner: ORPHANED_OWNER, count: 1 });
    await queue.setOwner('user-b');
    assert.deepEqual(queue.current(), []);
  });

  it('orphans them when the decision cannot be recorded, rather than leave them claimable', async () => {
    const queue = new OfflineQueue(await legacyDb(1));
    assert.deepEqual(await queue.resolvePreOwnershipRows('user-a', memoryDecisions({ failWrite: true })), {
      owner: ORPHANED_OWNER,
      count: 1,
    });
    await queue.setOwner('user-a');
    assert.deepEqual(queue.current(), []);
  });

  it('orphans them when an earlier decision cannot be read', async () => {
    const queue = new OfflineQueue(await legacyDb(1));
    assert.equal((await queue.resolvePreOwnershipRows('user-b', memoryDecisions({ failRead: true }))).owner, ORPHANED_OWNER);
  });

  it('records the decision even when the sync database cannot open that launch', async () => {
    const db = await legacyDb(1);
    const decisions = memoryDecisions();
    const unopenableDb = { ...db, assignUnowned: async () => Promise.reject(new Error('unable to open database file')) };
    await assert.rejects(new OfflineQueue(unopenableDb).resolvePreOwnershipRows('user-a', decisions));
    assert.equal(decisions.recorded(), 'user-a');

    assert.equal((await new OfflineQueue(db).resolvePreOwnershipRows('user-b', decisions)).owner, 'user-a');
  });
});

describe('OfflineQueue.ownersWithOpenRows', () => {
  it("lists every account with unsynced writes, not just the signed-in one", async () => {
    const queue = new OfflineQueue(memoryQueueDb());
    await queue.setOwner('user-a');
    await queue.enqueue(newEntry());
    await queue.setOwner('user-b');
    const synced = await queue.enqueue(newEntry());
    await queue.markSynced(synced.queueId, 'server-1');

    assert.deepEqual(await queue.ownersWithOpenRows(), ['user-a']);
  });
});
