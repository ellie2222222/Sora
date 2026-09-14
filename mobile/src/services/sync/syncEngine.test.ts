/**
 * The FIFO-drain/idempotency/conflict-classification tests for the sync
 * engine — the guard against a queued mutation ever landing twice, or a
 * permission rejection being silently dropped instead of surfaced.
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { ApiError } from '../../utils/errors.ts';
import type { EntityAdapter, EntityAdapters } from './entityAdapters.ts';
import { OfflineQueue } from './offlineQueue.ts';
import { runSyncPass } from './syncEngine.ts';
import { memoryQueueDb, nextId } from './testSupport.ts';
import type { NewQueuedMutation, QueueEntity } from './offlineQueueTypes.ts';

interface Call {
  entity: QueueEntity;
  method: 'create' | 'update' | 'cancelOrArchive';
  args: unknown[];
}

function recordingAdapters(overrides: Partial<Record<QueueEntity, Partial<EntityAdapter>>> = {}): {
  adapters: EntityAdapters;
  calls: Call[];
} {
  const calls: Call[] = [];
  let nextServerId = 1;

  function makeAdapter(entity: QueueEntity): EntityAdapter {
    const base: EntityAdapter = {
      async create(payload, key) {
        calls.push({ entity, method: 'create', args: [payload, key] });
        return { id: `server-${entity}-${nextServerId++}` };
      },
      async update(id, payload, key) {
        calls.push({ entity, method: 'update', args: [id, payload, key] });
      },
      async cancelOrArchive(id, payload, key) {
        calls.push({ entity, method: 'cancelOrArchive', args: [id, payload, key] });
      },
    };
    return { ...base, ...overrides[entity] };
  }

  return {
    calls,
    adapters: {
      transaction: makeAdapter('transaction'),
      account: makeAdapter('account'),
      budget: makeAdapter('budget'),
      goal: makeAdapter('goal'),
      category: makeAdapter('category'),
    },
  };
}

function entry(overrides: Partial<NewQueuedMutation> = {}): NewQueuedMutation {
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

describe('runSyncPass ordering and idempotency', () => {
  it('drains rows FIFO by creation time', async () => {
    const queue = new OfflineQueue(memoryQueueDb());
    const first = await queue.enqueue(entry({ localId: 'a' }));
    await new Promise((resolve) => setTimeout(resolve, 2));
    const second = await queue.enqueue(entry({ localId: 'b' }));

    const { adapters, calls } = recordingAdapters();
    await runSyncPass(queue, adapters);

    assert.deepEqual(
      calls.map((call) => call.args[0]),
      [first.payload, second.payload],
    );
  });

  it('reuses the same idempotency key across a retry', async () => {
    const queue = new OfflineQueue(memoryQueueDb());
    const mutation = await queue.enqueue(entry());

    let attempt = 0;
    const { adapters, calls } = recordingAdapters({
      transaction: {
        async create(payload, key) {
          calls.push({ entity: 'transaction', method: 'create', args: [payload, key] });
          attempt += 1;
          if (attempt === 1) throw new ApiError('INTERNAL_ERROR', 'timeout', 0);
          return { id: 'server-1' };
        },
      },
    });

    const first = await runSyncPass(queue, adapters);
    assert.equal(first.stoppedOnNetworkError, true);
    assert.equal(queue.current()[0]?.status, 'pending');

    const second = await runSyncPass(queue, adapters);
    assert.equal(second.synced.length, 1);

    assert.equal(calls[0]?.args[1], mutation.idempotencyKey);
    assert.equal(calls[1]?.args[1], mutation.idempotencyKey);
  });
});

describe('runSyncPass failure classification', () => {
  it('a 403 marks conflict, not failed, and never removes the row', async () => {
    const queue = new OfflineQueue(memoryQueueDb());
    await queue.enqueue(entry());

    const { adapters } = recordingAdapters({
      transaction: {
        async create() {
          throw new ApiError('FORBIDDEN', 'not allowed', 403);
        },
      },
    });

    const result = await runSyncPass(queue, adapters);

    assert.equal(result.conflicted.length, 1);
    assert.equal(queue.current()[0]?.status, 'conflict');
    assert.equal(queue.current()[0]?.errorCode, 'FORBIDDEN');
  });

  it('a 409 marks failed, and leaves the row for a manual retry', async () => {
    const queue = new OfflineQueue(memoryQueueDb());
    await queue.enqueue(entry({ entity: 'transaction', op: 'cancel', serverId: 'server-1', localId: 'server-1' }));

    const { adapters } = recordingAdapters({
      transaction: {
        async cancelOrArchive() {
          throw new ApiError('TRANSACTION_ALREADY_CANCELLED', 'already cancelled', 409);
        },
      },
    });

    const result = await runSyncPass(queue, adapters);

    assert.equal(result.failed.length, 1);
    assert.equal(queue.current()[0]?.status, 'failed');
  });

  it('a network error leaves the row pending and stops the rest of the pass', async () => {
    const queue = new OfflineQueue(memoryQueueDb());
    await queue.enqueue(entry({ localId: 'a' }));
    await queue.enqueue(entry({ localId: 'b' }));

    const { adapters, calls } = recordingAdapters({
      transaction: {
        async create(payload, key) {
          calls.push({ entity: 'transaction', method: 'create', args: [payload, key] });
          throw new Error('network request failed');
        },
      },
    });

    const result = await runSyncPass(queue, adapters);

    assert.equal(result.stoppedOnNetworkError, true);
    assert.equal(calls.length, 1);
    assert.equal(queue.current().every((row) => row.status === 'pending'), true);
  });
});

describe('runSyncPass concurrency lock', () => {
  it('a second concurrent pass is a no-op while one is in flight', async () => {
    const queue = new OfflineQueue(memoryQueueDb());
    await queue.enqueue(entry());

    let resolveCreate!: (value: { id: string }) => void;
    let notifyStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      notifyStarted = resolve;
    });
    const { adapters, calls } = recordingAdapters({
      transaction: {
        create: (payload, key) => {
          calls.push({ entity: 'transaction', method: 'create', args: [payload, key] });
          notifyStarted();
          return new Promise((resolve) => {
            resolveCreate = resolve;
          });
        },
      },
    });

    const firstPass = runSyncPass(queue, adapters);
    // Only race the second pass in once the first has actually reached the
    // in-flight HTTP call — otherwise this test would depend on microtask
    // ordering between the two `runSyncPass` calls instead of on the lock.
    await started;
    const secondPass = await runSyncPass(queue, adapters);

    assert.deepEqual(secondPass, {
      synced: [],
      conflicted: [],
      failed: [],
      deferred: [],
      stoppedOnNetworkError: false,
    });

    resolveCreate({ id: 'server-1' });
    await firstPass;
    assert.equal(calls.length, 1);
  });
});

describe('runSyncPass cross-entity FK resolution', () => {
  it('resolves a transaction referencing its own account, synced earlier in the same FIFO pass', async () => {
    const queue = new OfflineQueue(memoryQueueDb());
    await queue.enqueue(
      entry({ entity: 'account', localId: 'local-account', payload: { name: 'Cash' } }),
    );
    await new Promise((resolve) => setTimeout(resolve, 2));
    await queue.enqueue(
      entry({
        entity: 'transaction',
        localId: 'local-txn',
        payload: { fromAccountId: 'local-account', amount: '5.0000' },
      }),
    );

    let accountSynced = false;
    const { adapters, calls } = recordingAdapters({
      account: {
        async create(payload, key) {
          calls.push({ entity: 'account', method: 'create', args: [payload, key] });
          accountSynced = true;
          return { id: 'server-account-1' };
        },
      },
      transaction: {
        async create(payload, key) {
          if (!accountSynced) throw new Error('should not fire before the account synced');
          calls.push({ entity: 'transaction', method: 'create', args: [payload, key] });
          return { id: 'server-txn-1' };
        },
      },
    });

    const result = await runSyncPass(queue, adapters);

    // FIFO order resolves both in one pass: the account's row is processed
    // (and its serverId recorded) before the transaction row that references it.
    assert.equal(result.synced.length, 2);
    assert.equal(result.deferred.length, 0);

    const txnCall = calls.find((call) => call.entity === 'transaction');
    assert.deepEqual((txnCall?.args[0] as { fromAccountId: string }).fromAccountId, 'server-account-1');
  });

  it('defers a row whose referenced local id belongs to an entry not yet in the queue at all', async () => {
    const queue = new OfflineQueue(memoryQueueDb());
    await queue.enqueue(
      entry({
        entity: 'transaction',
        localId: 'local-txn',
        payload: { fromAccountId: 'never-enqueued-yet', amount: '5.0000' },
      }),
    );

    // Simulate a still-pending sibling row directly via the queue, so the
    // reference is recognized but unresolved (not simply "unknown id").
    const pendingAccount = await queue.enqueue(
      entry({ entity: 'account', localId: 'never-enqueued-yet', payload: { name: 'Cash' } }),
    );
    await queue.markSyncing(pendingAccount.queueId); // still not `synced`

    const { adapters } = recordingAdapters({
      transaction: {
        async create() {
          throw new Error('should not fire while its account reference is unresolved');
        },
      },
    });

    const result = await runSyncPass(queue, adapters);
    assert.equal(result.deferred.length, 1);
    assert.equal(result.synced.length, 0);
  });
});
