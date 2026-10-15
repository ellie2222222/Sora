import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { ABANDONED_MS, decideReplay, RETENTION_MS, type StoredClaim } from '../src/common/idempotency.interceptor.ts';

const NOW = Date.parse('2026-10-12T09:00:00.000Z');
const FINGERPRINT = 'a'.repeat(64);

function claim(overrides: Partial<StoredClaim> = {}): StoredClaim {
  return {
    fingerprint: FINGERPRINT,
    response: null,
    completedAt: null,
    claimedAt: new Date(NOW - 1000),
    createdAt: new Date(NOW - 1000),
    ...overrides,
  };
}

/** The pure half of §2.10; the claim, wait and release against Postgres are in integration.idempotency.test.ts. */
describe('decideReplay (API spec §2.10)', () => {
  it('replays a completed attempt\'s response for the same request', () => {
    const response = { id: 'txn-1' };
    assert.deepEqual(decideReplay(claim({ completedAt: new Date(NOW - 500), response }), FINGERPRINT, NOW), { kind: 'replay', response });
  });

  it('refuses the same key on a different request rather than serving the wrong response', () => {
    assert.deepEqual(decideReplay(claim({ completedAt: new Date(NOW - 500) }), 'b'.repeat(64), NOW), { kind: 'mismatch' });
    assert.deepEqual(decideReplay(claim(), 'b'.repeat(64), NOW), { kind: 'mismatch' });
  });

  it('waits on a first attempt still running, and takes over one that has run too long to be alive', () => {
    assert.deepEqual(decideReplay(claim(), FINGERPRINT, NOW), { kind: 'wait' });
    assert.deepEqual(decideReplay(claim({ claimedAt: new Date(NOW - ABANDONED_MS) }), FINGERPRINT, NOW), { kind: 'take-over-abandoned' });
  });

  it('frees a key past retention for any request, even one with another body', () => {
    const expired = claim({ createdAt: new Date(NOW - RETENTION_MS), completedAt: new Date(NOW - RETENTION_MS) });
    assert.deepEqual(decideReplay(expired, 'b'.repeat(64), NOW), { kind: 'take-over-expired' });
  });
});
