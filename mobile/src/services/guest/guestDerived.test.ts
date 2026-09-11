/**
 * Derived-value coverage for the guest layer (BR-05: nothing is stored).
 *
 * Every expectation is computed by calling `calc.ts` independently in the
 * test rather than by hardcoding a figure, so a guest module that quietly
 * reimplements the math instead of calling the shared function fails here.
 */

import { strict as assert } from 'node:assert';
import { beforeEach, describe, it } from 'node:test';

import {
  calculateAccountBalance,
  calculateBudgetRemaining,
  calculateBudgetSpent,
  calculateBudgetUsage,
  calculateGoalCurrent,
  calculateGoalProgress,
  calculateGoalRemaining,
  formatMoney,
  isOverBudget,
  parseMoney,
  type CreateTransactionRequest,
} from '@sora/contracts';

import { isApiError } from '../../utils/errors.ts';
import { guestAccountsApi } from './guestAccounts.ts';
import { guestBudgetsApi } from './guestBudgets.ts';
import { guestGoalsApi } from './guestGoals.ts';
import { guestStore } from './guestStorage.ts';
import { guestTransactionsApi, toBalanceRelevant, toSpendRelevant } from './guestTransactions.ts';
import { guestWalletsApi } from './guestWallets.ts';
import {
  ACCOUNT_ID,
  EXPENSE_CATEGORY_ID,
  INCOME_CATEGORY_ID,
  OTHER_ACCOUNT_ID,
  WALLET_ID,
  seedFixture,
  withFreshStore,
} from './testSupport.ts';

async function codeOf(work: () => Promise<unknown>): Promise<string> {
  try {
    await work();
  } catch (error) {
    if (isApiError(error)) return error.code;
    throw error;
  }
  throw new Error('expected a rejection, got none');
}

function tx(overrides: Partial<CreateTransactionRequest> = {}): CreateTransactionRequest {
  return {
    type: 'EXPENSE',
    fromAccountId: ACCOUNT_ID,
    categoryId: EXPENSE_CATEGORY_ID,
    amount: '150000',
    currency: 'VND',
    transactionDate: '2026-09-05T10:00:00.000Z',
    status: 'COMPLETED',
    ...overrides,
  } as CreateTransactionRequest;
}

beforeEach(async () => {
  await withFreshStore();
  await seedFixture();
});

describe('guestAccountsApi — balance', () => {
  it('agrees with an independent calculateAccountBalance call', async () => {
    await guestTransactionsApi.create(tx({ amount: '150000' }));
    await guestTransactionsApi.create(
      tx({ type: 'INCOME', toAccountId: ACCOUNT_ID, categoryId: INCOME_CATEGORY_ID, amount: '500000' }),
    );

    const [account] = await guestAccountsApi.list();
    const expected = calculateAccountBalance(
      parseMoney('1000000.0000'),
      guestStore.current().transactions.map(toBalanceRelevant),
      ACCOUNT_ID,
    );

    assert.equal(account!.balance, formatMoney(expected));
  });

  it('ignores PENDING and CANCELLED rows, as only COMPLETED moves money', async () => {
    const pending = await guestTransactionsApi.create(tx({ amount: '999999', status: 'PENDING' }));
    const doomed = await guestTransactionsApi.create(tx({ amount: '888888' }));
    await guestTransactionsApi.cancel(doomed.id);

    const [account] = await guestAccountsApi.list();
    assert.equal(account!.balance, formatMoney(parseMoney('1000000.0000')));
    assert.equal(pending.status, 'PENDING');
  });

  it('lets an account go overdrawn rather than clamping at zero (BR-04-style)', async () => {
    await guestTransactionsApi.create(tx({ amount: '1500000' }));

    const [account] = await guestAccountsApi.list();
    assert.equal(account!.balance, formatMoney(parseMoney('-500000')));
  });

  it('debits one side of a transfer and credits the other in one pass', async () => {
    await guestTransactionsApi.create({
      type: 'TRANSFER',
      fromAccountId: ACCOUNT_ID,
      toAccountId: OTHER_ACCOUNT_ID,
      amount: '400000',
      currency: 'VND',
      transactionDate: '2026-09-05T10:00:00.000Z',
      status: 'COMPLETED',
    });

    const accounts = await guestAccountsApi.list();
    const cash = accounts.find((account) => account.id === ACCOUNT_ID);
    const bank = accounts.find((account) => account.id === OTHER_ACCOUNT_ID);

    assert.equal(cash!.balance, formatMoney(parseMoney('600000')));
    assert.equal(bank!.balance, formatMoney(parseMoney('400000')));
  });
});

