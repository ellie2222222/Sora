import { strict as assert } from 'node:assert';
import { beforeEach, describe, it } from 'node:test';

import { parseMoney, type CreateTransactionRequest } from '@sora/contracts';

import { isApiError } from '../../utils/errors.ts';
import { guestStore } from './guestStorage.ts';
import { guestTransactionsApi, toBalanceRelevant, toSpendRelevant } from './guestTransactions.ts';
import {
  ACCOUNT_ID,
  EXPENSE_CATEGORY_ID,
  INCOME_CATEGORY_ID,
  OTHER_ACCOUNT_ID,
  seedFixture,
  withFreshStore,
} from './testSupport.ts';

const DATE = '2026-09-05T10:00:00.000Z';

function expense(overrides: Partial<CreateTransactionRequest> = {}): CreateTransactionRequest {
  return {
    type: 'EXPENSE',
    fromAccountId: ACCOUNT_ID,
    categoryId: EXPENSE_CATEGORY_ID,
    amount: '150000',
    currency: 'VND',
    transactionDate: DATE,
    status: 'COMPLETED',
    ...overrides,
  } as CreateTransactionRequest;
}

/** The error code a guest-layer rejection carries, or the raw error if it is not one. */
async function codeOf(work: () => Promise<unknown>): Promise<string> {
  try {
    await work();
  } catch (error) {
    if (isApiError(error)) return error.code;
    throw error;
  }
  throw new Error('expected a rejection, got none');
}

beforeEach(async () => {
  await withFreshStore();
  await seedFixture();
});

describe('guestTransactionsApi.create', () => {
  it('records an expense against the named account and category', async () => {
    const created = await guestTransactionsApi.create(expense());

    assert.equal(created.type, 'EXPENSE');
    assert.equal(created.fromAccount?.id, ACCOUNT_ID);
    assert.equal(created.toAccount, null);
    assert.equal(created.category?.id, EXPENSE_CATEGORY_ID);
    // Client-supplied dates are preserved verbatim, as the server preserves them.
    assert.equal(created.transactionDate, DATE);
    assert.equal(created.isCrossWallet, false);
  });

  it('rejects a transfer naming one account on both sides (BR-04 shape rule)', async () => {
    const code = await codeOf(() =>
      guestTransactionsApi.create({
        type: 'TRANSFER',
        fromAccountId: ACCOUNT_ID,
        toAccountId: ACCOUNT_ID,
        amount: '50000',
        currency: 'VND',
        transactionDate: DATE,
        status: 'COMPLETED',
      }),
    );

    assert.equal(code, 'VALIDATION_FAILED');
  });

  it('rejects an amount whose currency differs from the account (BR-07)', async () => {
    const code = await codeOf(() => guestTransactionsApi.create(expense({ currency: 'USD' })));
    assert.equal(code, 'ACCOUNT_CURRENCY_MISMATCH');
  });

  it('rejects an income pointed at an EXPENSE category', async () => {
    const code = await codeOf(() =>
      guestTransactionsApi.create({
        type: 'INCOME',
        toAccountId: ACCOUNT_ID,
        categoryId: EXPENSE_CATEGORY_ID,
        amount: '900000',
        currency: 'VND',
        transactionDate: DATE,
        status: 'COMPLETED',
      }),
    );

    assert.equal(code, 'CATEGORY_WRONG_TYPE');
  });

  /** Well-formed but absent: a malformed id is rejected earlier, by the schema. */
  it('rejects an account that does not exist', async () => {
    const code = await codeOf(() =>
      guestTransactionsApi.create(expense({ fromAccountId: '3f1a7c62-0000-4000-8000-0000000000ff' })),
    );
    assert.equal(code, 'ACCOUNT_NOT_FOUND');
  });

  it('rejects a write against an archived account', async () => {
    await guestStore.mutate((data) => ({
      ...data,
      accounts: data.accounts.map((account) =>
        account.id === ACCOUNT_ID ? { ...account, status: 'ARCHIVED' as const } : account,
      ),
    }));

    const code = await codeOf(() => guestTransactionsApi.create(expense()));
    assert.equal(code, 'ACCOUNT_ARCHIVED');
  });

  it('rejects a zero amount rather than recording a no-op movement (VL-04)', async () => {
    const code = await codeOf(() => guestTransactionsApi.create(expense({ amount: '0' })));
    assert.equal(code, 'VALIDATION_FAILED');
  });

  it('preserves a client-supplied DELETED status, as the server does', async () => {
    const created = await guestTransactionsApi.create(expense({ status: 'DELETED' }));
    assert.equal(created.status, 'DELETED');
  });
});

