import { strict as assert } from 'node:assert';
import http from 'node:http';
import https from 'node:https';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

import type { CreateTransactionRequest } from '@sora/contracts';

import { guestAccountsApi } from './guestAccounts.ts';
import { guestBudgetsApi } from './guestBudgets.ts';
import { guestCategoriesApi } from './guestCategories.ts';
import { guestDashboardApi } from './guestDashboard.ts';
import { guestGoalsApi } from './guestGoals.ts';
import { ensureSeeded } from './guestSeed.ts';
import { guestTransactionsApi } from './guestTransactions.ts';
import { guestWalletsApi } from './guestWallets.ts';
import { withFreshStore } from './testSupport.ts';

const attempts: string[] = [];
const realFetch = globalThis.fetch;
const realXhr = (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest;

function refuse(channel: string): never {
  attempts.push(channel);
  throw new Error(`guest mode reached the network via ${channel}`);
}

// Every path a request could leave by: fetch, React Native's XHR (axios's adapter there), and Node's http(s) (axios's adapter here).
beforeEach(async () => {
  attempts.length = 0;
  globalThis.fetch = (() => refuse('fetch')) as typeof fetch;
  (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest = class {
    constructor() {
      refuse('XMLHttpRequest');
    }
  };
  for (const [name, module] of [['http', http], ['https', https]] as const) {
    mock.method(module, 'request', () => refuse(`${name}.request`));
    mock.method(module, 'get', () => refuse(`${name}.get`));
  }
  await withFreshStore();
});

afterEach(() => {
  globalThis.fetch = realFetch;
  (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest = realXhr;
  mock.restoreAll();
});

describe('guest mode makes no network request (GST-US-01)', () => {
  it('first launch through every feature, read and write, without one request', async () => {
    const seeded = await ensureSeeded();
    const walletId = seeded.wallet!.id;

    const [wallet] = await guestWalletsApi.list();
    await guestWalletsApi.detail(wallet!.id);

    const cash = await guestAccountsApi.create({ walletId, name: 'Cash', type: 'CASH', currency: 'VND', initialBalance: '1000000.0000' });
    const bank = await guestAccountsApi.create({ walletId, name: 'Bank', type: 'BANK_ACCOUNT', currency: 'VND', initialBalance: '0.0000' });
    await guestAccountsApi.update(bank.id, { name: 'Vietcombank' });
    await guestAccountsApi.list({ walletId });
    await guestAccountsApi.detail(cash.id);

    const category = await guestCategoriesApi.create({ walletId, name: 'Coffee', type: 'EXPENSE' });
    await guestCategoriesApi.update(category.id, { name: 'Coffee & tea' });
    await guestCategoriesApi.list({ walletId });

    const expense = await guestTransactionsApi.create({
      type: 'EXPENSE',
      status: 'COMPLETED',
      fromAccountId: cash.id,
      categoryId: category.id,
      amount: '45000',
      currency: 'VND',
      transactionDate: '2026-09-05T10:00:00.000Z',
    } as CreateTransactionRequest);
    await guestTransactionsApi.create({
      type: 'TRANSFER',
      status: 'COMPLETED',
      fromAccountId: cash.id,
      toAccountId: bank.id,
      amount: '200000',
      currency: 'VND',
      transactionDate: '2026-09-06T10:00:00.000Z',
    } as CreateTransactionRequest);
    await guestTransactionsApi.update(expense.id, { description: 'Flat white' });
    await guestTransactionsApi.list({ walletId });
    await guestTransactionsApi.detail(expense.id);

    const budget = await guestBudgetsApi.create({
      walletId,
      name: 'Coffee, September',
      amount: '500000',
      currency: 'VND',
      periodType: 'MONTHLY',
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      categoryId: category.id,
    });
    await guestBudgetsApi.update(budget.id, { name: 'Coffee budget' });
    await guestBudgetsApi.list({ walletId });
    await guestBudgetsApi.detail(budget.id);

    const goal = await guestGoalsApi.create({ walletId, name: 'Laptop', targetAmount: '30000000', currency: 'VND' });
    const contribution = await guestGoalsApi.addContribution(goal.id, {
      accountId: bank.id,
      amount: '100000',
      currency: 'VND',
      contributionDate: '2026-09-10T10:00:00.000Z',
      recordAsTransaction: false,
    });
    await guestGoalsApi.contributions(goal.id);
    await guestGoalsApi.update(goal.id, { name: 'New laptop' });
    await guestGoalsApi.list({ walletId });
    await guestGoalsApi.detail(goal.id);

    await guestDashboardApi.summary({ walletId, dateFrom: '2026-09-01', dateTo: '2026-09-30' });

    await guestGoalsApi.removeContribution(goal.id, contribution.id);
    await guestGoalsApi.cancel(goal.id);
    await guestBudgetsApi.archive(budget.id);
    await guestTransactionsApi.delete(expense.id);
    await guestCategoriesApi.archive(category.id);
    await guestAccountsApi.archive(bank.id);

    assert.deepEqual(attempts, []);
  });

  it('the stubs do catch a request, so an empty list above is not vacuous', async () => {
    await assert.rejects(Promise.resolve().then(() => fetch('http://localhost:3000/api/v1/wallets')), /via fetch/);
    assert.throws(() => http.request('http://localhost:3000/api/v1/wallets'), /via http.request/);
    assert.deepEqual(attempts, ['fetch', 'http.request']);
  });
});
