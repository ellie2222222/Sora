import { strict as assert } from 'node:assert';
import { beforeEach, describe, it } from 'node:test';

import {
  AccountStatus,
  AccountType,
  CategoryStatus,
  CategoryType,
  ValuationStatus,
  parseMoney,
  percentageOf,
  type CreateTransactionRequest,
} from '@sora/contracts';

import { isApiError } from '../../utils/errors.ts';
import { guestDashboardApi } from './guestDashboard.ts';
import { guestStore } from './guestStorage.ts';
import { guestTransactionsApi } from './guestTransactions.ts';
import {
  ACCOUNT_ID,
  EXPENSE_CATEGORY_ID,
  INCOME_CATEGORY_ID,
  OTHER_ACCOUNT_ID,
  WALLET_ID,
  seedFixture,
  withFreshStore,
} from './testSupport.ts';

const USD_ACCOUNT_ID = '3f1a7c62-0000-4000-8000-000000000010';
const TRANSPORT_CATEGORY_ID = '3f1a7c62-0000-4000-8000-000000000011';
const SEPTEMBER = { walletId: WALLET_ID, dateFrom: '2026-09-01', dateTo: '2026-09-30' };
const NOW = '2026-09-01T00:00:00.000Z';

function expense(overrides: Partial<CreateTransactionRequest> = {}): CreateTransactionRequest {
  return {
    type: 'EXPENSE',
    fromAccountId: ACCOUNT_ID,
    categoryId: EXPENSE_CATEGORY_ID,
    amount: '150000',
    currency: 'VND',
    transactionDate: '2026-09-06T10:00:00.000Z',
    status: 'COMPLETED',
    ...overrides,
  } as CreateTransactionRequest;
}

function income(overrides: Partial<CreateTransactionRequest> = {}): CreateTransactionRequest {
  return {
    type: 'INCOME',
    toAccountId: ACCOUNT_ID,
    categoryId: INCOME_CATEGORY_ID,
    amount: '500000',
    currency: 'VND',
    transactionDate: '2026-09-05T10:00:00.000Z',
    status: 'COMPLETED',
    ...overrides,
  } as CreateTransactionRequest;
}

