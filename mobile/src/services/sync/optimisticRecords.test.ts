import { strict as assert } from 'node:assert';
import { registerHooks } from 'node:module';
import { describe, it } from 'node:test';

import type {
  CreateAccountRequest,
  CreateBudgetRequest,
  CreateCategoryRequest,
  CreateContributionRequest,
  CreateGoalRequest,
  CreateTransactionRequest,
} from '@sora/contracts';

// cacheLookup.ts imports apiSlice only for a helper these builders never call; the real one pulls in `@/` barrels node can't load.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith('/app/store/api/apiSlice.ts') && context.parentURL?.endsWith('/cacheLookup.ts')) {
      return { url: 'data:text/javascript,export const apiSlice = {};', shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

const {
  buildOptimisticAccount,
  buildOptimisticBudget,
  buildOptimisticCategory,
  buildOptimisticContribution,
  buildOptimisticGoal,
  buildOptimisticTransaction,
} = await import('./optimisticRecords.ts');

const LOCAL_ID = 'local-1';
const bank = { id: 'acc-bank', walletId: 'w-me', name: 'Bank', currency: 'VND' };
const partnerCash = { id: 'acc-partner', walletId: 'w-partner', name: 'Cash', currency: 'VND' };
const myCash = { id: 'acc-cash', walletId: 'w-me', name: 'My cash', currency: 'VND' };
const food = { id: 'cat-food', name: 'Food', type: 'EXPENSE', icon: 'utensils', color: '#f00' };

/** The shape `findCachedById` scans: RTK Query's `queries` map, one list endpoint paginated and one plain. */
const apiState = {
  queries: {
    'listAccounts({"walletId":"w-me"})': { endpointName: 'listAccounts', data: { items: [bank, myCash] } },
    'listAccounts({"walletId":"w-partner"})': { endpointName: 'listAccounts', data: [partnerCash] },
    'listCategories({"walletId":"w-me"})': { endpointName: 'listCategories', data: [food] },
    'getAccount("acc-other")': { endpointName: 'getAccount', data: { id: 'acc-other', name: 'Ignored' } },
  },
};

const expense = {
  type: 'EXPENSE',
  status: 'COMPLETED',
  fromAccountId: bank.id,
  categoryId: food.id,
  amount: '150000.0000',
  currency: 'VND',
  transactionDate: '2026-09-05T10:00:00.000Z',
} as CreateTransactionRequest;

function transfer(toAccountId: string): CreateTransactionRequest {
  return {
    type: 'TRANSFER',
    status: 'COMPLETED',
    fromAccountId: bank.id,
    toAccountId,
    amount: '50000.0000',
    currency: 'VND',
    transactionDate: '2026-09-05T10:00:00.000Z',
  } as CreateTransactionRequest;
}

describe('buildOptimisticTransaction', () => {
  it('resolves account and category refs from the cache and attributes the row as pending', () => {
    const record = buildOptimisticTransaction(expense, LOCAL_ID, apiState);

    assert.equal(record.id, LOCAL_ID);
    assert.deepEqual(record.fromAccount, { ...bank, walletName: '' });
    assert.equal(record.toAccount, null);
    assert.deepEqual(record.category, food);
    assert.equal(record.createdBy.id, 'pending');
    assert.equal(record.amount, expense.amount);
    assert.equal(record.transactionDate, expense.transactionDate);
    assert.equal(record.description, null);
    assert.equal(record.goalId, null);
    assert.equal(record.createdAt, record.updatedAt);
  });

  it('leaves refs null on a cache miss rather than inventing one', () => {
    const record = buildOptimisticTransaction(expense, LOCAL_ID, undefined);

    assert.equal(record.fromAccount, null);
    assert.equal(record.category, null);
    assert.equal(record.isCrossWallet, false);
  });

  it('flags a transfer to another wallet as cross-wallet, and one within the wallet as not', () => {
    assert.equal(buildOptimisticTransaction(transfer(partnerCash.id), LOCAL_ID, apiState).isCrossWallet, true);
    assert.equal(buildOptimisticTransaction(transfer(myCash.id), LOCAL_ID, apiState).isCrossWallet, false);
    // Unknown destination: cross-wallet can't be decided yet, so it stays false until sync.
    assert.equal(buildOptimisticTransaction(transfer('acc-unknown'), LOCAL_ID, apiState).isCrossWallet, false);
  });
});

describe('buildOptimisticAccount', () => {
  it('starts the balance at the initial balance, active', () => {
    const body = { walletId: 'w-me', name: 'Visa', type: 'CREDIT_CARD', currency: 'VND', initialBalance: '-200000.0000' } as CreateAccountRequest;
    const record = buildOptimisticAccount(body, LOCAL_ID);

    assert.equal(record.id, LOCAL_ID);
    assert.equal(record.balance, '-200000.0000');
    assert.equal(record.status, 'ACTIVE');
  });
});

describe('buildOptimisticBudget', () => {
  const body = {
    walletId: 'w-me',
    name: 'Food, September',
    amount: '1000000.0000',
    currency: 'VND',
    periodType: 'MONTHLY',
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    categoryId: food.id,
  } as CreateBudgetRequest;

  it('shows nothing spent yet and the whole amount remaining', () => {
    const record = buildOptimisticBudget(body, LOCAL_ID, apiState);

    assert.equal(record.spent, '0.0000');
    assert.equal(record.remaining, body.amount);
    assert.equal(record.usagePercentage, 0);
    assert.equal(record.isOverBudget, false);
    assert.deepEqual(record.category, { id: food.id, name: food.name, icon: food.icon, color: food.color });
  });

  it('keeps the category id with a blank name on a cache miss, and no category for a wallet-wide budget', () => {
    assert.deepEqual(buildOptimisticBudget(body, LOCAL_ID, undefined).category, { id: food.id, name: '', icon: null, color: null });
    const { categoryId: _omitted, ...walletWide } = body;
    assert.equal(buildOptimisticBudget(walletWide as CreateBudgetRequest, LOCAL_ID, apiState).category, null);
  });
});

describe('buildOptimisticGoal', () => {
  it('starts with no progress and the full target remaining', () => {
    const body = { walletId: 'w-me', name: 'Laptop', targetAmount: '30000000.0000', currency: 'VND' } as CreateGoalRequest;
    const record = buildOptimisticGoal(body, LOCAL_ID);

    assert.equal(record.currentAmount, '0.0000');
    assert.equal(record.remaining, body.targetAmount);
    assert.equal(record.progressPercentage, 0);
    assert.equal(record.contributionCount, 0);
    assert.equal(record.targetDate, null);
    assert.equal(record.status, 'ACTIVE');
  });
});

describe('buildOptimisticContribution', () => {
  const body = {
    accountId: bank.id,
    amount: '30000.0000',
    currency: 'VND',
    contributionDate: '2026-09-10T10:00:00.000Z',
  } as CreateContributionRequest;

  it('names the account from the cache and leaves the backing transaction unknown until sync', () => {
    const record = buildOptimisticContribution('goal-1', body, LOCAL_ID, apiState);

    assert.equal(record.goalId, 'goal-1');
    assert.equal(record.accountName, bank.name);
    assert.equal(record.transactionId, null);
    assert.equal(record.note, null);
  });

  it('falls back to a blank account name on a cache miss', () => {
    assert.equal(buildOptimisticContribution('goal-1', body, LOCAL_ID, undefined).accountName, '');
  });
});

describe('buildOptimisticCategory', () => {
  it('is active with no transactions and optional fields nulled', () => {
    const body = { walletId: 'w-me', name: 'Coffee', type: 'EXPENSE' } as CreateCategoryRequest;
    const record = buildOptimisticCategory(body, LOCAL_ID);

    assert.equal(record.status, 'ACTIVE');
    assert.equal(record.transactionCount, 0);
    assert.deepEqual([record.parentId, record.icon, record.color], [null, null, null]);
  });
});
