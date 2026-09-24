/**
 * The upload sequencer, driven against a recording fake of the real API.
 *
 * What this file is really guarding: money is uploaded exactly once. Every
 * assertion about ordering, id remapping, resume-after-failure and
 * idempotency-key stability exists because the alternative is a user's
 * transaction landing twice in their real wallet.
 */

import { strict as assert } from 'node:assert';
import { beforeEach, describe, it } from 'node:test';

import { ApiError } from '../../utils/errors.ts';
import { guestStore } from './guestStorage.ts';
import { uploadGuestData, type UploadApis } from './guestUpload.ts';
import {
  ACCOUNT_ID,
  EXPENSE_CATEGORY_ID,
  INCOME_CATEGORY_ID,
  OTHER_ACCOUNT_ID,
  WALLET_ID,
  seedFixture,
  withFreshStore,
} from './testSupport.ts';

const TARGET_WALLET = 'server-wallet-1';
const NOW = '2026-09-05T10:00:00.000Z';

interface Call {
  method: string;
  args: unknown[];
}

/**
 * Records every call and answers with `server-*` ids, so any place the
 * sequencer forwards a *local* id instead of the mapped server one shows up
 * as a wrong argument rather than passing silently.
 */
function recordingApis(options: {
  existingCategories?: { id: string; name: string; type: 'INCOME' | 'EXPENSE' | 'TRANSFER'; parentId: string | null }[];
  failOn?: { method: string; times: number; error?: unknown };
} = {}) {
  const calls: Call[] = [];
  let nextId = 1;
  const failures = new Map<string, { remaining: number; error: unknown }>();
  if (options.failOn) {
    failures.set(options.failOn.method, {
      remaining: options.failOn.times,
      error: options.failOn.error ?? new Error(`injected failure: ${options.failOn.method}`),
    });
  }

  function record(method: string, args: unknown[]): void {
    calls.push({ method, args });
    const failure = failures.get(method);
    if (failure && failure.remaining > 0) {
      failure.remaining -= 1;
      throw failure.error;
    }
  }

  const serverId = (prefix: string): string => `server-${prefix}-${nextId++}`;

  const apis: UploadApis = {
    categories: {
      async list(query) {
        record('categories.list', [query]);
        return (options.existingCategories ?? []).map((category) => ({
          id: category.id,
          walletId: TARGET_WALLET,
          parentId: category.parentId,
          name: category.name,
          type: category.type,
          icon: null,
          color: null,
          status: 'ACTIVE' as const,
          transactionCount: 0,
        }));
      },
      async create(body) {
        record('categories.create', [body]);
        return {
          id: serverId('category'),
          walletId: TARGET_WALLET,
          parentId: body.parentId ?? null,
          name: body.name,
          type: body.type,
          icon: null,
          color: null,
          status: 'ACTIVE' as const,
          transactionCount: 0,
        };
      },
      async archive(categoryId) {
        record('categories.archive', [categoryId]);
      },
    },
    accounts: {
      async create(body) {
        record('accounts.create', [body]);
        return {
          id: serverId('account'),
          walletId: TARGET_WALLET,
          name: body.name,
          type: body.type,
          currency: body.currency,
          initialBalance: body.initialBalance,
          balance: body.initialBalance,
          status: 'ACTIVE' as const,
          createdAt: NOW,
          updatedAt: NOW,
        };
      },
      async archive(accountId) {
        record('accounts.archive', [accountId]);
      },
    },
    transactions: {
      async create(body, idempotencyKey) {
        record('transactions.create', [body, idempotencyKey]);
        return {
          id: serverId('transaction'),
          type: body.type,
          status: body.status,
          amount: body.amount,
          currency: body.currency,
          description: body.description ?? null,
          transactionDate: body.transactionDate,
          reference: body.reference ?? null,
          fromAccount: null,
          toAccount: null,
          category: null,
          createdBy: { id: 'server-user', displayName: 'Real User' },
          isCrossWallet: false,
          createdAt: NOW,
          updatedAt: NOW,
        };
      },
    },
    budgets: {
      async create(body) {
        record('budgets.create', [body]);
        return {
          id: serverId('budget'),
          walletId: TARGET_WALLET,
          name: body.name,
          amount: body.amount,
          currency: body.currency,
          periodType: body.periodType,
          startDate: body.startDate,
          endDate: body.endDate,
          status: 'ACTIVE' as const,
          category: { id: body.categoryId, name: '', icon: null, color: null },
          spent: '0.0000',
          remaining: body.amount,
          usagePercentage: 0,
          isOverBudget: false,
          createdAt: NOW,
          updatedAt: NOW,
        };
      },
      async archive(budgetId) {
        record('budgets.archive', [budgetId]);
      },
    },
    goals: {
      async create(body) {
        record('goals.create', [body]);
        return {
          id: serverId('goal'),
          walletId: TARGET_WALLET,
          name: body.name,
          description: body.description ?? null,
          targetAmount: body.targetAmount,
          currency: body.currency,
          targetDate: body.targetDate ?? null,
          status: 'ACTIVE' as const,
          currentAmount: '0.0000',
          remaining: body.targetAmount,
          progressPercentage: 0,
          contributionCount: 0,
          createdAt: NOW,
          updatedAt: NOW,
        };
      },
      async addContribution(goalId, body, idempotencyKey) {
        record('goals.addContribution', [goalId, body, idempotencyKey]);
        return {
          id: serverId('contribution'),
          goalId,
          accountId: body.accountId,
          accountName: 'Cash',
          transactionId: body.recordAsTransaction ? serverId('transaction') : null,
          amount: body.amount,
          currency: body.currency,
          contributionDate: body.contributionDate,
          note: body.note ?? null,
          createdAt: NOW,
        };
      },
      async cancel(goalId) {
        record('goals.cancel', [goalId]);
      },
      async update(goalId, body) {
        record('goals.update', [goalId, body]);
        return {
          id: goalId,
          walletId: TARGET_WALLET,
          name: 'Laptop',
          description: null,
          targetAmount: '30000000',
          currency: 'VND',
          targetDate: null,
          status: body.status ?? ('ACTIVE' as const),
          currentAmount: '0.0000',
          remaining: '30000000',
          progressPercentage: 0,
          contributionCount: 0,
          createdAt: NOW,
          updatedAt: NOW,
        } as Awaited<ReturnType<UploadApis['goals']['update']>>;
      },
    },
  };

  return {
    apis,
    calls,
    methods: () => calls.map((call) => call.method),
    of: (method: string) => calls.filter((call) => call.method === method),
  };
}

