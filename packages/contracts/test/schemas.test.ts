import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  createAccountSchema,
  createBudgetSchema,
  createContributionSchema,
  createTransactionSchema,
  inviteMemberSchema,
  loginSchema,
  positiveAmountSchema,
  registerSchema,
  signedAmountSchema,
  transactionQuerySchema,
  updatePreferencesSchema,
  updateAccountSchema,
  updateTransactionSchema,
  mergeTransactionUpdate,
  movesMoney,
} from '../src/schemas.ts';
import { BUDGET_PERIOD_TYPES, isRepeatingBudgetPeriod } from '../src/enums.ts';

/** The field paths a failed parse complained about. */
function issuePaths(result: { success: boolean; error?: { issues: { path: unknown[] }[] } }) {
  return (result.error?.issues ?? []).map((issue) => issue.path.join('.')).sort();
}

const baseDate = '2026-08-22T12:30:00Z';
const ACCOUNT_A = '11111111-1111-4111-8111-111111111111';
const ACCOUNT_B = '22222222-2222-4222-8222-222222222222';
const CATEGORY = '33333333-3333-4333-8333-333333333333';
const GOAL = '44444444-4444-4444-8444-444444444444';

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
    assert.equal('status' in (result.data ?? {}), false, 'create never takes a status');
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

