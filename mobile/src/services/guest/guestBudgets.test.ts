import { strict as assert } from 'node:assert';
import { beforeEach, describe, it } from 'node:test';

import { BudgetStatus } from '@sora/contracts';

import { guestBudgetsApi } from './guestBudgets.ts';
import { guestCategoriesApi } from './guestCategories.ts';
import { codeOf, EXPENSE_CATEGORY_ID, seedFixture, WALLET_ID, withFreshStore } from './testSupport.ts';

const SEPTEMBER = {
  walletId: WALLET_ID,
  categoryId: EXPENSE_CATEGORY_ID,
  name: 'Food, September',
  amount: '1000000',
  currency: 'VND',
  periodType: 'MONTHLY' as const,
  startDate: '2026-09-01',
  endDate: '2026-09-30',
};

beforeEach(async () => {
  await withFreshStore();
  await seedFixture();
});

describe('guestBudgetsApi — an archived category', () => {
  it('refuses a budget on it, as the server does under its category lock', async () => {
    await guestCategoriesApi.archive(EXPENSE_CATEGORY_ID);
    assert.equal(await codeOf(() => guestBudgetsApi.create(SEPTEMBER)), 'CATEGORY_ARCHIVED');
  });

  it('refuses reactivating a budget whose category was archived meanwhile', async () => {
    const budget = await guestBudgetsApi.create(SEPTEMBER);
    await guestBudgetsApi.archive(budget.id);
    await guestCategoriesApi.archive(EXPENSE_CATEGORY_ID);

    const code = await codeOf(() => guestBudgetsApi.update(budget.id, { status: BudgetStatus.ACTIVE }));
    assert.equal(code, 'CATEGORY_ARCHIVED');
  });
});

describe('guestBudgetsApi.update — reactivation', () => {
  it('refuses a reactivation that would overlap the active budget now holding its window', async () => {
    const first = await guestBudgetsApi.create(SEPTEMBER);
    await guestBudgetsApi.archive(first.id);
    await guestBudgetsApi.create({ ...SEPTEMBER, name: 'Food, September (replacement)' });

    const code = await codeOf(() => guestBudgetsApi.update(first.id, { status: BudgetStatus.ACTIVE }));
    assert.equal(code, 'BUDGET_PERIOD_OVERLAP');
  });

  it('reactivates a budget whose window is free again', async () => {
    const budget = await guestBudgetsApi.create(SEPTEMBER);
    await guestBudgetsApi.archive(budget.id);

    const reactivated = await guestBudgetsApi.update(budget.id, { status: BudgetStatus.ACTIVE });
    assert.equal(reactivated.status, BudgetStatus.ACTIVE);
  });
});
