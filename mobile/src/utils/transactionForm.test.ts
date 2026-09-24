import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  buildCreatePayload,
  categoryTypeFor,
  emptyDraft,
  fieldsForType,
  isCrossWalletDraft,
  primaryAccountOf,
  setPrimaryAccount,
  switchType,
  validateDraft,
  type TransactionDraft,
} from './transactionForm.ts';

const ACCOUNT_A = '11111111-1111-4111-8111-111111111111';
const ACCOUNT_B = '22222222-2222-4222-8222-222222222222';
const CATEGORY = '33333333-3333-4333-8333-333333333333';
const WHEN = '2026-08-22T12:30:00Z';

function draft(overrides: Partial<TransactionDraft> = {}): TransactionDraft {
  return {
    ...emptyDraft({ currency: 'VND', transactionDate: WHEN }),
    ...overrides,
  };
}

describe('fieldsForType', () => {
  it('matches the shape table each type is allowed', () => {
    assert.deepEqual(fieldsForType('EXPENSE'), {
      fromAccount: true,
      toAccount: false,
      category: true,
    });
    assert.deepEqual(fieldsForType('INCOME'), {
      fromAccount: false,
      toAccount: true,
      category: true,
    });
    assert.deepEqual(fieldsForType('TRANSFER'), {
      fromAccount: true,
      toAccount: true,
      category: true,
    });
  });
});

describe('categoryTypeFor', () => {
  it('maps each transaction type to the category type of the same name', () => {
    assert.equal(categoryTypeFor('EXPENSE'), 'EXPENSE');
    assert.equal(categoryTypeFor('INCOME'), 'INCOME');
    assert.equal(categoryTypeFor('TRANSFER'), 'TRANSFER');
  });
});

describe('switchType', () => {
  it('is a no-op for the same type, preserving object identity', () => {
    const original = draft({ fromAccountId: ACCOUNT_A });
    assert.equal(switchType(original, 'EXPENSE'), original);
  });

  it('carries an expense account to the destination side when becoming income', () => {
    const next = switchType(draft({ type: 'EXPENSE', fromAccountId: ACCOUNT_A }), 'INCOME');
    assert.equal(next.toAccountId, ACCOUNT_A, 'the picked account must survive the toggle');
    assert.equal(next.fromAccountId, null, 'income owns no source account');
  });

  it('carries an income account to the source side when becoming an expense', () => {
    const next = switchType(draft({ type: 'INCOME', toAccountId: ACCOUNT_A }), 'EXPENSE');
    assert.equal(next.fromAccountId, ACCOUNT_A);
    assert.equal(next.toAccountId, null);
  });

  it('always clears the category, since no prior choice can still be valid', () => {
    for (const [from, to] of [
      ['EXPENSE', 'INCOME'],
      ['INCOME', 'EXPENSE'],
      ['EXPENSE', 'TRANSFER'],
      ['INCOME', 'TRANSFER'],
    ] as const) {
      const next = switchType(draft({ type: from, categoryId: CATEGORY }), to);
      assert.equal(next.categoryId, null, `${from} -> ${to} must drop the category`);
    }
  });

  it('keeps the SOURCE when a transfer becomes an expense', () => {
    const next = switchType(
      draft({ type: 'TRANSFER', fromAccountId: ACCOUNT_A, toAccountId: ACCOUNT_B }),
      'EXPENSE',
    );
    assert.equal(next.fromAccountId, ACCOUNT_A, 'money was leaving A');
    assert.equal(next.toAccountId, null);
  });

  it('keeps the DESTINATION when a transfer becomes income', () => {
    const next = switchType(
      draft({ type: 'TRANSFER', fromAccountId: ACCOUNT_A, toAccountId: ACCOUNT_B }),
      'INCOME',
    );
    // The user was sending money INTO B. Reading the source instead silently
    // retargets the entry at the wrong account, and both are valid uuids so
    // nothing downstream complains.
    assert.equal(next.toAccountId, ACCOUNT_B, 'income lands where the money was going');
    assert.equal(next.fromAccountId, null);
  });

  it('promotes a single account to the source side when becoming a transfer', () => {
    const fromIncome = switchType(draft({ type: 'INCOME', toAccountId: ACCOUNT_A }), 'TRANSFER');
    assert.equal(fromIncome.fromAccountId, ACCOUNT_A);
    assert.equal(fromIncome.toAccountId, null, 'the other leg is still unpicked');

    const fromExpense = switchType(
      draft({ type: 'EXPENSE', fromAccountId: ACCOUNT_A }),
      'TRANSFER',
    );
    assert.equal(fromExpense.fromAccountId, ACCOUNT_A);
    assert.equal(fromExpense.toAccountId, null);
  });

  it('never leaves a transfer pointing at one account on both sides', () => {
    const next = switchType(draft({ type: 'EXPENSE', fromAccountId: ACCOUNT_A }), 'TRANSFER');
    assert.notEqual(
      next.fromAccountId,
      next.toAccountId,
      'a self-transfer is rejected by the schema and the database',
    );
  });
});

