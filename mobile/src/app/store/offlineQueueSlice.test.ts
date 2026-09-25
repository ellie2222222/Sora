import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import type { QueuedMutation, QueueStatus } from '../../services/sync/offlineQueueTypes.ts';
import type { RootState } from './index.ts';
import reducer, {
  queueRowsReplaced,
  selectPendingCount,
  selectQueueEntryFor,
  selectSyncStatus,
} from './offlineQueueSlice.ts';

let sequence = 0;

function row(status: QueueStatus, overrides: Partial<QueuedMutation> = {}): QueuedMutation {
  sequence += 1;
  const createdAt = new Date(Date.UTC(2026, 8, 25, 0, 0, sequence)).toISOString();
  return {
    queueId: `q-${sequence}`,
    entity: 'transaction',
    op: 'create',
    localId: `local-${sequence}`,
    serverId: null,
    idempotencyKey: `key-${sequence}`,
    payload: {},
    status,
    errorCode: null,
    createdAt,
    updatedAt: createdAt,
    attempts: 0,
    ownerUserId: 'user-1',
    ...overrides,
  };
}

function stateWith(rows: QueuedMutation[]): RootState {
  return { offlineQueue: reducer(undefined, queueRowsReplaced(rows)) } as unknown as RootState;
}

describe('selectSyncStatus', () => {
  it('reads as synced for an empty or fully synced queue', () => {
    assert.equal(selectSyncStatus(stateWith([])), 'synced');
    assert.equal(selectSyncStatus(stateWith([row('synced'), row('synced')])), 'synced');
  });

  it('ranks an active pass above a failure, a failure above a queued row', () => {
    assert.equal(selectSyncStatus(stateWith([row('pending'), row('failed'), row('syncing')])), 'syncing');
    assert.equal(selectSyncStatus(stateWith([row('pending'), row('failed'), row('synced')])), 'failed');
    assert.equal(selectSyncStatus(stateWith([row('synced'), row('pending')])), 'pending');
  });

  it('reports a conflict as failed, since both need the user', () => {
    assert.equal(selectSyncStatus(stateWith([row('pending'), row('conflict')])), 'failed');
  });
});

describe('selectPendingCount', () => {
  it('counts rows still waiting or in flight, not settled or stuck ones', () => {
    const state = stateWith([row('pending'), row('syncing'), row('synced'), row('failed'), row('conflict')]);
    assert.equal(selectPendingCount(state), 2);
  });
});

describe('selectQueueEntryFor', () => {
  it('matches on both entity and local id', () => {
    const account = row('pending', { entity: 'account', localId: 'shared-id' });
    const transaction = row('failed', { entity: 'transaction', localId: 'shared-id' });
    const state = stateWith([account, transaction]);

    assert.equal(selectQueueEntryFor('transaction', 'shared-id')(state), transaction);
    assert.equal(selectQueueEntryFor('account', 'shared-id')(state), account);
    assert.equal(selectQueueEntryFor('budget', 'shared-id')(state), null);
  });

  // Pins current behaviour: rows arrive oldest-first and synced rows stay in the queue,
  // so a synced create shadows a later still-pending update of the same record.
  it('returns the oldest row for a record, even when a newer one is still open', () => {
    const create = row('synced', { localId: 'tx-1', op: 'create' });
    const update = row('pending', { localId: 'tx-1', op: 'update' });

    assert.equal(selectQueueEntryFor('transaction', 'tx-1')(stateWith([create, update])), create);
  });
});
