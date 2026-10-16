import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { setDeviceOnline } from '../../utils/deviceConnectivity.ts';
import { ApiError } from '../../utils/errors.ts';
import { chatKey, failureOf, isInFlight, NEW_CHAT, newRequestId, retryExchange, startExchange, withExchange, type PendingExchange } from './chatExchange.ts';

const t = (key: string) => key;
const message = { text: 'How much did I spend?', walletId: 'w1', locale: 'en' as const };

describe('chat exchange lifecycle', () => {
  it('starts by creating the chat when there is none, else waits on the answer at once', () => {
    assert.equal(startExchange(message, null).stage, 'starting');
    assert.equal(startExchange(message, 'c1').stage, 'waiting');
  });

  it('blocks a second send while one is out, but not after it failed', () => {
    const out = startExchange(message, 'c1');
    assert.equal(isInFlight(null), false);
    assert.equal(isInFlight(out), true);
    assert.equal(isInFlight({ ...out, stage: 'slow' }), true);
    assert.equal(isInFlight({ ...out, stage: 'failed', failure: { message: 'x', retryable: true } }), false);
  });

  it('retries the identical request in the chat it was created in, so the Idempotency-Key is reused', () => {
    const failed: PendingExchange = { ...startExchange(message, null), conversationId: 'c-created', stage: 'failed', failure: { message: 'x', retryable: true } };
    const retry = retryExchange(failed);
    assert.deepEqual(
      { text: retry.text, walletId: retry.walletId, locale: retry.locale, conversationId: retry.conversationId, stage: retry.stage, failure: retry.failure },
      { ...message, conversationId: 'c-created', stage: 'waiting', failure: null },
    );
  });

  it("keeps one exchange per chat, so a send in one chat never replaces another chat's unsent message", () => {
    const failedInA: PendingExchange = { ...startExchange(message, 'a'), stage: 'failed', failure: { message: 'x', retryable: true } };
    let all = withExchange({}, chatKey('a'), failedInA);
    all = withExchange(all, chatKey('b'), startExchange({ ...message, text: 'other' }, 'b'));
    assert.equal(all.a, failedInA);
    assert.equal(all.b?.text, 'other');
    all = withExchange(all, chatKey('b'), null);
    assert.deepEqual(Object.keys(all), ['a']);
    assert.equal(chatKey(null), NEW_CHAT);
  });

  it('times a retry from the retry, not from the first attempt', () => {
    const first = startExchange(message, 'c1', 1_000);
    assert.ok(retryExchange({ ...first, stage: 'failed' }).startedAt > first.startedAt);
  });

  it('mints request ids the API accepts as x-request-id', () => {
    for (let i = 0; i < 20; i++) assert.match(newRequestId(), /^[A-Za-z0-9-]{8,64}$/);
  });
});

describe('failureOf', () => {
  it('offers Retry for provider trouble, with a line naming which', () => {
    assert.deepEqual(failureOf(new ApiError('AI_PROVIDER_UNAVAILABLE', 'x', 503), t), { message: 'ai.failure.unavailable', retryable: true });
    assert.deepEqual(failureOf(new ApiError('AI_PROVIDER_BUSY', 'x', 503), t), { message: 'ai.failure.busy', retryable: true });
    assert.deepEqual(failureOf(new ApiError('AI_PROVIDER_TIMEOUT', 'x', 504), t), { message: 'ai.failure.timeout', retryable: true });
    assert.deepEqual(failureOf(new ApiError('IDEMPOTENCY_KEY_IN_USE', 'x', 409), t), { message: 'ai.failure.stillWorking', retryable: true });
  });

  it('tells a client timeout, being offline and an unreachable server apart, and offers Retry for each', () => {
    const noResponse = new ApiError('INTERNAL_ERROR', 'Network Error', 0);
    assert.deepEqual(failureOf(new ApiError('INTERNAL_ERROR', 'timeout of 40000ms exceeded', 0), t), { message: 'ai.failure.noAnswer', retryable: true });
    setDeviceOnline(false);
    assert.deepEqual(failureOf(noResponse, t), { message: 'ai.failure.offline', retryable: true });
    setDeviceOnline(true);
    assert.deepEqual(failureOf(noResponse, t), { message: 'ai.failure.unreachable', retryable: true });
  });

  it('offers only Edit when the same request would be refused again', () => {
    const failure = failureOf(new ApiError('VALIDATION_FAILED', 'x', 422), t);
    assert.equal(failure.retryable, false);
  });
});
