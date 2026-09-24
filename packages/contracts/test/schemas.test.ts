import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  createAccountSchema,
  createBudgetSchema,
  createContributionSchema,
  createTransactionSchema,
  inviteMemberSchema,
  registerSchema,
  transactionQuerySchema,
  updateTransactionSchema,
} from '../src/schemas.ts';

/** The field paths a failed parse complained about. */
function issuePaths(result: { success: boolean; error?: { issues: { path: unknown[] }[] } }) {
  return (result.error?.issues ?? []).map((issue) => issue.path.join('.')).sort();
}

const baseDate = '2026-08-22T12:30:00Z';
const ACCOUNT_A = '11111111-1111-4111-8111-111111111111';
const ACCOUNT_B = '22222222-2222-4222-8222-222222222222';
const CATEGORY = '33333333-3333-4333-8333-333333333333';

describe('createTransactionSchema — per-type shape', () => {
  it('accepts a well-formed expense', () => {
    const result = createTransactionSchema.safeParse({
      type: 'EXPENSE',
      fromAccountId: ACCOUNT_A,
      categoryId: CATEGORY,
      amount: '150000',
      currency: 'VND',
      transactionDate: baseDate,
    });
    assert.equal(result.success, true, JSON.stringify(issuePaths(result)));
    assert.equal(result.data?.status, 'COMPLETED', 'status should default to COMPLETED');
    assert.equal(result.data?.amount, '150000', 'amount stays a string');
  });

  it('accepts a well-formed income', () => {
    const result = createTransactionSchema.safeParse({
      type: 'INCOME',
      toAccountId: ACCOUNT_A,
      categoryId: CATEGORY,
      amount: '15000000',
      currency: 'VND',
      transactionDate: baseDate,
    });
    assert.equal(result.success, true, JSON.stringify(issuePaths(result)));
  });

  it('accepts a cross-wallet transfer with no category', () => {
    const result = createTransactionSchema.safeParse({
      type: 'TRANSFER',
      fromAccountId: ACCOUNT_A,
      toAccountId: ACCOUNT_B,
      amount: '500000',
      currency: 'VND',
      transactionDate: baseDate,
    });
    assert.equal(result.success, true, JSON.stringify(issuePaths(result)));
  });

  it('rejects an expense with no category', () => {
    const result = createTransactionSchema.safeParse({
      type: 'EXPENSE',
      fromAccountId: ACCOUNT_A,
      amount: '1000',
      currency: 'VND',
      transactionDate: baseDate,
    });
    assert.equal(result.success, false);
    assert.ok(issuePaths(result).includes('categoryId'));
  });

  it('rejects an income with no destination account', () => {
    const result = createTransactionSchema.safeParse({
      type: 'INCOME',
      categoryId: CATEGORY,
      amount: '1000',
      currency: 'VND',
      transactionDate: baseDate,
    });
    assert.equal(result.success, false);
    assert.ok(issuePaths(result).includes('toAccountId'));
  });

  it('rejects a transfer whose two accounts are the same', () => {
    const result = createTransactionSchema.safeParse({
      type: 'TRANSFER',
      fromAccountId: ACCOUNT_A,
      toAccountId: ACCOUNT_A,
      amount: '1000',
      currency: 'VND',
      transactionDate: baseDate,
    });
    assert.equal(result.success, false, 'a self-transfer must not validate');
    assert.ok(
      issuePaths(result).includes('toAccountId'),
      `expected a toAccountId issue, got ${JSON.stringify(issuePaths(result))}`,
    );
  });

  it('rejects a transfer missing its destination', () => {
    const result = createTransactionSchema.safeParse({
      type: 'TRANSFER',
      fromAccountId: ACCOUNT_A,
      amount: '1000',
      currency: 'VND',
      transactionDate: baseDate,
    });
    assert.equal(result.success, false);
  });

  it('rejects an unknown type outright', () => {
    const result = createTransactionSchema.safeParse({
      type: 'REFUND',
      fromAccountId: ACCOUNT_A,
      amount: '1000',
      currency: 'VND',
      transactionDate: baseDate,
    });
    assert.equal(result.success, false);
  });

  it('rejects a zero or negative amount', () => {
    for (const amount of ['0', '-500']) {
      const result = createTransactionSchema.safeParse({
        type: 'EXPENSE',
        fromAccountId: ACCOUNT_A,
        categoryId: CATEGORY,
        amount,
        currency: 'VND',
        transactionDate: baseDate,
      });
      assert.equal(result.success, false, `amount ${amount} must be rejected`);
    }
  });

  it('rejects an amount with more precision than the column stores', () => {
    const result = createTransactionSchema.safeParse({
      type: 'EXPENSE',
      fromAccountId: ACCOUNT_A,
      categoryId: CATEGORY,
      amount: '1.234567',
      currency: 'VND',
      transactionDate: baseDate,
    });
    assert.equal(result.success, false);
  });

  it('rejects a lowercase currency code', () => {
    const result = createTransactionSchema.safeParse({
      type: 'EXPENSE',
      fromAccountId: ACCOUNT_A,
      categoryId: CATEGORY,
      amount: '1000',
      currency: 'vnd',
      transactionDate: baseDate,
    });
    assert.equal(result.success, false);
    assert.ok(issuePaths(result).includes('currency'));
  });

  it('rejects a date without an offset, so an instant is never ambiguous', () => {
    const result = createTransactionSchema.safeParse({
      type: 'EXPENSE',
      fromAccountId: ACCOUNT_A,
      categoryId: CATEGORY,
      amount: '1000',
      currency: 'VND',
      transactionDate: '2026-08-22 12:30:00',
    });
    assert.equal(result.success, false);
  });
});

