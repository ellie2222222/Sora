import { strict as assert } from 'node:assert';
import { beforeEach, describe, it } from 'node:test';

import { guestBudgetsApi } from './guestBudgets.ts';
import { guestCategoriesApi } from './guestCategories.ts';
import { guestStore } from './guestStorage.ts';
import { guestTransactionsApi } from './guestTransactions.ts';
import { ACCOUNT_ID, codeOf, EXPENSE_CATEGORY_ID, seedFixture, WALLET_ID, withFreshStore } from './testSupport.ts';

const SEPTEMBER = {
  walletId: WALLET_ID,
  categoryId: EXPENSE_CATEGORY_ID,
  name: 'Food, September',
  amount: '1000000',
  currency: 'VND',
  periodType: 'CUSTOM' as const,
  startDate: '2026-09-01',
  endDate: '2026-09-30',
};

const MONTHLY = { ...SEPTEMBER, name: 'Food', periodType: 'MONTHLY' as const, endDate: null };

beforeEach(async () => {
  await withFreshStore();
  await seedFixture();
});

describe('guestBudgetsApi — an archived category', () => {
  it('refuses a budget on it, as the server does under its category lock', async () => {
    await guestCategoriesApi.archive(EXPENSE_CATEGORY_ID);
    assert.equal(await codeOf(() => guestBudgetsApi.create(SEPTEMBER)), 'CATEGORY_ARCHIVED');
  });
});

describe('guestBudgetsApi.delete', () => {
  it('removes the budget and frees its window for a new one', async () => {
    const first = await guestBudgetsApi.create(SEPTEMBER);
    await guestBudgetsApi.delete(first.id);

    assert.equal(await codeOf(() => guestBudgetsApi.detail(first.id)), 'BUDGET_NOT_FOUND');
    assert.equal(guestStore.current().budgets.length, 0);
    const replacement = await guestBudgetsApi.create({ ...SEPTEMBER, name: 'Food, September (again)' });
    assert.equal(replacement.name, 'Food, September (again)');
  });
});

describe('guestBudgetsApi — a repeating budget', () => {
  it('counts each month on its own, from its start onward, as the server does', async () => {
    await guestTransactionsApi.create({
      type: 'EXPENSE', fromAccountId: ACCOUNT_ID, categoryId: EXPENSE_CATEGORY_ID, amount: '100', currency: 'VND',
      transactionDate: '2026-09-10T09:00:00.000Z', status: 'COMPLETED',
    });
    await guestTransactionsApi.create({
      type: 'EXPENSE', fromAccountId: ACCOUNT_ID, categoryId: EXPENSE_CATEGORY_ID, amount: '30', currency: 'VND',
      transactionDate: '2027-01-05T09:00:00.000Z', status: 'COMPLETED',
    });
    const created = await guestBudgetsApi.create(MONTHLY);
    assert.equal(created.endDate, null);

    const [september] = await guestBudgetsApi.list({ walletId: WALLET_ID, activeOn: '2026-09-20' });
    assert.deepEqual([september?.periodStart, september?.periodEnd, september?.spent], ['2026-09-01', '2026-09-30', '100.0000']);
    const [january] = await guestBudgetsApi.list({ walletId: WALLET_ID, activeOn: '2027-01-31' });
    assert.deepEqual([january?.periodStart, january?.periodEnd, january?.spent], ['2027-01-01', '2027-01-31', '30.0000']);
    assert.deepEqual(await guestBudgetsApi.list({ walletId: WALLET_ID, activeOn: '2026-08-31' }), []);
  });

  it('holds its category from its start onward, so a later fixed budget on it overlaps', async () => {
    await guestBudgetsApi.create(MONTHLY);
    const later = { ...SEPTEMBER, startDate: '2028-03-01', endDate: '2028-03-31' };
    assert.equal(await codeOf(() => guestBudgetsApi.create(later)), 'BUDGET_PERIOD_OVERLAP');
  });
});
