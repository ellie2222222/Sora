import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { RetryKeys } from '../api/retryKeys.ts';
import { sendOrQueueWith, type SendOrQueueDeps } from './sendOrQueue.ts';

const unanswered = Object.assign(new Error('Network Error'), { unanswered: true });
const row = { entity: 'transaction' as const, op: 'create' as const, localId: 'local-1', serverId: null, payload: { amount: '5' } };

function harness(online: boolean) {
  const flags: boolean[] = [];
  const queued: { idempotencyKey: string }[] = [];
  let state = online;
  let minted = 0;
  const deps: SendOrQueueDeps = {
    isOnline: () => state,
    setOnline: (value) => {
      state = value;
      flags.push(value);
    },
    isNetworkError: (error) => (error as { unanswered?: boolean }).unanswered === true,
    keys: new RetryKeys(() => `key-${++minted}`),
    enqueue: async (queuedRow) => {
      queued.push(queuedRow);
    },
  };
  return { deps, flags, queued };
}

describe('sendOrQueueWith', () => {
  it('sends while online with a pinned key, and queues nothing', async () => {
    const { deps, queued, flags } = harness(true);
    const keys: string[] = [];
    const result = await sendOrQueueWith(deps, row, async (key) => (keys.push(key), 'server'), () => 'optimistic');
    assert.equal(result, 'server');
    assert.deepEqual(keys, ['key-1']);
    assert.equal(queued.length, 0);
    assert.deepEqual(flags, [true]);
  });

  it('queues straight away while offline, without trying the API', async () => {
    const { deps, queued } = harness(false);
    let sent = false;
    const result = await sendOrQueueWith(deps, row, async () => ((sent = true), 'server'), () => 'optimistic');
    assert.equal(result, 'optimistic');
    assert.equal(sent, false);
    assert.deepEqual(queued, [{ ...row, idempotencyKey: 'key-1' }]);
  });

  it('queues an unanswered write under the key it was sent with, so a replay cannot double-record', async () => {
    const { deps, queued, flags } = harness(true);
    let sentWith: string | undefined;
    const result = await sendOrQueueWith(
      deps,
      row,
      async (key) => {
        sentWith = key;
        throw unanswered;
      },
      () => 'optimistic',
    );
    assert.equal(result, 'optimistic');
    assert.equal(queued[0]?.idempotencyKey, sentWith);
    assert.deepEqual(flags, [false], 'later writes queue without waiting on the timeout again');
  });

  it('gives a double-tapped identical write the same key while the first is in flight, so it records once', async () => {
    const { deps } = harness(true);
    const keys: string[] = [];
    let answer = () => undefined as void;
    const first = sendOrQueueWith(deps, row, (key) => (keys.push(key), new Promise<string>((resolve) => (answer = () => resolve('server')))), () => 'optimistic');
    const second = sendOrQueueWith(deps, { ...row, localId: 'local-2' }, async (key) => (keys.push(key), 'server'), () => 'optimistic');
    answer();
    await Promise.all([first, second]);
    assert.deepEqual(keys, ['key-1', 'key-1']);
  });

  it('gives an identical write made after the first was answered or queued a fresh key: it is a new one', async () => {
    const online = harness(true);
    const keys: string[] = [];
    await sendOrQueueWith(online.deps, row, async (key) => (keys.push(key), 'server'), () => 'optimistic');
    await sendOrQueueWith(online.deps, row, async (key) => (keys.push(key), 'server'), () => 'optimistic');
    assert.deepEqual(keys, ['key-1', 'key-2']);

    const offline = harness(false);
    await sendOrQueueWith(offline.deps, row, async () => 'server', () => 'optimistic');
    await sendOrQueueWith(offline.deps, row, async () => 'server', () => 'optimistic');
    assert.deepEqual(offline.queued.map((queued) => queued.idempotencyKey), ['key-1', 'key-2']);
  });

  it('surfaces a refusal to the caller and queues nothing', async () => {
    const { deps, queued, flags } = harness(true);
    const refusal = Object.assign(new Error('422'), { code: 'VALIDATION_FAILED' });
    await assert.rejects(sendOrQueueWith(deps, row, async () => { throw refusal; }, () => 'optimistic'), refusal);
    assert.equal(queued.length, 0);
    assert.deepEqual(flags, []);
  });
});