describe('updateTransactionSchema — category', () => {
  it('accepts a category id, or null to remove one (the service allows null only on a transfer)', () => {
    assert.equal(updateTransactionSchema.safeParse({ categoryId: CATEGORY }).success, true);
    assert.equal(updateTransactionSchema.safeParse({ categoryId: null }).success, true);
  });

  it('still rejects a malformed id', () => {
    assert.deepEqual(issuePaths(updateTransactionSchema.safeParse({ categoryId: 'nope' })), ['categoryId']);
  });
});

describe('registerSchema', () => {
  it('normalises the email and defaults the currency', () => {
    const result = registerSchema.safeParse({
      email: '  TAM@Example.COM ',
      password: 'correct-horse-battery',
      displayName: '  Tam  ',
      });
    assert.equal(result.success, true, JSON.stringify(issuePaths(result)));
    assert.equal(result.data?.email, 'tam@example.com');
    assert.equal(result.data?.displayName, 'Tam');
    assert.equal(result.data?.baseCurrency, 'VND');
  });

  it('rejects a password under 12 characters', () => {
    const result = registerSchema.safeParse({
      email: 'a@b.com',
      password: 'short',
      displayName: 'A',
    });
    assert.equal(result.success, false);
    assert.ok(issuePaths(result).includes('password'));
  });
});

describe('inviteMemberSchema', () => {
  it('accepts EDITOR and VIEWER', () => {
    for (const role of ['EDITOR', 'VIEWER']) {
      const result = inviteMemberSchema.safeParse({ email: 'l@x.com', role });
      assert.equal(result.success, true, `${role} should be invitable`);
    }
  });

  it('refuses to invite straight to OWNER, which is a transfer not a grant', () => {
    const result = inviteMemberSchema.safeParse({ email: 'l@x.com', role: 'OWNER' });
    assert.equal(result.success, false);
  });
});

describe('createAccountSchema', () => {
  it('allows a negative opening balance for a credit card', () => {
    const result = createAccountSchema.safeParse({
      walletId: ACCOUNT_A,
      name: 'Visa',
      type: 'CREDIT_CARD',
      currency: 'VND',
      initialBalance: '-2000000',
    });
    assert.equal(result.success, true, JSON.stringify(issuePaths(result)));
  });

  it('defaults the opening balance to zero', () => {
    const result = createAccountSchema.safeParse({
      walletId: ACCOUNT_A,
      name: 'Cash',
      type: 'CASH',
      currency: 'VND',
    });
    assert.equal(result.success, true);
    assert.equal(result.data?.initialBalance, '0');
  });

  it('rejects an account type outside the allowed set', () => {
    const result = createAccountSchema.safeParse({
      walletId: ACCOUNT_A,
      name: 'Brokerage',
      type: 'BROKERAGE',
      currency: 'VND',
    });
    assert.equal(result.success, false);
  });
});

describe('createBudgetSchema', () => {
  it('rejects a window that ends before it starts', () => {
    const result = createBudgetSchema.safeParse({
      walletId: ACCOUNT_A,
      categoryId: CATEGORY,
      name: 'Backwards',
      amount: '1000',
      currency: 'VND',
      periodType: 'CUSTOM',
      startDate: '2026-10-31',
      endDate: '2026-10-01',
    });
    assert.equal(result.success, false);
    assert.ok(issuePaths(result).includes('endDate'));
  });

  it('accepts a single-day window', () => {
    const result = createBudgetSchema.safeParse({
      walletId: ACCOUNT_A,
      categoryId: CATEGORY,
      name: 'One day',
      amount: '1000',
      currency: 'VND',
      periodType: 'CUSTOM',
      startDate: '2026-10-01',
      endDate: '2026-10-01',
    });
    assert.equal(result.success, true, JSON.stringify(issuePaths(result)));
  });
});

describe('createContributionSchema', () => {
  it('defaults to an earmark rather than asserting money moved', () => {
    const result = createContributionSchema.safeParse({
      accountId: ACCOUNT_A,
      amount: '2000000',
      currency: 'VND',
      contributionDate: baseDate,
    });
    assert.equal(result.success, true);
    assert.equal(result.data?.recordAsTransaction, false);
  });
});

describe('transactionQuerySchema', () => {
  it('coerces paging from query strings and applies defaults', () => {
    const result = transactionQuerySchema.safeParse({ page: '3', pageSize: '50' });
    assert.equal(result.success, true, JSON.stringify(issuePaths(result)));
    assert.equal(result.data?.page, 3);
    assert.equal(result.data?.pageSize, 50);
    assert.equal(result.data?.sortBy, '-transactionDate');
  });

  it('caps pageSize so a client cannot ask for the whole ledger', () => {
    const result = transactionQuerySchema.safeParse({ pageSize: '5000' });
    assert.equal(result.success, false);
  });
});