describe('guestAccountsApi — detail activity (BR-06)', () => {
  beforeEach(async () => {
    await guestTransactionsApi.create(tx({ amount: '150000' }));
    await guestTransactionsApi.create(
      tx({ type: 'INCOME', toAccountId: ACCOUNT_ID, categoryId: INCOME_CATEGORY_ID, amount: '500000' }),
    );
    await guestTransactionsApi.create({
      type: 'TRANSFER',
      fromAccountId: ACCOUNT_ID,
      toAccountId: OTHER_ACCOUNT_ID,
      amount: '200000',
      currency: 'VND',
      transactionDate: '2026-09-05T10:00:00.000Z',
      status: 'COMPLETED',
    });
  });

  it('reports transfers separately, never folded into income or expense', async () => {
    const detail = await guestAccountsApi.detail(ACCOUNT_ID);

    assert.equal(detail.totalExpense, formatMoney(parseMoney('150000')));
    assert.equal(detail.totalIncome, formatMoney(parseMoney('500000')));
    assert.equal(detail.transferredOut, formatMoney(parseMoney('200000')));
    assert.equal(detail.transferredIn, formatMoney(parseMoney('0')));
  });

  it('counts every row touching the account, cancelled included', async () => {
    const doomed = await guestTransactionsApi.create(tx({ amount: '1000' }));
    await guestTransactionsApi.cancel(doomed.id);

    const detail = await guestAccountsApi.detail(ACCOUNT_ID);
    assert.equal(detail.transactionCount, 4);
    // ...but the cancelled row contributes nothing to the totals.
    assert.equal(detail.totalExpense, formatMoney(parseMoney('150000')));
  });
});

describe('guestAccountsApi — archive', () => {
  it('refuses to archive the wallet’s last active account', async () => {
    await guestAccountsApi.archive(OTHER_ACCOUNT_ID);

    const code = await codeOf(() => guestAccountsApi.archive(ACCOUNT_ID));
    assert.equal(code, 'ACCOUNT_LAST_ACTIVE');
  });

  it('is idempotent for an already-archived account', async () => {
    await guestAccountsApi.archive(OTHER_ACCOUNT_ID);
    await guestAccountsApi.archive(OTHER_ACCOUNT_ID);

    const accounts = await guestAccountsApi.list({ status: 'ARCHIVED' });
    assert.equal(accounts.length, 1);
  });
});

describe('guestBudgetsApi — spend (BR-06)', () => {
  const budget = {
    walletId: WALLET_ID,
    categoryId: EXPENSE_CATEGORY_ID,
    name: 'Food, September',
    amount: '1000000',
    currency: 'VND',
    periodType: 'MONTHLY' as const,
    startDate: '2026-09-01',
    endDate: '2026-09-30',
  };

  it('agrees with an independent calculateBudgetSpent call', async () => {
    await guestTransactionsApi.create(tx({ amount: '150000' }));
    await guestTransactionsApi.create(tx({ amount: '300000', transactionDate: '2026-09-30T23:30:00.000Z' }));
    const created = await guestBudgetsApi.create(budget);

    const spent = calculateBudgetSpent(
      { categoryId: EXPENSE_CATEGORY_ID, startDate: budget.startDate, endDate: budget.endDate },
      guestStore.current().transactions.map(toSpendRelevant),
    );

    assert.equal(created.spent, formatMoney(spent));
    assert.equal(created.remaining, formatMoney(calculateBudgetRemaining(parseMoney(budget.amount), spent)));
    assert.equal(created.usagePercentage, calculateBudgetUsage(parseMoney(budget.amount), spent));
    assert.equal(created.isOverBudget, isOverBudget(parseMoney(budget.amount), spent));
  });

  it('excludes a transfer out of the budgeted category’s account', async () => {
    await guestTransactionsApi.create({
      type: 'TRANSFER',
      fromAccountId: ACCOUNT_ID,
      toAccountId: OTHER_ACCOUNT_ID,
      amount: '2000000',
      currency: 'VND',
      transactionDate: '2026-09-10T10:00:00.000Z',
      status: 'COMPLETED',
    });

    const created = await guestBudgetsApi.create(budget);
    assert.equal(created.spent, formatMoney(parseMoney('0')));
    assert.equal(created.isOverBudget, false);
  });

  it('counts what was already spent when a budget is created mid-month (§12.2)', async () => {
    await guestTransactionsApi.create(tx({ amount: '400000', transactionDate: '2026-09-02T10:00:00.000Z' }));
    const created = await guestBudgetsApi.create(budget);

    assert.equal(created.spent, formatMoney(parseMoney('400000')));
  });

  it('reports an overspend above 100% rather than hiding it', async () => {
    await guestTransactionsApi.create(tx({ amount: '1400000' }));
    const created = await guestBudgetsApi.create(budget);

    assert.equal(created.isOverBudget, true);
    assert.equal(created.remaining, formatMoney(parseMoney('-400000')));
    assert.equal(created.usagePercentage > 100, true);
  });

  it('rejects a second ACTIVE budget overlapping the same category (BR-04)', async () => {
    await guestBudgetsApi.create(budget);

    const code = await codeOf(() =>
      guestBudgetsApi.create({ ...budget, name: 'Overlapping', startDate: '2026-09-15', endDate: '2026-10-15' }),
    );
    assert.equal(code, 'BUDGET_PERIOD_OVERLAP');
  });

  it('allows the same window once the first budget is archived', async () => {
    const first = await guestBudgetsApi.create(budget);
    await guestBudgetsApi.archive(first.id);

    const second = await guestBudgetsApi.create({ ...budget, name: 'September, again' });
    assert.equal(second.status, 'ACTIVE');
  });

  it('allows an adjacent, non-overlapping window', async () => {
    await guestBudgetsApi.create(budget);

    const october = await guestBudgetsApi.create({
      ...budget,
      name: 'Food, October',
      startDate: '2026-10-01',
      endDate: '2026-10-31',
    });
    assert.equal(october.status, 'ACTIVE');
  });

  it('refuses an INCOME category, which cannot be budgeted', async () => {
    const code = await codeOf(() => guestBudgetsApi.create({ ...budget, categoryId: INCOME_CATEGORY_ID }));
    assert.equal(code, 'CATEGORY_WRONG_TYPE');
  });
});