describe('primary account helpers', () => {
  it('reads and writes whichever side the current type owns', () => {
    const expense = setPrimaryAccount(draft({ type: 'EXPENSE' }), ACCOUNT_A);
    assert.equal(expense.fromAccountId, ACCOUNT_A);
    assert.equal(primaryAccountOf(expense), ACCOUNT_A);

    const income = setPrimaryAccount(draft({ type: 'INCOME' }), ACCOUNT_A);
    assert.equal(income.toAccountId, ACCOUNT_A);
    assert.equal(primaryAccountOf(income), ACCOUNT_A);
  });
});

describe('buildCreatePayload', () => {
  it('omits keys the selected type does not own, rather than sending null', () => {
    const payload = buildCreatePayload(
      draft({ type: 'EXPENSE', fromAccountId: ACCOUNT_A, categoryId: CATEGORY, amount: '150000' }),
    ) as Record<string, unknown>;

    assert.equal('toAccountId' in payload, false, 'no union member carries it on an expense');
    assert.equal(payload.fromAccountId, ACCOUNT_A);
  });

  it('sends the chosen category on a transfer', () => {
    const payload = buildCreatePayload(
      draft({
        type: 'TRANSFER',
        fromAccountId: ACCOUNT_A,
        toAccountId: ACCOUNT_B,
        categoryId: CATEGORY,
        amount: '500000',
      }),
    ) as Record<string, unknown>;

    assert.equal(payload.categoryId, CATEGORY);
  });

  it('accepts a transfer with no category, since it is optional there', () => {
    const result = validateDraft(
      draft({ type: 'TRANSFER', fromAccountId: ACCOUNT_A, toAccountId: ACCOUNT_B, amount: '500000' }),
    );
    assert.equal(result.ok, true);
  });

  it('turns blank text into null so an empty note is absent, not an empty string', () => {
    const payload = buildCreatePayload(
      draft({
        type: 'EXPENSE',
        fromAccountId: ACCOUNT_A,
        categoryId: CATEGORY,
        amount: '1000',
        description: '   ',
        reference: '',
      }),
    ) as Record<string, unknown>;

    assert.equal(payload.description, null);
    assert.equal(payload.reference, null);
  });
});

describe('validateDraft', () => {
  it('accepts a complete expense', () => {
    const result = validateDraft(
      draft({ type: 'EXPENSE', fromAccountId: ACCOUNT_A, categoryId: CATEGORY, amount: '150000' }),
    );
    assert.equal(result.ok, true);
  });

  it('reports a missing amount against the amount field', () => {
    const result = validateDraft(
      draft({ type: 'EXPENSE', fromAccountId: ACCOUNT_A, categoryId: CATEGORY, amount: '' }),
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.issues.some((issue) => issue.path === 'amount'));
  });

  it('reports a missing account on a path the form actually has', () => {
    const result = validateDraft(
      draft({ type: 'EXPENSE', categoryId: CATEGORY, amount: '1000' }),
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(
      result.issues.some((issue) => issue.path === 'fromAccountId'),
      `expected a fromAccountId issue, got ${JSON.stringify(result.issues)}`,
    );
  });

  it('rejects a self-transfer, matching the database constraint', () => {
    const result = validateDraft(
      draft({
        type: 'TRANSFER',
        fromAccountId: ACCOUNT_A,
        toAccountId: ACCOUNT_A,
        amount: '1000',
      }),
    );
    assert.equal(result.ok, false);
  });

  it('rejects a zero amount', () => {
    const result = validateDraft(
      draft({ type: 'EXPENSE', fromAccountId: ACCOUNT_A, categoryId: CATEGORY, amount: '0' }),
    );
    assert.equal(result.ok, false);
  });

  it('accepts a cross-wallet transfer, which is a supported entry', () => {
    const result = validateDraft(
      draft({
        type: 'TRANSFER',
        fromAccountId: ACCOUNT_A,
        toAccountId: ACCOUNT_B,
        amount: '500000',
      }),
    );
    assert.equal(result.ok, true);
  });
});

describe('isCrossWalletDraft', () => {
  const wallets: Record<string, string> = { [ACCOUNT_A]: 'wallet-1', [ACCOUNT_B]: 'wallet-2' };
  const lookup = (id: string): string | undefined => wallets[id];

  it('flags a transfer whose legs sit in different wallets', () => {
    assert.equal(
      isCrossWalletDraft(
        draft({ type: 'TRANSFER', fromAccountId: ACCOUNT_A, toAccountId: ACCOUNT_B }),
        lookup,
      ),
      true,
    );
  });

  it('does not flag a transfer inside one wallet', () => {
    const sameWallet = (): string => 'wallet-1';
    assert.equal(
      isCrossWalletDraft(
        draft({ type: 'TRANSFER', fromAccountId: ACCOUNT_A, toAccountId: ACCOUNT_B }),
        sameWallet,
      ),
      false,
    );
  });

  it('is never true for an expense or income', () => {
    assert.equal(
      isCrossWalletDraft(draft({ type: 'EXPENSE', fromAccountId: ACCOUNT_A }), lookup),
      false,
    );
  });

  it('is false while a leg is still unpicked', () => {
    assert.equal(
      isCrossWalletDraft(draft({ type: 'TRANSFER', fromAccountId: ACCOUNT_A }), lookup),
      false,
    );
  });

  it('is false when an account is unknown, rather than guessing', () => {
    assert.equal(
      isCrossWalletDraft(
        draft({ type: 'TRANSFER', fromAccountId: ACCOUNT_A, toAccountId: 'unknown' }),
        lookup,
      ),
      false,
    );
  });
});
