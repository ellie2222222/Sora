import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { requestFingerprint, RetryKeys, UNANSWERED_KEY_TTL_MS } from './retryKeys.ts';

function keys() {
  let minted = 0;
  let clock = 1_000;
  const retryKeys = new RetryKeys(
    () => `key-${++minted}`,
    () => clock,
  );
  return { retryKeys, advance: (ms: number) => (clock += ms) };
}

const CREATE = requestFingerprint('post', '/api/v1/transactions', { amount: '150000', description: 'Lunch' });

describe('RetryKeys', () => {
  it('sends an identical request again under the key of the attempt that got no answer', () => {
    const { retryKeys } = keys();
    assert.equal(retryKeys.keyFor(CREATE), 'key-1');
    assert.equal(retryKeys.keyFor(CREATE), 'key-1');
  });

  it('gives a fresh key once the server answered, so a deliberate second identical entry is recorded', () => {
    const { retryKeys } = keys();
    retryKeys.keyFor(CREATE);
    retryKeys.answered(CREATE);
    assert.equal(retryKeys.keyFor(CREATE), 'key-2');
  });

  it('gives a different request its own key', () => {
    const { retryKeys } = keys();
    retryKeys.keyFor(CREATE);
    const edited = requestFingerprint('POST', '/api/v1/transactions', { amount: '160000', description: 'Lunch' });
    assert.equal(retryKeys.keyFor(edited), 'key-2');
  });

  it('stops reusing a key before the server would have purged it', () => {
    const { retryKeys, advance } = keys();
    retryKeys.keyFor(CREATE);
    advance(UNANSWERED_KEY_TTL_MS);
    assert.equal(retryKeys.keyFor(CREATE), 'key-2');
  });

  it('fingerprints a body sent pre-serialised the same as the object', () => {
    const body = { amount: '1' };
    assert.equal(requestFingerprint('POST', '/x', body), requestFingerprint('POST', '/x', JSON.stringify(body)));
  });
});