describe('guestTransactionsApi.update — BR-03', () => {
  it('changes only description, date, category and reference', async () => {
    const created = await guestTransactionsApi.create(expense());

    const updated = await guestTransactionsApi.update(created.id, {
      description: 'Lunch',
      reference: 'INV-9',
      transactionDate: '2026-09-06T09:00:00.000Z',
    });

    assert.equal(updated.description, 'Lunch');
    assert.equal(updated.reference, 'INV-9');
    assert.equal(updated.transactionDate, '2026-09-06T09:00:00.000Z');
    // The immutable four are untouched.
    assert.equal(updated.amount, created.amount);
    assert.equal(updated.type, created.type);
    assert.equal(updated.fromAccount?.id, created.fromAccount?.id);
    assert.equal(updated.toAccount, created.toAccount);
  });

  it('ignores an attempt to smuggle in an immutable field', async () => {
    const created = await guestTransactionsApi.create(expense());

    // A caller ignoring the types: `updateTransactionSchema` has no such field,
    // so the amount cannot be rewritten through this path (BR-03).
    await guestTransactionsApi.update(created.id, {
      description: 'Tampered',
      amount: '999999',
    } as never);

    const after = await guestTransactionsApi.detail(created.id);
    assert.equal(after.amount, created.amount);
    assert.equal(after.description, 'Tampered');
  });

  it('refuses to edit a deleted transaction', async () => {
    const created = await guestTransactionsApi.create(expense());
    await guestTransactionsApi.delete(created.id);

    const code = await codeOf(() => guestTransactionsApi.update(created.id, { description: 'No' }));
    assert.equal(code, 'TRANSACTION_ALREADY_DELETED');
  });

  it('rejects re-categorising to the wrong type', async () => {
    const created = await guestTransactionsApi.create(expense());
    const code = await codeOf(() =>
      guestTransactionsApi.update(created.id, { categoryId: INCOME_CATEGORY_ID }),
    );

    assert.equal(code, 'CATEGORY_WRONG_TYPE');
  });
});

describe('guestTransactionsApi.delete', () => {
  it('marks the row deleted rather than removing it (§16.3)', async () => {
    const created = await guestTransactionsApi.create(expense());
    const deleted = await guestTransactionsApi.delete(created.id);

    assert.equal(deleted.status, 'DELETED');
    const { items } = await guestTransactionsApi.list();
    assert.equal(items.length, 1);
  });

  it('refuses a second delete', async () => {
    const created = await guestTransactionsApi.create(expense());
    await guestTransactionsApi.delete(created.id);

    const code = await codeOf(() => guestTransactionsApi.delete(created.id));
    assert.equal(code, 'TRANSACTION_ALREADY_DELETED');
  });

  it('drops any contribution the deleted payment was backing (§11.5)', async () => {
    const created = await guestTransactionsApi.create(expense());
    await guestStore.mutate((data) => ({
      ...data,
      contributions: [
        {
          id: 'c1',
          goalId: 'g1',
          accountId: ACCOUNT_ID,
          transactionId: created.id,
          amount: '150000',
          currency: 'VND',
          contributionDate: DATE,
          note: null,
          createdAt: DATE,
        },
      ],
    }));

    await guestTransactionsApi.delete(created.id);
    assert.deepEqual(guestStore.current().contributions, []);
  });
});