async function addUsdAccount(initialBalance = '0.0000'): Promise<void> {
  await guestStore.mutate((data) => ({
    ...data,
    accounts: [
      ...data.accounts,
      {
        id: USD_ACCOUNT_ID,
        walletId: WALLET_ID,
        name: 'Visa',
        type: AccountType.CREDIT_CARD,
        currency: 'USD',
        initialBalance,
        status: AccountStatus.ACTIVE,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
  }));
}

beforeEach(async () => {
  await withFreshStore();
  await seedFixture();
});

describe('guestDashboardApi.summary — period totals', () => {
  it('sums completed income and expense inside the window and echoes the window back', async () => {
    await guestTransactionsApi.create(income());
    await guestTransactionsApi.create(expense());
    await guestTransactionsApi.create(expense({ amount: '99000', transactionDate: '2026-10-01T00:00:00.000Z' }));

    const summary = await guestDashboardApi.summary(SEPTEMBER);

    assert.deepEqual(summary.period, { dateFrom: SEPTEMBER.dateFrom, dateTo: SEPTEMBER.dateTo });
    assert.deepEqual(summary.income, [{ currency: 'VND', amount: '500000.0000' }]);
    assert.deepEqual(summary.expense, [{ currency: 'VND', amount: '150000.0000' }]);
    assert.deepEqual(summary.net, [{ currency: 'VND', amount: '350000.0000' }]);
  });

  it('includes both boundary days by calendar day, not by instant', async () => {
    await guestTransactionsApi.create(expense({ amount: '1000', transactionDate: '2026-09-01T00:00:00.000Z' }));
    await guestTransactionsApi.create(expense({ amount: '2000', transactionDate: '2026-09-30T23:30:00.000Z' }));

    const summary = await guestDashboardApi.summary(SEPTEMBER);
    assert.deepEqual(summary.expense, [{ currency: 'VND', amount: '3000.0000' }]);
  });

  it('leaves pending and deleted rows out of every period figure', async () => {
    await guestTransactionsApi.create(expense({ status: 'PENDING' }));
    await guestTransactionsApi.create(expense({ status: 'DELETED' }));

    const summary = await guestDashboardApi.summary(SEPTEMBER);

    assert.deepEqual(summary.expense, []);
    assert.deepEqual(summary.net, []);
    assert.deepEqual(summary.spendingByCategory, []);
  });

  it('reports each currency on its own line, sorted, and never sums across them (BR-07)', async () => {
    await addUsdAccount();
    await guestTransactionsApi.create(income());
    await guestTransactionsApi.create(income({ toAccountId: USD_ACCOUNT_ID, currency: 'USD', amount: '12.5' }));

    const summary = await guestDashboardApi.summary(SEPTEMBER);

    assert.deepEqual(summary.income, [
      { currency: 'USD', amount: '12.5000' },
      { currency: 'VND', amount: '500000.0000' },
    ]);
    assert.deepEqual(summary.net, [
      { currency: 'USD', amount: '12.5000' },
      { currency: 'VND', amount: '500000.0000' },
    ]);
  });

  it('rejects when there is no guest wallet', async () => {
    await withFreshStore();
    await assert.rejects(guestDashboardApi.summary(SEPTEMBER), (error) => isApiError(error) && error.code === 'WALLET_NOT_FOUND');
  });
});

describe('guestDashboardApi.summary — transfers (BR-06)', () => {
  it('counts a transfer as neither income, expense nor spending', async () => {
    await guestTransactionsApi.create({
      type: 'TRANSFER',
      fromAccountId: ACCOUNT_ID,
      toAccountId: OTHER_ACCOUNT_ID,
      amount: '400000',
      currency: 'VND',
      transactionDate: '2026-09-10T10:00:00.000Z',
      status: 'COMPLETED',
    });

    const summary = await guestDashboardApi.summary(SEPTEMBER);

    assert.deepEqual(summary.income, []);
    assert.deepEqual(summary.expense, []);
    assert.deepEqual(summary.spendingByCategory, []);
    assert.deepEqual(summary.totalBalance, [{ currency: 'VND', amount: '1000000.0000' }]);
  });

  it('reports no transfer flow for a move between two of the wallet\'s own accounts', async () => {
    await guestTransactionsApi.create({
      type: 'TRANSFER',
      fromAccountId: ACCOUNT_ID,
      toAccountId: OTHER_ACCOUNT_ID,
      amount: '400000',
      currency: 'VND',
      transactionDate: '2026-09-10T10:00:00.000Z',
      status: 'COMPLETED',
    });

    const summary = await guestDashboardApi.summary(SEPTEMBER);

    assert.deepEqual(summary.transferredIn, []);
    assert.deepEqual(summary.transferredOut, []);
  });
});

describe('guestDashboardApi.summary — spending by category', () => {
  beforeEach(async () => {
    await guestStore.mutate((data) => ({
      ...data,
      categories: [
        ...data.categories,
        {
          id: TRANSPORT_CATEGORY_ID,
          walletId: WALLET_ID,
          parentId: null,
          name: 'Transport',
          type: CategoryType.EXPENSE,
          icon: 'bus',
          color: '#00f',
          status: CategoryStatus.ACTIVE,
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
    }));
  });

  it('splits expense by category, largest first, with shares of the period total', async () => {
    await guestTransactionsApi.create(expense({ amount: '100000', categoryId: TRANSPORT_CATEGORY_ID }));
    await guestTransactionsApi.create(expense({ amount: '200000' }));
    await guestTransactionsApi.create(expense({ amount: '100000' }));

    const slices = (await guestDashboardApi.summary(SEPTEMBER)).spendingByCategory;
    const total = parseMoney('400000');

    assert.deepEqual(
      slices.map(({ categoryId, categoryName, amount, percentage, icon }) => ({ categoryId, categoryName, amount, percentage, icon })),
      [
        { categoryId: EXPENSE_CATEGORY_ID, categoryName: 'Food', amount: '300000.0000', percentage: percentageOf(parseMoney('300000'), total), icon: null },
        { categoryId: TRANSPORT_CATEGORY_ID, categoryName: 'Transport', amount: '100000.0000', percentage: percentageOf(parseMoney('100000'), total), icon: 'bus' },
      ],
    );
  });

  it('scopes the breakdown to one currency when expenses span several', async () => {
    await addUsdAccount('100.0000');
    await guestTransactionsApi.create(expense({ amount: '300000' }));
    await guestTransactionsApi.create(
      expense({ fromAccountId: USD_ACCOUNT_ID, currency: 'USD', amount: '20', categoryId: TRANSPORT_CATEGORY_ID }),
    );

    const slices = (await guestDashboardApi.summary(SEPTEMBER)).spendingByCategory;

    assert.deepEqual(
      slices.map(({ categoryId, amount, percentage }) => ({ categoryId, amount, percentage })),
      [{ categoryId: EXPENSE_CATEGORY_ID, amount: '300000.0000', percentage: 100 }],
    );
  });
});

describe('guestDashboardApi.summary — displayCurrency valuation', () => {
  it('omits valuation entirely when no display currency is asked for', async () => {
    const summary = await guestDashboardApi.summary(SEPTEMBER);
    assert.equal('valuation' in summary, false);
  });

  it('reports an exact, fresh total when every balance is already in the display currency', async () => {
    await guestTransactionsApi.create(income());

    const summary = await guestDashboardApi.summary({ ...SEPTEMBER, displayCurrency: 'VND' });

    assert.deepEqual(summary.valuation, {
      currency: 'VND',
      amount: '1500000.0000',
      isApproximate: false,
      status: ValuationStatus.FRESH,
    });
  });

  it('reports the valuation unavailable, naming the currencies it cannot convert offline', async () => {
    await addUsdAccount('25.0000');

    const summary = await guestDashboardApi.summary({ ...SEPTEMBER, displayCurrency: 'VND' });

    assert.deepEqual(summary.valuation, {
      currency: 'VND',
      amount: null,
      isApproximate: true,
      status: ValuationStatus.UNAVAILABLE,
      missingCurrencies: ['USD'],
    });
  });
});
