import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { WALLET_ROLES, type WalletRole } from '@sora/contracts';

import { canTransferBetween, getRoleLabel, permissionsFor } from './roles.ts';

describe('permissionsFor', () => {
  it('grants each role exactly its own tier and everything below it', () => {
    assert.deepEqual(permissionsFor('OWNER'), { canRead: true, canWrite: true, canAdminister: true });
    assert.deepEqual(permissionsFor('EDITOR'), { canRead: true, canWrite: true, canAdminister: false });
    assert.deepEqual(permissionsFor('VIEWER'), { canRead: true, canWrite: false, canAdminister: false });
  });

  it('grants nothing without a membership', () => {
    assert.deepEqual(permissionsFor(null), { canRead: false, canWrite: false, canAdminister: false });
  });

  it('fails closed for a role this build does not know', () => {
    const fromNewerServer = 'AUDITOR' as WalletRole;
    assert.deepEqual(permissionsFor(fromNewerServer), { canRead: false, canWrite: false, canAdminister: false });
  });
});

describe('canTransferBetween — BR-02', () => {
  it('requires write access on both wallets, whichever side is short', () => {
    const writers = new Set<WalletRole>(['OWNER', 'EDITOR']);
    for (const from of [...WALLET_ROLES, null]) {
      for (const to of [...WALLET_ROLES, null]) {
        const expected = from !== null && to !== null && writers.has(from) && writers.has(to);
        assert.equal(canTransferBetween(from, to), expected, `${from} -> ${to}`);
      }
    }
  });

  it('refuses pushing money into a wallet the caller can only view', () => {
    assert.equal(canTransferBetween('OWNER', 'VIEWER'), false);
    assert.equal(canTransferBetween('VIEWER', 'OWNER'), false);
  });
});

describe('getRoleLabel', () => {
  it('uses the translation when one exists and the English label when t echoes the key back', () => {
    assert.equal(getRoleLabel('EDITOR', (key) => (key === 'roles.editor' ? 'Người chỉnh sửa' : key)), 'Người chỉnh sửa');
    assert.equal(getRoleLabel('OWNER', (key) => key), 'Owner');
  });
});