describe('guestTransactionsApi.list', () => {
  beforeEach(async () => {
    await guestTransactionsApi.create(expense({ amount: '100000', transactionDate: '2026-09-01T10:00:00.000Z' }));
    await guestTransactionsApi.create(expense({ amount: '300000', transactionDate: '2026-09-03T10:00:00.000Z' }));
    await guestTransactionsApi.create({
      type: 'INCOME',
      toAccountId: ACCOUNT_ID,
      categoryId: INCOME_CATEGORY_ID,
      amount: '200000',
      currency: 'VND',
      transactionDate: '2026-09-02T10:00:00.000Z',
      status: 'COMPLETED',
    });
  });

  it('defaults to newest-first by transaction date', async () => {
    const { items } = await guestTransactionsApi.list();
    assert.deepEqual(
      items.map((item) => item.transactionDate),
      ['2026-09-03T10:00:00.000Z', '2026-09-02T10:00:00.000Z', '2026-09-01T10:00:00.000Z'],
    );
  });

  it('sorts by amount ascending when asked, comparing as money not text', async () => {
    const { items } = await guestTransactionsApi.list({ sortBy: 'amount' });
    assert.deepEqual(
      items.map((item) => item.amount),
      ['100000', '200000', '300000'],
    );
  });

  it('filters by type, and reports the unpaged total', async () => {
    const { items, pagination } = await guestTransactionsApi.list({ type: 'EXPENSE' });
    assert.equal(items.length, 2);
    assert.equal(pagination?.total, 2);
  });

  it('filters by calendar day inclusively on both ends', async () => {
    const { items } = await guestTransactionsApi.list({
      dateFrom: '2026-09-02',
      dateTo: '2026-09-03',
    });
    assert.equal(items.length, 2);
  });

  it('pages, reporting hasMore only while rows remain', async () => {
    const first = await guestTransactionsApi.list({ page: 1, pageSize: 2 });
    assert.equal(first.items.length, 2);
    assert.equal(first.pagination?.hasMore, true);

    const second = await guestTransactionsApi.list({ page: 2, pageSize: 2 });
    assert.equal(second.items.length, 1);
    assert.equal(second.pagination?.hasMore, false);
  });
});

describe('calc.ts converters', () => {
  it('maps a guest row onto the balance shape with money as scaled bigint', async () => {
    await guestTransactionsApi.create(expense({ amount: '150000' }));
    const [row] = guestStore.current().transactions;

    const relevant = toBalanceRelevant(row!);
    assert.equal(relevant.amount, parseMoney('150000'));
    assert.equal(relevant.fromAccountId, ACCOUNT_ID);
    assert.equal(relevant.toAccountId, null);
  });

  it('maps a guest row onto the spend shape, carrying category and date', async () => {
    await guestTransactionsApi.create(expense({ amount: '150000' }));
    const [row] = guestStore.current().transactions;

    const relevant = toSpendRelevant(row!);
    assert.equal(relevant.amount, parseMoney('150000'));
    assert.equal(relevant.categoryId, EXPENSE_CATEGORY_ID);
    assert.equal(relevant.transactionDate, DATE);
  });

  it('carries both sides of a transfer, so one pass debits and credits', async () => {
    await guestTransactionsApi.create({
      type: 'TRANSFER',
      fromAccountId: ACCOUNT_ID,
      toAccountId: OTHER_ACCOUNT_ID,
      amount: '400000',
      currency: 'VND',
      transactionDate: DATE,
      status: 'COMPLETED',
    });
    const [row] = guestStore.current().transactions;

    const relevant = toBalanceRelevant(row!);
    assert.equal(relevant.fromAccountId, ACCOUNT_ID);
    assert.equal(relevant.toAccountId, OTHER_ACCOUNT_ID);
    // A transfer carries no category, so it can never count as spending (BR-06).
    assert.equal(toSpendRelevant(row!).categoryId, null);
  });
});
