import { strict as assert } from 'node:assert';
import { beforeEach, describe, it } from 'node:test';

import { isGuestData, loadGuestFixture } from './guestFixture.ts';
import { guestStore } from './guestStorage.ts';
import { emptyUploadProgress, type GuestData } from './guestStore.ts';
import { WALLET_ID, seedFixture, withFreshStore } from './testSupport.ts';

function fixture(): GuestData {
  return {
    wallet: { id: 'demo-wallet', name: 'Ví của An', timeZone: 'Asia/Ho_Chi_Minh', createdAt: '2026-10-07T00:00:00.000Z', updatedAt: '2026-10-07T00:00:00.000Z' },
    accounts: [],
    categories: [],
    transactions: [],
    budgets: [],
    goals: [],
    contributions: [],
    uploadProgress: emptyUploadProgress('server-wallet'),
    starterCategoriesVersion: 2,
  };
}

describe('guest demo fixture', () => {
  beforeEach(async () => {
    await withFreshStore();
    await seedFixture();
  });

  it('replaces the guest ledger and drops upload progress made for another one', async () => {
    assert.equal(guestStore.current().wallet?.id, WALLET_ID);
    await loadGuestFixture(fixture());
    assert.equal(guestStore.current().wallet?.id, 'demo-wallet');
    assert.equal(guestStore.current().uploadProgress, null);
  });

  it('refuses anything that is not a GuestData blob and keeps the ledger', async () => {
    for (const value of [null, 'text', [], { ...fixture(), wallet: null }, { ...fixture(), transactions: {} }, { ...fixture(), starterCategoriesVersion: '2' }]) {
      assert.equal(isGuestData(value), false);
      await assert.rejects(loadGuestFixture(value));
    }
    assert.equal(guestStore.current().wallet?.id, WALLET_ID);
  });
});