/** One transaction, one budget, one goal with one earmark contribution. */
async function seedFullLedger(): Promise<void> {
  await guestStore.mutate((data) => ({
    ...data,
    transactions: [
      {
        id: '3f1a7c62-0000-4000-8000-0000000000t1'.replace('t1', '011'),
        type: 'EXPENSE' as const,
        status: 'COMPLETED' as const,
        amount: '150000',
        currency: 'VND',
        description: 'Lunch',
        transactionDate: NOW,
        reference: null,
        fromAccountId: ACCOUNT_ID,
        toAccountId: null,
        categoryId: EXPENSE_CATEGORY_ID,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
    budgets: [
      {
        id: '3f1a7c62-0000-4000-8000-000000000021',
        walletId: WALLET_ID,
        categoryId: EXPENSE_CATEGORY_ID,
        name: 'Food, September',
        amount: '1000000',
        currency: 'VND',
        periodType: 'MONTHLY' as const,
        startDate: '2026-09-01',
        endDate: '2026-09-30',
        status: 'ACTIVE' as const,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
    goals: [
      {
        id: '3f1a7c62-0000-4000-8000-000000000031',
        walletId: WALLET_ID,
        name: 'Laptop',
        description: null,
        targetAmount: '30000000',
        currency: 'VND',
        targetDate: null,
        status: 'ACTIVE' as const,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
    contributions: [
      {
        id: '3f1a7c62-0000-4000-8000-000000000041',
        goalId: '3f1a7c62-0000-4000-8000-000000000031',
        accountId: ACCOUNT_ID,
        transactionId: null,
        amount: '5000000',
        currency: 'VND',
        contributionDate: NOW,
        note: null,
        createdAt: NOW,
      },
    ],
  }));
}

beforeEach(async () => {
  await withFreshStore();
  await seedFixture();
});

describe('uploadGuestData — ordering', () => {
  it('uploads in FK order: categories, accounts, transactions, budgets, goals, contributions', async () => {
    await seedFullLedger();
    const fake = recordingApis();

    await uploadGuestData(TARGET_WALLET, fake.apis);

    const order = fake.methods();
    const firstIndexOf = (method: string) => order.indexOf(method);

    assert.ok(firstIndexOf('categories.create') < firstIndexOf('accounts.create'));
    assert.ok(firstIndexOf('accounts.create') < firstIndexOf('transactions.create'));
    assert.ok(firstIndexOf('transactions.create') < firstIndexOf('budgets.create'));
    assert.ok(firstIndexOf('budgets.create') < firstIndexOf('goals.create'));
    assert.ok(firstIndexOf('goals.create') < firstIndexOf('goals.addContribution'));
  });

  it('does nothing at all when there is no local wallet', async () => {
    await guestStore.clear();
    const fake = recordingApis();

    await uploadGuestData(TARGET_WALLET, fake.apis);
    assert.deepEqual(fake.calls, []);
  });
});

describe('uploadGuestData — id remapping', () => {
  it('sends the mapped server ids, never a local one', async () => {
    await seedFullLedger();
    const fake = recordingApis();

    await uploadGuestData(TARGET_WALLET, fake.apis);

    const [transaction] = fake.of('transactions.create');
    const body = transaction!.args[0] as { fromAccountId: string; categoryId: string };
    assert.match(body.fromAccountId, /^server-account-/);
    assert.match(body.categoryId, /^server-category-/);

    const [budget] = fake.of('budgets.create');
    const budgetBody = budget!.args[0] as { walletId: string; categoryId: string };
    assert.equal(budgetBody.walletId, TARGET_WALLET);
    assert.match(budgetBody.categoryId, /^server-category-/);

    const [contribution] = fake.of('goals.addContribution');
    assert.match(contribution!.args[0] as string, /^server-goal-/);
    assert.match((contribution!.args[1] as { accountId: string }).accountId, /^server-account-/);
  });

  it('records every mapping in uploadProgress, so a resume can skip them', async () => {
    await seedFullLedger();
    const fake = recordingApis();

    await uploadGuestData(TARGET_WALLET, fake.apis);
    const progress = guestStore.current().uploadProgress!;

    assert.equal(progress.walletId, TARGET_WALLET);
    assert.equal(Object.keys(progress.categoryMap).length, 2);
    assert.equal(Object.keys(progress.accountMap).length, 2);
    assert.equal(Object.keys(progress.transactionMap).length, 1);
    assert.equal(Object.keys(progress.budgetMap).length, 1);
    assert.equal(Object.keys(progress.goalMap).length, 1);
    assert.equal(Object.keys(progress.contributionMap).length, 1);
  });

  it('preserves the client-supplied date and status rather than re-dating', async () => {
    await seedFullLedger();
    const fake = recordingApis();

    await uploadGuestData(TARGET_WALLET, fake.apis);

    const body = fake.of('transactions.create')[0]!.args[0] as { transactionDate: string; status: string };
    assert.equal(body.transactionDate, NOW);
    assert.equal(body.status, 'COMPLETED');
  });
});

describe('uploadGuestData — category match-or-create', () => {
  it('reuses an existing category with the same name, case-insensitively', async () => {
    const fake = recordingApis({
      existingCategories: [
        { id: 'server-existing-food', name: 'food', type: 'EXPENSE', parentId: null },
        { id: 'server-existing-salary', name: 'SALARY', type: 'INCOME', parentId: null },
      ],
    });

    await uploadGuestData(TARGET_WALLET, fake.apis);

    assert.equal(fake.of('categories.create').length, 0);
    const progress = guestStore.current().uploadProgress!;
    assert.equal(progress.categoryMap[EXPENSE_CATEGORY_ID], 'server-existing-food');
    assert.equal(progress.categoryMap[INCOME_CATEGORY_ID], 'server-existing-salary');
  });

  it('creates a same-named category of another type under a type-suffixed name, since names ignore type', async () => {
    const fake = recordingApis({
      existingCategories: [{ id: 'server-existing', name: 'Food', type: 'INCOME', parentId: null }],
    });

    await uploadGuestData(TARGET_WALLET, fake.apis);

    const created = fake.of('categories.create').map((call) => (call.args[0] as { name: string }).name);
    assert.ok(created.includes('Food (Expense)'));
    assert.equal(created.includes('Food'), false, 'a plain "Food" would 409 on uq_category_name_per_parent');
  });

  it('reuses an earlier type-suffixed copy instead of creating it again', async () => {
    const fake = recordingApis({
      existingCategories: [
        { id: 'server-existing', name: 'Food', type: 'INCOME', parentId: null },
        { id: 'server-food-expense', name: 'Food (Expense)', type: 'EXPENSE', parentId: null },
      ],
    });

    await uploadGuestData(TARGET_WALLET, fake.apis);

    const created = fake.of('categories.create').map((call) => (call.args[0] as { name: string }).name);
    assert.equal(created.some((name) => name.startsWith('Food')), false);
    assert.equal(guestStore.current().uploadProgress!.categoryMap[EXPENSE_CATEGORY_ID], 'server-food-expense');
  });

  it('creates a child under its already-mapped parent', async () => {
    await guestStore.mutate((data) => ({
      ...data,
      categories: [
        ...data.categories,
        {
          id: '3f1a7c62-0000-4000-8000-000000000051',
          walletId: WALLET_ID,
          parentId: EXPENSE_CATEGORY_ID,
          name: 'Groceries',
          type: 'EXPENSE' as const,
          icon: null,
          color: null,
          status: 'ACTIVE' as const,
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
    }));
    const fake = recordingApis();

    await uploadGuestData(TARGET_WALLET, fake.apis);

    const child = fake
      .of('categories.create')
      .map((call) => call.args[0] as { name: string; parentId?: string })
      .find((body) => body.name === 'Groceries');
    assert.match(child!.parentId as string, /^server-category-/);
  });
});

describe('uploadGuestData — resume after failure', () => {
  it('re-uploads nothing that already succeeded', async () => {
    await seedFullLedger();
    const failing = recordingApis({ failOn: { method: 'budgets.create', times: 1 } });

    await assert.rejects(() => uploadGuestData(TARGET_WALLET, failing.apis));

    // Everything before budgets landed and was recorded.
    const progress = guestStore.current().uploadProgress!;
    assert.equal(Object.keys(progress.accountMap).length, 2);
    assert.equal(Object.keys(progress.transactionMap).length, 1);
    assert.equal(Object.keys(progress.budgetMap).length, 0);

    const resumed = recordingApis();
    await uploadGuestData(TARGET_WALLET, resumed.apis);

    // The second pass creates only what the first never finished.
    assert.equal(resumed.of('categories.create').length, 0);
    assert.equal(resumed.of('accounts.create').length, 0);
    assert.equal(resumed.of('transactions.create').length, 0);
    assert.equal(resumed.of('budgets.create').length, 1);
    assert.equal(resumed.of('goals.create').length, 1);
  });

  it('reuses the pinned idempotency key on a retried transaction', async () => {
    await seedFullLedger();
    const failing = recordingApis({ failOn: { method: 'budgets.create', times: 1 } });
    await assert.rejects(() => uploadGuestData(TARGET_WALLET, failing.apis));

    const firstKey = failing.of('transactions.create')[0]!.args[1] as string;
    assert.equal(typeof firstKey, 'string');

    // Force the transaction to be attempted again, as an app killed between
    // the request leaving and the response landing would.
    await guestStore.mutate((data) => ({
      ...data,
      uploadProgress: { ...data.uploadProgress!, transactionMap: {} },
    }));

    const resumed = recordingApis();
    await uploadGuestData(TARGET_WALLET, resumed.apis);

    const retriedKey = resumed.of('transactions.create')[0]!.args[1] as string;
    assert.equal(retriedKey, firstKey);
  });

  it('reuses the pinned idempotency key on a retried contribution', async () => {
    await seedFullLedger();
    const failing = recordingApis({ failOn: { method: 'goals.addContribution', times: 1 } });
    await assert.rejects(() => uploadGuestData(TARGET_WALLET, failing.apis));

    const firstKey = failing.of('goals.addContribution')[0]!.args[2] as string;

    const resumed = recordingApis();
    await uploadGuestData(TARGET_WALLET, resumed.apis);

    assert.equal(resumed.of('goals.addContribution')[0]!.args[2], firstKey);
  });

  it('starts a fresh progress map when the target wallet changes', async () => {
    await seedFullLedger();
    const first = recordingApis();
    await uploadGuestData(TARGET_WALLET, first.apis);

    const other = recordingApis();
    await uploadGuestData('a-different-wallet', other.apis);

    // Nothing is skipped, because none of it exists in the new wallet.
    assert.equal(other.of('accounts.create').length, 2);
    assert.equal(guestStore.current().uploadProgress!.walletId, 'a-different-wallet');
  });
});

describe('uploadGuestData — contribution-backed transactions', () => {
  beforeEach(async () => {
    await seedFullLedger();
    const backingId = '3f1a7c62-0000-4000-8000-000000000061';
    await guestStore.mutate((data) => ({
      ...data,
      transactions: [
        ...data.transactions,
        {
          id: backingId,
          type: 'EXPENSE' as const,
          status: 'COMPLETED' as const,
          amount: '900000',
          currency: 'VND',
          description: 'Contribution to Laptop',
          transactionDate: NOW,
          reference: null,
          fromAccountId: ACCOUNT_ID,
          toAccountId: null,
          categoryId: EXPENSE_CATEGORY_ID,
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
      contributions: [
        ...data.contributions,
        {
          id: '3f1a7c62-0000-4000-8000-000000000071',
          goalId: '3f1a7c62-0000-4000-8000-000000000031',
          accountId: ACCOUNT_ID,
          transactionId: backingId,
          amount: '900000',
          currency: 'VND',
          contributionDate: NOW,
          note: null,
          createdAt: NOW,
        },
      ],
    }));
  });

  it('uploads the backing transaction once, through addContribution only', async () => {
    const fake = recordingApis();
    await uploadGuestData(TARGET_WALLET, fake.apis);

    // The flat transactions phase skips it, so only the standalone Lunch
    // expense goes through transactions.create — the backing row would
    // otherwise be recorded twice.
    assert.equal(fake.of('transactions.create').length, 1);
    const amounts = fake.of('transactions.create').map((call) => (call.args[0] as { amount: string }).amount);
    assert.deepEqual(amounts, ['150000']);

    const recorded = fake
      .of('goals.addContribution')
      .map((call) => call.args[1] as { recordAsTransaction: boolean; amount: string });
    assert.deepEqual(
      recorded.map((body) => [body.amount, body.recordAsTransaction]),
      [
        ['5000000', false],
        ['900000', true],
      ],
    );
  });

  it('maps the server-created transaction id back onto the local one', async () => {
    const fake = recordingApis();
    await uploadGuestData(TARGET_WALLET, fake.apis);

    const progress = guestStore.current().uploadProgress!;
    assert.equal(Object.keys(progress.transactionMap).length, 2);
    assert.match(progress.transactionMap['3f1a7c62-0000-4000-8000-000000000061']!, /^server-transaction-/);
  });
});

describe('uploadGuestData — goal status transitions', () => {
  it('cancels only after every contribution has landed', async () => {
    await seedFullLedger();
    await guestStore.mutate((data) => ({
      ...data,
      goals: data.goals.map((goal) => ({ ...goal, status: 'CANCELLED' as const })),
    }));
    const fake = recordingApis();

    await uploadGuestData(TARGET_WALLET, fake.apis);

    const order = fake.methods();
    assert.ok(order.indexOf('goals.addContribution') < order.indexOf('goals.cancel'));
    // Created ACTIVE first, or the contribution would hit GOAL_NOT_ACTIVE.
    assert.ok(order.indexOf('goals.create') < order.indexOf('goals.addContribution'));
  });

  it('completes a locally-completed goal through update, not cancel', async () => {
    await seedFullLedger();
    await guestStore.mutate((data) => ({
      ...data,
      goals: data.goals.map((goal) => ({ ...goal, status: 'COMPLETED' as const })),
    }));
    const fake = recordingApis();

    await uploadGuestData(TARGET_WALLET, fake.apis);

    assert.equal(fake.of('goals.cancel').length, 0);
    assert.deepEqual(fake.of('goals.update')[0]!.args[1], { status: 'COMPLETED' });
  });

  it('leaves an ACTIVE goal alone', async () => {
    await seedFullLedger();
    const fake = recordingApis();

    await uploadGuestData(TARGET_WALLET, fake.apis);

    assert.equal(fake.of('goals.cancel').length, 0);
    assert.equal(fake.of('goals.update').length, 0);
  });
});

describe('uploadGuestData — archives last', () => {
  beforeEach(async () => {
    await seedFullLedger();
    await guestStore.mutate((data) => ({
      ...data,
      accounts: data.accounts.map((account) =>
        account.id === OTHER_ACCOUNT_ID ? { ...account, status: 'ARCHIVED' as const } : account,
      ),
      categories: data.categories.map((category) =>
        category.id === INCOME_CATEGORY_ID ? { ...category, status: 'ARCHIVED' as const } : category,
      ),
      budgets: data.budgets.map((budget) => ({ ...budget, status: 'ARCHIVED' as const })),
    }));
  });

  it('creates an archived account as ACTIVE, then archives it at the very end', async () => {
    const fake = recordingApis();
    await uploadGuestData(TARGET_WALLET, fake.apis);

    // An archived account cannot be named by a new transaction, so it has to
    // exist as ACTIVE while the ledger uploads.
    assert.equal(fake.of('accounts.create').length, 2);
    const order = fake.methods();
    assert.ok(order.indexOf('transactions.create') < order.indexOf('accounts.archive'));
    assert.equal(order.indexOf('accounts.archive'), order.length - 1);
  });

  it('archives budgets before categories, so CATEGORY_IN_USE cannot fire', async () => {
    const fake = recordingApis();
    await uploadGuestData(TARGET_WALLET, fake.apis);

    const order = fake.methods();
    assert.ok(order.indexOf('budgets.archive') < order.indexOf('categories.archive'));
  });

  it('archives by server id, not local id', async () => {
    const fake = recordingApis();
    await uploadGuestData(TARGET_WALLET, fake.apis);

    assert.match(fake.of('accounts.archive')[0]!.args[0] as string, /^server-account-/);
    assert.match(fake.of('categories.archive')[0]!.args[0] as string, /^server-category-/);
    assert.match(fake.of('budgets.archive')[0]!.args[0] as string, /^server-budget-/);
  });

  it('swallows ACCOUNT_LAST_ACTIVE rather than failing the whole upload', async () => {
    const fake = recordingApis({
      failOn: { method: 'accounts.archive', times: 1, error: new ApiError('ACCOUNT_LAST_ACTIVE', 'last one') },
    });

    await uploadGuestData(TARGET_WALLET, fake.apis);
    assert.equal(fake.of('accounts.archive').length, 1);
  });

  it('swallows CATEGORY_IN_USE rather than failing the whole upload', async () => {
    const fake = recordingApis({
      failOn: { method: 'categories.archive', times: 1, error: new ApiError('CATEGORY_IN_USE', 'in use') },
    });

    await uploadGuestData(TARGET_WALLET, fake.apis);
    assert.equal(fake.of('categories.archive').length, 1);
  });

  it('still surfaces an unexpected archive failure', async () => {
    const fake = recordingApis({
      failOn: { method: 'accounts.archive', times: 1, error: new ApiError('INTERNAL_ERROR', 'boom') },
    });

    await assert.rejects(() => uploadGuestData(TARGET_WALLET, fake.apis));
  });
});
