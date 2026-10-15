import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import type { QueuedMutation, QueueEntity, QueueStatus } from './offlineQueueTypes.ts';
import { DeferredInvalidation, ENTITY_TAGS, heldTags } from './syncTags.ts';

function row(entity: QueueEntity, status: QueueStatus): QueuedMutation {
  return {
    queueId: `${entity}-${status}`,
    entity,
    op: 'create',
    localId: `local-${entity}`,
    serverId: null,
    idempotencyKey: `key-${entity}`,
    payload: {},
    status,
    errorCode: null,
    createdAt: '2026-10-12T00:00:00.000Z',
    updatedAt: '2026-10-12T00:00:00.000Z',
    attempts: 0,
    ownerUserId: 'user-a',
  };
}

describe('heldTags', () => {
  it('holds every tag an open row touches, and none for a synced one', () => {
    assert.deepEqual([...heldTags([row('budget', 'failed'), row('account', 'synced')])].sort(), [...ENTITY_TAGS.budget].sort());
  });
});

describe('DeferredInvalidation', () => {
  it('refreshes what no open row holds, and keeps a held refresh until its row is gone', () => {
    const invalidation = new DeferredInvalidation();
    const stuckBudget = row('budget', 'conflict');

    // An account synced while a budget is stuck: the wallet refreshes, the shared Dashboard waits.
    assert.deepEqual(invalidation.release(ENTITY_TAGS.account, [stuckBudget]).sort(), ['Account', 'Wallet']);
    // The budget is discarded: the deferred Dashboard goes out with the budget's own tags.
    assert.deepEqual(invalidation.release(ENTITY_TAGS.budget, []).sort(), ['Budget', 'Dashboard']);
    assert.deepEqual(invalidation.release([], []), []);
  });
});