describe('guestGoalsApi — progress', () => {
  const goal = {
    walletId: WALLET_ID,
    name: 'Laptop',
    targetAmount: '30000000',
    currency: 'VND',
  };

  it('agrees with independent calculateGoalCurrent/Remaining/Progress calls', async () => {
    const created = await guestGoalsApi.create(goal);
    await guestGoalsApi.addContribution(created.id, {
      accountId: ACCOUNT_ID,
      amount: '8000000',
      currency: 'VND',
      contributionDate: '2026-09-05T10:00:00.000Z',
      recordAsTransaction: false,
    });
    await guestGoalsApi.addContribution(created.id, {
      accountId: ACCOUNT_ID,
      amount: '5000000',
      currency: 'VND',
      contributionDate: '2026-09-06T10:00:00.000Z',
      recordAsTransaction: false,
    });

    const detail = await guestGoalsApi.detail(created.id);
    const current = calculateGoalCurrent(
      guestStore.current().contributions.map((contribution) => parseMoney(contribution.amount)),
    );

    assert.equal(detail.currentAmount, formatMoney(current));
    assert.equal(detail.remaining, formatMoney(calculateGoalRemaining(parseMoney(goal.targetAmount), current)));
    assert.equal(detail.progressPercentage, calculateGoalProgress(parseMoney(goal.targetAmount), current));
    assert.equal(detail.contributionCount, 2);
  });

  it('floors the remainder at zero and caps progress at 100 when overshot', async () => {
    const created = await guestGoalsApi.create(goal);
    await guestGoalsApi.addContribution(created.id, {
      accountId: ACCOUNT_ID,
      amount: '35000000',
      currency: 'VND',
      contributionDate: '2026-09-05T10:00:00.000Z',
      recordAsTransaction: false,
    });

    const detail = await guestGoalsApi.detail(created.id);
    assert.equal(detail.remaining, formatMoney(parseMoney('0')));
    assert.equal(detail.progressPercentage, 100);
  });

  it('leaves the account balance untouched for an earmark', async () => {
    const created = await guestGoalsApi.create(goal);
    await guestGoalsApi.addContribution(created.id, {
      accountId: ACCOUNT_ID,
      amount: '900000',
      currency: 'VND',
      contributionDate: '2026-09-05T10:00:00.000Z',
      recordAsTransaction: false,
    });

    const [account] = await guestAccountsApi.list();
    assert.equal(account!.balance, formatMoney(parseMoney('1000000.0000')));
    assert.equal(guestStore.current().transactions.length, 0);
  });

  it('moves real money when recordAsTransaction is set, and links the two', async () => {
    const created = await guestGoalsApi.create(goal);
    const contribution = await guestGoalsApi.addContribution(created.id, {
      accountId: ACCOUNT_ID,
      amount: '900000',
      currency: 'VND',
      contributionDate: '2026-09-05T10:00:00.000Z',
      recordAsTransaction: true,
      categoryId: EXPENSE_CATEGORY_ID,
    });

    assert.notEqual(contribution.transactionId, null);
    const [account] = await guestAccountsApi.list();
    assert.equal(account!.balance, formatMoney(parseMoney('100000')));

    const [transaction] = guestStore.current().transactions;
    assert.equal(transaction!.type, 'EXPENSE');
    assert.equal(transaction!.description, 'Contribution to Laptop');
  });

  it('demands a category when recording as a transaction', async () => {
    const created = await guestGoalsApi.create(goal);
    const code = await codeOf(() =>
      guestGoalsApi.addContribution(created.id, {
        accountId: ACCOUNT_ID,
        amount: '900000',
        currency: 'VND',
        contributionDate: '2026-09-05T10:00:00.000Z',
        recordAsTransaction: true,
      }),
    );

    assert.equal(code, 'VALIDATION_FAILED');
  });

  it('rejects a contribution in a currency the goal does not use (BR-07)', async () => {
    const created = await guestGoalsApi.create(goal);
    const code = await codeOf(() =>
      guestGoalsApi.addContribution(created.id, {
        accountId: ACCOUNT_ID,
        amount: '100',
        currency: 'USD',
        contributionDate: '2026-09-05T10:00:00.000Z',
        recordAsTransaction: false,
      }),
    );

    assert.equal(code, 'ACCOUNT_CURRENCY_MISMATCH');
  });

  it('refuses a contribution to a cancelled goal', async () => {
    const created = await guestGoalsApi.create(goal);
    await guestGoalsApi.cancel(created.id);

    const code = await codeOf(() =>
      guestGoalsApi.addContribution(created.id, {
        accountId: ACCOUNT_ID,
        amount: '100000',
        currency: 'VND',
        contributionDate: '2026-09-05T10:00:00.000Z',
        recordAsTransaction: false,
      }),
    );

    assert.equal(code, 'GOAL_NOT_ACTIVE');
  });

  it('keeps contributions when a goal is cancelled — they record real money (§13.5)', async () => {
    const created = await guestGoalsApi.create(goal);
    await guestGoalsApi.addContribution(created.id, {
      accountId: ACCOUNT_ID,
      amount: '100000',
      currency: 'VND',
      contributionDate: '2026-09-05T10:00:00.000Z',
      recordAsTransaction: false,
    });

    await guestGoalsApi.cancel(created.id);
    assert.equal((await guestGoalsApi.contributions(created.id)).length, 1);
  });

  it('cancels the backing transaction when a linked contribution is removed (§13.8)', async () => {
    const created = await guestGoalsApi.create(goal);
    const contribution = await guestGoalsApi.addContribution(created.id, {
      accountId: ACCOUNT_ID,
      amount: '900000',
      currency: 'VND',
      contributionDate: '2026-09-05T10:00:00.000Z',
      recordAsTransaction: true,
      categoryId: EXPENSE_CATEGORY_ID,
    });

    await guestGoalsApi.removeContribution(created.id, contribution.id);

    const [transaction] = guestStore.current().transactions;
    assert.equal(transaction!.status, 'CANCELLED');
    // Cancelled, so the money is back in the account rather than lost.
    const [account] = await guestAccountsApi.list();
    assert.equal(account!.balance, formatMoney(parseMoney('1000000.0000')));
  });
});

