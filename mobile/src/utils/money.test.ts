import { strict as assert } from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { TransactionType, type TransactionResponse } from '@sora/contracts';

import { directionOf, formatMoneyString, sumByTransactionType, tryParseMoney } from './money.ts';

describe('formatMoneyString — zero-decimal currency (VND)', () => {
  it('prints whole dong with no fraction digits', () => {
    assert.equal(formatMoneyString('150000', 'VND'), '₫150,000');
  });

  it('rounds half away from zero, for positives and negatives alike', () => {
    assert.equal(formatMoneyString('150000.5', 'VND'), '₫150,001');
    assert.equal(formatMoneyString('150000.4999', 'VND'), '₫150,000');
    assert.equal(formatMoneyString('-150000.5', 'VND'), '-₫150,001');
    assert.equal(formatMoneyString('-150000.4999', 'VND'), '-₫150,000');
  });

  it('treats the currency code case-insensitively when choosing its decimals', () => {
    assert.equal(formatMoneyString('150000.5', 'vnd'), '₫150,001');
  });

  it('follows the requested locale for separators and symbol position', () => {
    assert.equal(formatMoneyString('150000', 'VND', { locale: 'vi-VN' }), '150.000 ₫');
  });

  it('prints the largest whole amount DECIMAL(19,4) holds without losing a digit', () => {
    assert.equal(formatMoneyString('999999999999999.4999', 'VND'), '₫999,999,999,999,999');
  });
});

describe('formatMoneyString — two-decimal currency (USD)', () => {
  it('always shows two fraction digits', () => {
    assert.equal(formatMoneyString('1234.5', 'USD'), '$1,234.50');
    assert.equal(formatMoneyString('1234.5', 'USD', { locale: 'vi-VN' }), '1.234,50 $');
  });

  it('rounds the stored fourth decimal half away from zero', () => {
    assert.equal(formatMoneyString('0.005', 'USD'), '$0.01');
    assert.equal(formatMoneyString('-0.005', 'USD'), '-$0.01');
    assert.equal(formatMoneyString('0.0049', 'USD'), '$0.00');
  });

  it('keeps every cent of a total too large for a float to hold at cent precision', () => {
    assert.equal(formatMoneyString('123456789012345.67', 'USD'), '$123,456,789,012,345.67');
    assert.equal(formatMoneyString('999999999999999.99', 'USD'), '$999,999,999,999,999.99');
  });
});

describe('formatMoneyString — options', () => {
  it('prefixes + only on a non-zero positive when signDisplay is always', () => {
    assert.equal(formatMoneyString('10', 'USD', { signDisplay: 'always' }), '+$10.00');
    assert.equal(formatMoneyString('-10', 'USD', { signDisplay: 'always' }), '-$10.00');
    assert.equal(formatMoneyString('0', 'USD', { signDisplay: 'always' }), '$0.00');
  });

  it('drops the sign entirely when signDisplay is never', () => {
    assert.equal(formatMoneyString('-10', 'USD', { signDisplay: 'never' }), '$10.00');
  });

  it('omits the symbol but keeps the sign when hideCurrency is set', () => {
    assert.equal(formatMoneyString('-1234.5', 'USD', { hideCurrency: true }), '-1,234.50');
  });

  it('abbreviates when compact is set', () => {
    assert.equal(formatMoneyString('12000000', 'VND', { compact: true }), '₫12M');
  });
});

