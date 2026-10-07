import { strict as assert } from 'node:assert';
import { beforeEach, describe, it } from 'node:test';

import type { CreateTransactionRequest } from '@sora/contracts';

import { guestBudgetsApi } from './guestBudgets.ts';
import { guestDashboardApi } from './guestDashboard.ts';
import { guestStore } from './guestStorage.ts';
import { guestTransactionsApi } from './guestTransactions.ts';
import { guestWalletsApi } from './guestWallets.ts';
import { ACCOUNT_ID, EXPENSE_CATEGORY_ID, WALLET_ID, seedFixture, withFreshStore } from './testSupport.ts';

const spend = (transactionDate: string, amount: string): CreateTransactionRequest =>
  ({
    type: 'EXPENSE',
    fromAccountId: ACCOUNT_ID,
    categoryId: EXPENSE_CATEGORY_ID,
    amount,
    currency: 'VND',
    transactionDate,
    status: 'COMPLETED',
  }) as CreateTransactionRequest;

describe('guest wallet calendar zone', () => {
  beforeEach(async () => {
    await withFreshStore();
    await seedFixture();
    await guestStore.mutate((data) => ({ ...data, wallet: { ...data.wallet!, timeZone: 'Asia/Ho_Chi_Minh' } }));
  });

  it('reports its zone on the wallet', async () => {
    assert.equal((await guestWalletsApi.detail(WALLET_ID)).timeZone, 'Asia/Ho_Chi_Minh');
  });

  it('files 23:30Z on Oct 31 under November 1: list filter, dashboard month and budget', async () => {
    await guestTransactionsApi.create(spend('2026-10-31T16:59:00.000Z', '1')); // 23:59 Oct 31 there
    await guestTransactionsApi.create(spend('2026-10-31T23:30:00.000Z', '100')); // 06:30 Nov 1 there

    const nov1 = await guestTransactionsApi.list({ dateFrom: '2026-11-01', dateTo: '2026-11-01' });
    assert.deepEqual(nov1.items.map((row) => row.amount), ['100']);

    const november = await guestDashboardApi.summary({ walletId: WALLET_ID, dateFrom: '2026-11-01', dateTo: '2026-11-30' });
    assert.deepEqual(november.expense, [{ currency: 'VND', amount: '100.0000' }]);
    assert.equal(november.period.timeZone, 'Asia/Ho_Chi_Minh');

    const budget = await guestBudgetsApi.create({
      walletId: WALLET_ID,
      categoryId: EXPENSE_CATEGORY_ID,
      name: 'November',
      amount: '1000',
      currency: 'VND',
      periodType: 'CUSTOM',
      startDate: '2026-11-01',
      endDate: '2026-11-30',
    });
    assert.equal(budget.spent, '100.0000');
    assert.equal(budget.timeZone, 'Asia/Ho_Chi_Minh');
  });
});
