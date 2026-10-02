import { strict as assert } from 'node:assert';
import { beforeEach, describe, it } from 'node:test';

import { guestAccountsApi } from './guestAccounts.ts';
import { guestGoalsApi } from './guestGoals.ts';
import { guestTransactionsApi } from './guestTransactions.ts';
import { ACCOUNT_ID, codeOf, EXPENSE_CATEGORY_ID, OTHER_ACCOUNT_ID, seedFixture, WALLET_ID, withFreshStore } from './testSupport.ts';

const DATE = '2026-09-05T10:00:00.000Z';

beforeEach(async () => {
  await withFreshStore();
  await seedFixture();
});

describe('guestAccountsApi.update — ACC-US-04', () => {
  it('changes currency only while no transaction or contribution names the account (API spec §9.4)', async () => {
    const empty = await guestAccountsApi.create({ walletId: WALLET_ID, name: 'Fresh', type: 'CASH', currency: 'VND', initialBalance: '0' });
    assert.equal((await guestAccountsApi.update(empty.id, { currency: 'USD' })).currency, 'USD');

    await guestTransactionsApi.create({
      type: 'EXPENSE',
      fromAccountId: ACCOUNT_ID,
      categoryId: EXPENSE_CATEGORY_ID,
      amount: '1',
      currency: 'VND',
      transactionDate: DATE,
      status: 'COMPLETED',
    });
    const goal = await guestGoalsApi.create({ walletId: WALLET_ID, name: 'Trip', targetAmount: '100', currency: 'VND' });
    await guestGoalsApi.addContribution(goal.id, { accountId: OTHER_ACCOUNT_ID, amount: '5', currency: 'VND', contributionDate: DATE, recordAsTransaction: false });

    for (const accountId of [ACCOUNT_ID, OTHER_ACCOUNT_ID]) {
      assert.equal(await codeOf(() => guestAccountsApi.update(accountId, { currency: 'USD' })), 'ACCOUNT_CURRENCY_MISMATCH');
    }
  });
});
