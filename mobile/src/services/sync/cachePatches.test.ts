import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { TransactionStatus, TransactionType, type BudgetResponse, type TransactionResponse } from '@sora/contracts';

import { contributionPatches, isWalletWideDashboard, newAccountPatches, transactionPatches } from './cachePatches.ts';
import type { LedgerChange } from './pendingTotals.ts';

const expense = {
  id: 'tx-1',
  type: TransactionType.EXPENSE,
  status: TransactionStatus.COMPLETED,
  amount: '100.0000',
  currency: 'VND',
  transactionDate: '2026-09-15T09:00:00.000Z',
  fromAccount: { id: 'acc-bank', name: 'Bank', currency: 'VND', walletId: 'w-me', walletName: 'Me' },
  toAccount: null,
  category: { id: 'cat-food', name: 'Food', type: 'EXPENSE', icon: null, color: null },
  goalId: null,
} as unknown as TransactionResponse;

const change: LedgerChange = { kind: 'create', transaction: expense, from: null, to: null, actorUserId: 'user-me', inPlace: false };

describe('transactionPatches', () => {
  it('patches every cached read that shows a figure a transaction moves', () => {
    assert.deepEqual(
      transactionPatches(change).map((patch) => patch.endpoint).sort(),
      ['getAccount', 'getBudget', 'getDashboardSummary', 'getWallet', 'listAccounts', 'listBudgets', 'listWallets'],
    );
  });

  it('applies a list patch to every item, so no budget in a cached list is left stale', () => {
    const budgets = ['b-1', 'b-2'].map(
      (id) =>
        ({
          id,
          walletId: 'w-me',
          categoryId: 'cat-food',
          goalId: null,
          amount: '1000.0000',
          currency: 'VND',
          startDate: '2026-09-01',
          endDate: '2026-09-30',
          periodStart: '2026-09-01',
          periodEnd: '2026-09-30',
          spent: '0.0000',
          remaining: '1000.0000',
          usagePercentage: 0,
          isOverBudget: false,
        }) as unknown as BudgetResponse,
    );
    transactionPatches(change).find((patch) => patch.endpoint === 'listBudgets')!.recipe(budgets);
    assert.deepEqual(budgets.map((budget) => budget.spent), ['100.0000', '100.0000']);
  });
});

describe('dashboard scoping', () => {
  it('patches only the wallet-wide dashboard, never one narrowed to an account', () => {
    assert.equal(isWalletWideDashboard({ walletId: 'w-me' }), true);
    assert.equal(isWalletWideDashboard({ walletId: 'w-me', accountId: 'acc-bank' }), false);
    for (const patches of [transactionPatches(change), newAccountPatches({ walletId: 'w-me' } as never)]) {
      assert.equal(patches.find((patch) => patch.endpoint === 'getDashboardSummary')!.include, isWalletWideDashboard);
    }
  });

  it('lets a contribution reach a dashboard of any scope, since goals belong to the wallet', () => {
    const dashboard = contributionPatches('goal-1', '10').find((patch) => patch.endpoint === 'getDashboardSummary')!;
    assert.equal(dashboard.include, undefined);
  });
});
