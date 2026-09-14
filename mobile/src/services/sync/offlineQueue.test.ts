import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { OfflineQueue } from './offlineQueue.ts';
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
    const mutation = await queue.enqueue(newEntry());

    await queue.markConflict(mutation.queueId, 'FORBIDDEN');

    const row = queue.current()[0]!;
    assert.equal(row.status, 'conflict');
    assert.equal(row.errorCode, 'FORBIDDEN');
  });

  it('markFailed increments attempts without deleting the row', async () => {
    const queue = new OfflineQueue(memoryQueueDb());
    const mutation = await queue.enqueue(newEntry());

    await queue.markFailed(mutation.queueId, 'TRANSACTION_IMMUTABLE', 1);

    const row = queue.current()[0]!;
    assert.equal(row.status, 'failed');
    assert.equal(row.attempts, 1);
  });
});

describe('OfflineQueue.pendingCount', () => {
  it('counts pending and syncing rows, not synced/failed/conflict ones', async () => {
    const queue = new OfflineQueue(memoryQueueDb());
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
    const mutation = await queue.enqueue(newEntry({ localId: 'local-42' }));

    assert.equal(queue.statusFor('transaction', 'local-42'), 'pending');
    assert.equal(queue.statusFor('transaction', 'missing'), undefined);

    const found = await queue.findByLocalId('transaction', 'local-42');
    assert.equal(found?.queueId, mutation.queueId);
  });
});
