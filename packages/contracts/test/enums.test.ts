import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { REQUIRED_ROLE, WALLET_ROLES, type WalletRole, rankOf, roleSatisfies } from '../src/enums.ts';

describe('roleSatisfies', () => {
  const EXPECTED: Record<WalletRole, Record<WalletRole, boolean>> = {
    OWNER: { OWNER: true, EDITOR: true, VIEWER: true },
    EDITOR: { OWNER: false, EDITOR: true, VIEWER: true },
    VIEWER: { OWNER: false, EDITOR: false, VIEWER: true },
  };

  it('grants a required role to that role and every role above it, and to nothing below', () => {
    for (const actual of WALLET_ROLES) {
      for (const required of WALLET_ROLES) {
        assert.equal(
          roleSatisfies(actual, required),
          EXPECTED[actual][required],
          `${actual} satisfying ${required}`,
        );
      }
    }
  });

  it('denies every requirement to a caller with no membership', () => {
    for (const required of WALLET_ROLES) {
      assert.equal(roleSatisfies(null, required), false, `null satisfying ${required}`);
    }
  });

  it('denies rather than throws when the role is undefined or not a known role', () => {
    // A role read from an untyped source (a stale token, a raw row) must fail closed.
    for (const actual of [undefined, 'ADMIN', 'owner', '']) {
      for (const required of WALLET_ROLES) {
        assert.equal(
          roleSatisfies(actual as unknown as WalletRole, required),
          false,
          `${JSON.stringify(actual)} satisfying ${required}`,
        );
      }
    }
  });
});

describe('rankOf', () => {
  it('orders VIEWER below EDITOR below OWNER', () => {
    assert.ok(rankOf('VIEWER') < rankOf('EDITOR'));
    assert.ok(rankOf('EDITOR') < rankOf('OWNER'));
  });
});

describe('REQUIRED_ROLE', () => {
  it('matches the operation classes in the API specification §2.5', () => {
    assert.deepEqual(REQUIRED_ROLE, { READ: 'VIEWER', WRITE: 'EDITOR', ADMINISTER: 'OWNER' });
  });
});
