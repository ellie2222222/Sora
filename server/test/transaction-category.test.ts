import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import type { CategoryType, TransactionType } from '@sora/contracts';

import { AppError } from '../src/common/app-error.ts';
import {
  assertCategoryFits,
  assertCategoryRemovable,
  categorisedAccountId,
} from '../src/transactions/transaction-category.ts';

const WALLET = 'wallet-own';
const OTHER_WALLET = 'wallet-other';

function codeOf(work: () => void): string | null {
  try {
    work();
    return null;
  } catch (error) {
    assert.ok(error instanceof AppError, `expected an AppError, got ${String(error)}`);
    return error.code;
  }
}

describe('assertCategoryFits', () => {
  const cases: [TransactionType, CategoryType, string | null][] = [
    ['EXPENSE', 'EXPENSE', null],
    ['INCOME', 'INCOME', null],
    ['TRANSFER', 'TRANSFER', null],
    ['EXPENSE', 'TRANSFER', 'CATEGORY_WRONG_TYPE'],
    ['INCOME', 'TRANSFER', 'CATEGORY_WRONG_TYPE'],
    ['TRANSFER', 'EXPENSE', 'CATEGORY_WRONG_TYPE'],
    ['TRANSFER', 'INCOME', 'CATEGORY_WRONG_TYPE'],
  ];

  for (const [transactionType, categoryType, expected] of cases) {
    it(`${transactionType} with a ${categoryType} category → ${expected ?? 'accepted'}`, () => {
      const code = codeOf(() => assertCategoryFits({ type: categoryType, wallet_id: WALLET, visibleToCaller: true }, transactionType, WALLET));
      assert.equal(code, expected);
    });
  }

  it("rejects a matching category from another wallet — the leak AC-03's per-wallet check exists to stop", () => {
    const code = codeOf(() => assertCategoryFits({ type: 'TRANSFER', wallet_id: OTHER_WALLET, visibleToCaller: true }, 'TRANSFER', WALLET));
    assert.equal(code, 'CATEGORY_WRONG_WALLET');
  });

  it('answers a category in a wallet the caller cannot see as not found, before its type or wallet (AC-01)', () => {
    const hidden = { type: 'INCOME' as const, wallet_id: OTHER_WALLET, visibleToCaller: false };
    assert.equal(codeOf(() => assertCategoryFits(hidden, 'EXPENSE', WALLET)), 'CATEGORY_NOT_FOUND');
    assert.equal(codeOf(() => assertCategoryFits({ ...hidden, type: 'EXPENSE' }, 'EXPENSE', WALLET)), 'CATEGORY_NOT_FOUND');
  });

  it('reports a missing category as not found before judging its type', () => {
    assert.equal(codeOf(() => assertCategoryFits(undefined, 'TRANSFER', WALLET)), 'CATEGORY_NOT_FOUND');
  });
});

describe('categorisedAccountId', () => {
  it("takes the destination for income and the paying side for expense and transfer", () => {
    assert.equal(categorisedAccountId('INCOME', null, 'to'), 'to');
    assert.equal(categorisedAccountId('EXPENSE', 'from', null), 'from');
    assert.equal(categorisedAccountId('TRANSFER', 'from', 'to'), 'from');
  });
});

describe('assertCategoryRemovable', () => {
  it('lets only a transfer drop its category', () => {
    assert.equal(codeOf(() => assertCategoryRemovable('TRANSFER')), null);
    assert.equal(codeOf(() => assertCategoryRemovable('EXPENSE')), 'CATEGORY_WRONG_TYPE');
    assert.equal(codeOf(() => assertCategoryRemovable('INCOME')), 'CATEGORY_WRONG_TYPE');
  });
});