describe('formatMoneyString — fallback without a usable Intl', () => {
  it('prints grouped digits and the upper-cased code for a code Intl rejects', () => {
    assert.equal(formatMoneyString('1234.5', 'ABCD'), '1,234.50 ABCD');
  });

  describe('when Intl.NumberFormat throws', () => {
    const realNumberFormat = Intl.NumberFormat;

    beforeEach(() => {
      // Hermes's platform Intl can be missing on older OS versions; simulate that.
      Intl.NumberFormat = function unavailable() {
        throw new TypeError('Intl.NumberFormat is not available');
      } as unknown as typeof Intl.NumberFormat;
    });

    afterEach(() => {
      Intl.NumberFormat = realNumberFormat;
    });

    it('still prints a readable, correctly signed figure', () => {
      assert.equal(formatMoneyString('1234567.8', 'USD'), '1,234,567.80 USD');
      assert.equal(formatMoneyString('-150000', 'VND'), '-150,000 VND');
      assert.equal(formatMoneyString('10', 'USD', { signDisplay: 'always' }), '+10.00 USD');
      assert.equal(formatMoneyString('0', 'USD', { signDisplay: 'always' }), '0.00 USD');
      assert.equal(formatMoneyString('-10', 'USD', { signDisplay: 'never' }), '10.00 USD');
      assert.equal(formatMoneyString('-10', 'USD', { hideCurrency: true }), '-10.00');
    });

    it('rounds to the currency decimals, as the Intl path does', () => {
      assert.equal(formatMoneyString('150000.5', 'VND'), '150,001 VND');
      assert.equal(formatMoneyString('0.005', 'USD'), '0.01 USD');
    });
  });
});

describe('tryParseMoney', () => {
  it('returns null for text that is not yet an amount', () => {
    assert.equal(tryParseMoney(''), null);
    assert.equal(tryParseMoney('   '), null);
    assert.equal(tryParseMoney('abc'), null);
    assert.equal(tryParseMoney('1,000'), null);
  });

  it('rejects a fifth decimal instead of rounding away a digit the user typed', () => {
    assert.equal(tryParseMoney('1.23456'), null);
  });

  it('parses trimmed input into scaled minor units, keeping a sign', () => {
    assert.equal(tryParseMoney(' 12.5 '), 125000n);
    assert.equal(tryParseMoney('-3'), -30000n);
  });
});

describe('directionOf', () => {
  it('classifies a transfer as neither in nor out (BR-06)', () => {
    assert.equal(directionOf(TransactionType.INCOME), 'in');
    assert.equal(directionOf(TransactionType.EXPENSE), 'out');
    assert.equal(directionOf(TransactionType.TRANSFER), 'neutral');
  });
});

function tx(overrides: Partial<TransactionResponse>): TransactionResponse {
  return { type: 'EXPENSE', currency: 'VND', amount: '0.0000', status: 'COMPLETED', ...overrides } as TransactionResponse;
}

describe('sumByTransactionType', () => {
  it('totals each currency separately and never across currencies (BR-07)', () => {
    const totals = sumByTransactionType(
      [
        tx({ amount: '150000.0000', currency: 'VND' }),
        tx({ amount: '12.5000', currency: 'USD' }),
        tx({ amount: '50000.0000', currency: 'VND' }),
      ],
      'EXPENSE',
    );

    assert.deepEqual(totals, [
      { currency: 'VND', amount: '200000.0000' },
      { currency: 'USD', amount: '12.5000' },
    ]);
  });

  it('sums exactly where float addition would drift', () => {
    const totals = sumByTransactionType(
      [tx({ amount: '0.1000', currency: 'USD' }), tx({ amount: '0.2000', currency: 'USD' })],
      'EXPENSE',
    );
    assert.deepEqual(totals, [{ currency: 'USD', amount: '0.3000' }]);
  });

  it('leaves transfers out of both income and expense (BR-06)', () => {
    const rows = [
      tx({ type: 'TRANSFER', amount: '2000000.0000' }),
      tx({ type: 'INCOME', amount: '500000.0000' }),
    ];

    assert.deepEqual(sumByTransactionType(rows, 'INCOME'), [{ currency: 'VND', amount: '500000.0000' }]);
    assert.deepEqual(sumByTransactionType(rows, 'EXPENSE'), []);
  });

  it('counts only COMPLETED rows, as balances do (affectsBalance)', () => {
    const totals = sumByTransactionType(
      [
        tx({ amount: '100.0000' }),
        tx({ amount: '20.0000', status: 'PENDING' }),
        tx({ amount: '3.0000', status: 'DELETED' }),
      ],
      'EXPENSE',
    );
    assert.deepEqual(totals, [{ currency: 'VND', amount: '100.0000' }]);
  });
});