describe('createTransactionSchema — goal tag', () => {
  const base = { amount: '10', currency: 'VND', transactionDate: '2026-08-22T12:30:00Z' };

  it('TXN-US-02: lets an expense carry a goal', () => {
    const result = createTransactionSchema.safeParse({ ...base, type: 'EXPENSE', fromAccountId: ACCOUNT_A, categoryId: CATEGORY, goalId: GOAL });
    assert.equal(result.success, true, JSON.stringify(issuePaths(result)));
  });

  it('refuses a goal on income or a transfer, which is not spending (chk_transaction_goal)', () => {
    const income = createTransactionSchema.safeParse({ ...base, type: 'INCOME', toAccountId: ACCOUNT_A, categoryId: CATEGORY, goalId: GOAL });
    const transfer = createTransactionSchema.safeParse({ ...base, type: 'TRANSFER', fromAccountId: ACCOUNT_A, toAccountId: ACCOUNT_B, goalId: GOAL });
    assert.ok(issuePaths(income).includes('goalId'));
    assert.ok(issuePaths(transfer).includes('goalId'));
  });

  it('accepts an explicit null goal on any type, as a client sending a blank field does', () => {
    const income = createTransactionSchema.safeParse({ ...base, type: 'INCOME', toAccountId: ACCOUNT_A, categoryId: CATEGORY, goalId: null });
    assert.equal(income.success, true, JSON.stringify(issuePaths(income)));
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
      timeZone: 'Asia/Ho_Chi_Minh',
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

  it('caps the email at 254 characters, inside the VARCHAR(255) column', () => {
    const local = 'a'.repeat(64);
    const emailOf = (length: number) => `${local}@${'b'.repeat(length - local.length - 1 - '.example'.length)}.example`;
    const registration = (email: string) => ({ email, password: 'correct-horse-battery', displayName: 'A', timeZone: 'Asia/Ho_Chi_Minh' });
    assert.equal(emailOf(254).length, 254);
    assert.equal(registerSchema.safeParse(registration(emailOf(254))).success, true);
    assert.deepEqual(issuePaths(registerSchema.safeParse(registration(emailOf(256)))), ['email']);
    assert.deepEqual(issuePaths(inviteMemberSchema.safeParse({ email: emailOf(256), role: 'EDITOR' })), ['email']);
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
  it('takes a bank, network and last four digits on a card account, each optional', () => {
    const card = { walletId: ACCOUNT_A, name: 'My Visa', type: 'CREDIT_CARD', currency: 'VND' };
    assert.equal(createAccountSchema.safeParse({ ...card, institutionName: ' Vietcombank ', cardNetwork: 'VISA', cardLast4: '4821' }).data?.institutionName, 'Vietcombank');
    assert.equal(createAccountSchema.safeParse({ ...card, type: 'BANK_ACCOUNT', cardNetwork: 'NAPAS' }).success, true);
    assert.equal(createAccountSchema.safeParse(card).success, true);
  });

  it('refuses a network outside the list, and card digits that are not exactly four', () => {
    const card = { walletId: ACCOUNT_A, name: 'Card', type: 'CREDIT_CARD', currency: 'VND' };
    assert.deepEqual(issuePaths(createAccountSchema.safeParse({ ...card, cardNetwork: 'DINERS' })), ['cardNetwork']);
    for (const digits of ['482', '48211', '48a1', '4111 1111 1111 1111']) {
      assert.deepEqual(issuePaths(createAccountSchema.safeParse({ ...card, cardLast4: digits })), ['cardLast4'], digits);
    }
  });

  it('refuses card details on an account with no card, and any bank on cash', () => {
    const base = { walletId: ACCOUNT_A, name: 'X', currency: 'VND' };
    assert.deepEqual(issuePaths(createAccountSchema.safeParse({ ...base, type: 'E_WALLET', institutionName: 'MoMo', cardNetwork: 'VISA', cardLast4: '1234' })), ['cardLast4', 'cardNetwork']);
    assert.deepEqual(issuePaths(createAccountSchema.safeParse({ ...base, type: 'CASH', institutionName: 'Vietcombank' })), ['institutionName']);
    assert.equal(createAccountSchema.safeParse({ ...base, type: 'CASH', institutionName: null, cardNetwork: null, cardLast4: null }).success, true);
  });
});

describe('updateAccountSchema', () => {
  it('sets or clears a card detail on its own', () => {
    assert.equal(updateAccountSchema.safeParse({ cardLast4: '0042' }).success, true);
    assert.equal(updateAccountSchema.safeParse({ cardNetwork: null }).success, true);
    assert.deepEqual(issuePaths(updateAccountSchema.safeParse({ cardLast4: '42' })), ['cardLast4']);
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

  const walletWide = {
    walletId: ACCOUNT_A,
    name: 'Whole wallet',
    amount: '1000',
    currency: 'VND',
    startDate: '2026-10-01',
    endDate: '2026-10-31',
  };

  it('accepts a wallet-wide budget naming neither a category nor a goal', () => {
    const result = createBudgetSchema.safeParse({ ...walletWide, periodType: 'MONTHLY', endDate: null });
    assert.equal(result.success, true, JSON.stringify(issuePaths(result)));
  });

  it('accepts every period chk_budget_period admits, and nothing else', () => {
    for (const periodType of BUDGET_PERIOD_TYPES) {
      const endDate = isRepeatingBudgetPeriod(periodType) ? null : walletWide.endDate;
      const body = periodType === 'GOAL' ? { ...walletWide, goalId: GOAL, periodType, endDate } : { ...walletWide, periodType, endDate };
      assert.equal(createBudgetSchema.safeParse(body).success, true, periodType);
    }
    assert.ok(issuePaths(createBudgetSchema.safeParse({ ...walletWide, periodType: 'HOURLY' })).includes('periodType'));
  });

  it('BUD-US-01: a repeating period refuses an end date, a fixed one requires it (chk_budget_end)', () => {
    for (const periodType of ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const) {
      assert.deepEqual(issuePaths(createBudgetSchema.safeParse({ ...walletWide, periodType })), ['endDate'], periodType);
    }
    assert.deepEqual(issuePaths(createBudgetSchema.safeParse({ ...walletWide, periodType: 'CUSTOM', endDate: null })), ['endDate']);
    assert.equal(createBudgetSchema.safeParse({ ...walletWide, periodType: 'MONTHLY', endDate: undefined }).success, true);
  });

  it('BUD-US-01: refuses a budget naming both a category and a goal (chk_budget_kind)', () => {
    const result = createBudgetSchema.safeParse({ ...walletWide, categoryId: CATEGORY, goalId: GOAL, periodType: 'GOAL' });
    assert.ok(issuePaths(result).includes('goalId'));
  });

  it('BUD-US-01: pairs the goal period with a goal, and a goal with the goal period', () => {
    assert.ok(issuePaths(createBudgetSchema.safeParse({ ...walletWide, periodType: 'GOAL' })).includes('goalId'));
    assert.ok(issuePaths(createBudgetSchema.safeParse({ ...walletWide, goalId: GOAL, periodType: 'MONTHLY' })).includes('periodType'));
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

  it('accepts pageSize up to the maximum and rejects zero, fractions and a page below 1', () => {
    assert.equal(transactionQuerySchema.safeParse({ pageSize: '200' }).success, true);
    // A page past MAX_PAGE would make an offset Postgres can't read (`?page=1e20` was a 500).
    for (const query of [{ pageSize: '201' }, { pageSize: '0' }, { pageSize: '2.5' }, { page: '0' }, { page: '1000001' }, { page: '1e20' }]) {
      assert.equal(transactionQuerySchema.safeParse(query).success, false, JSON.stringify(query));
    }
  });

  it('rejects a date that does not exist, which Postgres would answer with a 500 and Date would roll over', () => {
    for (const dateTo of ['2026-02-30', '2025-02-29', '2026-13-01', '2026-00-10', '2026-04-31', '0000-01-01']) {
      assert.deepEqual(issuePaths(transactionQuerySchema.safeParse({ dateTo })), ['dateTo'], dateTo);
    }
    for (const dateTo of ['2024-02-29', '2000-02-29', '2026-12-31']) {
      assert.equal(transactionQuerySchema.safeParse({ dateTo }).success, true, dateTo);
    }
    assert.equal(transactionQuerySchema.safeParse({ dateTo: '1900-02-29' }).success, false, 'not a leap year');
  });

  it('rejects a zero amount filter, since amounts are always positive', () => {
    assert.deepEqual(issuePaths(transactionQuerySchema.safeParse({ minAmount: '0' })), ['minAmount']);
  });
});

describe('positiveAmountSchema and signedAmountSchema', () => {
  it(
    'rejects a positive number with more than four decimals rather than passing it on',
    () => {
      assert.equal(positiveAmountSchema.safeParse(1.23456).success, false);
    },
  );

  it(
    'rejects a signed number with more than four decimals rather than passing it on',
    () => {
      assert.equal(signedAmountSchema.safeParse(-1.23456).success, false);
    },
  );

  it('rejects NaN and infinities', () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      assert.equal(positiveAmountSchema.safeParse(bad).success, false, `positive ${bad}`);
      assert.equal(signedAmountSchema.safeParse(bad).success, false, `signed ${bad}`);
    }
  });

  it('refuses a JSON number past 15 significant digits, whose typed digits float64 has already lost', () => {
    // JSON.parse turns 100000000000000.01 into ...0.0156, which would be stored as ...0.02.
    for (const lost of [JSON.parse('100000000000000.01'), JSON.parse('1234567890123.4567'), 1e11]) {
      assert.equal(positiveAmountSchema.safeParse(lost).success, false, `positive ${lost}`);
      assert.equal(signedAmountSchema.safeParse(-lost).success, false, `signed ${-lost}`);
    }
    assert.equal(positiveAmountSchema.parse('100000000000000.01'), '100000000000000.01');
    assert.equal(positiveAmountSchema.parse(99999999999.9999), '99999999999.9999');
  });

  it('strips thousands separators from the returned string, so a comma never reaches the database', () => {
    assert.equal(positiveAmountSchema.parse('1,500,000.50'), '1500000.50');
    assert.equal(signedAmountSchema.parse('-2,000,000'), '-2000000');
  });
});

describe('loginSchema', () => {
  it('trims and lowercases the email, so the per-email lockout counts one address however it is typed', () => {
    const result = loginSchema.safeParse({ email: '  TAM@Example.COM ', password: 'x' });
    assert.equal(result.success, true, JSON.stringify(issuePaths(result)));
    assert.equal(result.data?.email, 'tam@example.com');
  });
});

describe('update schemas', () => {
  it('reject an empty body as nothing to update', () => {
    assert.equal(updateTransactionSchema.safeParse({}).success, false);
    assert.equal(updatePreferencesSchema.safeParse({}).success, false);
  });

  it('keep amount, type, currency and accounts on a transaction update (BR-03)', () => {
    const body = { amount: '5', type: 'INCOME', currency: 'USD', fromAccountId: null, toAccountId: ACCOUNT_B };
    const result = updateTransactionSchema.safeParse(body);
    assert.equal(result.success, true, JSON.stringify(issuePaths(result)));
    assert.deepEqual(result.data, body);
  });

  it('merge an update over the stored transaction in create shape', () => {
    const stored = {
      type: 'EXPENSE' as const,
      amount: '100.0000',
      currency: 'VND',
      fromAccountId: ACCOUNT_A,
      toAccountId: null,
      categoryId: CATEGORY,
      goalId: GOAL,
      description: 'Lunch',
      transactionDate: baseDate,
      reference: null,
    };
    assert.equal(movesMoney({ description: 'x' }), false);
    assert.equal(movesMoney({ fromAccountId: null }), true);

    const amount = createTransactionSchema.safeParse(mergeTransactionUpdate(stored, { amount: '5' }));
    assert.equal(amount.success, true, JSON.stringify(issuePaths(amount)));
    assert.deepEqual([amount.data?.amount, amount.data?.type, amount.data?.goalId], ['5', 'EXPENSE', GOAL]);

    const income = mergeTransactionUpdate(stored, { type: 'INCOME', toAccountId: ACCOUNT_B, categoryId: CATEGORY });
    assert.equal('fromAccountId' in income, false, 'the side income does not use is dropped');
    assert.deepEqual([income.toAccountId, income.goalId], [ACCOUNT_B, null], 'the goal tag lapses off a non-expense');

    const half = createTransactionSchema.safeParse(mergeTransactionUpdate(stored, { type: 'INCOME' }));
    assert.deepEqual(issuePaths(half), ['toAccountId'], 'a type change without the account its new type needs is refused');
  });

  it('validate the money fields of a transaction update like a create', () => {
    assert.deepEqual(issuePaths(updateTransactionSchema.safeParse({ amount: '0' })), ['amount']);
    assert.equal(updateTransactionSchema.safeParse({ amount: 5 }).data?.amount, '5', 'a number amount is normalised to a string, as on create');
    assert.deepEqual(issuePaths(updateTransactionSchema.safeParse({ type: 'REFUND' })), ['type']);
    assert.deepEqual(issuePaths(updateTransactionSchema.safeParse({ currency: 'vnd' })), ['currency']);
    assert.deepEqual(issuePaths(updateTransactionSchema.safeParse({ fromAccountId: 'nope' })), ['fromAccountId']);
  });
});