describe('guestWalletsApi', () => {
  it('reports a per-currency total, never one summed across currencies (BR-07)', async () => {
    await guestStore.mutate((data) => ({
      ...data,
      accounts: [
        ...data.accounts,
        {
          id: '3f1a7c62-0000-4000-8000-0000000000aa',
          walletId: WALLET_ID,
          name: 'PayPal',
          type: 'E_WALLET' as const,
          currency: 'USD',
          initialBalance: '250.0000',
          status: 'ACTIVE' as const,
          createdAt: '2026-09-01T00:00:00.000Z',
          updatedAt: '2026-09-01T00:00:00.000Z',
        },
      ],
    }));

    const [wallet] = await guestWalletsApi.list();
    assert.deepEqual(
      wallet!.balances.map((total) => total.currency),
      ['USD', 'VND'],
    );
    assert.equal(wallet!.balances.find((total) => total.currency === 'USD')?.amount, formatMoney(parseMoney('250')));
    assert.equal(wallet!.balances.find((total) => total.currency === 'VND')?.amount, formatMoney(parseMoney('1000000')));
  });

  it('presents the guest as OWNER of their own single wallet', async () => {
    const [wallet] = await guestWalletsApi.list();
    assert.equal(wallet!.role, 'OWNER');
    assert.equal(wallet!.isOwn, true);
    assert.equal(wallet!.memberCount, 1);
    assert.equal(wallet!.accountCount, 2);
  });

  it('returns nothing for an ARCHIVED filter — the guest wallet is never archived', async () => {
    assert.deepEqual(await guestWalletsApi.list({ status: 'ARCHIVED' }), []);
  });
});
