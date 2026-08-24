import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  MoneyError,
  add,
  clampPercentage,
  formatMoney,
  formatMoneyCompact,
  isNegative,
  maxOf,
  parseMoney,
  percentageOf,
  subtract,
} from '../src/money.ts';

describe('parseMoney', () => {
  it('scales integers and decimals to minor units', () => {
    assert.equal(parseMoney('0'), 0n);
    assert.equal(parseMoney('1'), 10_000n);
    assert.equal(parseMoney('150000'), 1_500_000_000n);
    assert.equal(parseMoney('1.5'), 15_000n);
    assert.equal(parseMoney('1.2345'), 12_345n);
    assert.equal(parseMoney('-2000000'), -20_000_000_000n);
  });

  it('is exact where float64 is not', () => {
    // 0.1 + 0.2 !== 0.3 in floating point; the whole reason money is scaled.
    assert.equal(add(parseMoney('0.1'), parseMoney('0.2')), parseMoney('0.3'));
    assert.equal(formatMoney(add(parseMoney('0.1'), parseMoney('0.2'))), '0.3001');
  });

  it('does not accumulate drift the way repeated float addition does', () => {
    let float = 0;
    let scaled = 0n;
    for (let i = 0; i < 100; i += 1) {
      float += 0.01;
      scaled = add(scaled, parseMoney('0.01'));
    }
    assert.notEqual(float, 1, 'float addition is expected to drift');
    assert.equal(formatMoneyCompact(scaled), '1');
  });

  it('holds the widest value the column allows', () => {
    const widest = '999999999999999.9999';
    assert.equal(formatMoney(parseMoney(widest)), widest);
    assert.throws(() => parseMoney('9999999999999999.9999'), MoneyError);
  });

  it('rejects more decimals than the column stores rather than rounding them away', () => {
    assert.throws(() => parseMoney('1.23456'), MoneyError);
  });

  it('rejects values beyond DECIMAL(19,4)', () => {
    assert.throws(() => parseMoney('1000000000000000'), MoneyError);
  });

  it('rejects text that is not an amount', () => {
    for (const bad of ['', 'abc', '1,000', '1.2.3', '--1', '1e5', ' ']) {
      assert.throws(() => parseMoney(bad), MoneyError, `should reject ${JSON.stringify(bad)}`);
    }
  });
});

describe('formatMoney', () => {
  it('round-trips through parseMoney', () => {
    for (const value of ['0', '1', '150000', '1.2345', '-2000000', '999.9999']) {
      assert.equal(parseMoney(formatMoney(parseMoney(value))), parseMoney(value));
    }
  });

  it('always emits the full scale', () => {
    assert.equal(formatMoney(parseMoney('1')), '1.0000');
    assert.equal(formatMoney(parseMoney('-1.5')), '-1.5000');
  });

  it('trims trailing zeros only in compact form', () => {
    assert.equal(formatMoneyCompact(parseMoney('1.5000')), '1.5');
    assert.equal(formatMoneyCompact(parseMoney('150000')), '150000');
    assert.equal(formatMoneyCompact(parseMoney('1.50'), 2), '1.50');
  });
});

describe('arithmetic', () => {
  it('adds and subtracts exactly', () => {
    const balance = subtract(
      add(parseMoney('1000000'), parseMoney('15000000')),
      parseMoney('150000'),
      parseMoney('1000000'),
      parseMoney('500000'),
    );
    // The same figure db/tests/001_constraints.sql produces for Vietcombank.
    assert.equal(formatMoneyCompact(balance), '14350000');
  });

  it('reports a negative balance rather than clamping it', () => {
    const overdrawn = subtract(parseMoney('0'), parseMoney('2000000'));
    assert.ok(isNegative(overdrawn));
    assert.equal(formatMoneyCompact(overdrawn), '-2000000');
  });

  it('add() with no arguments is zero, so summing an empty wallet is safe', () => {
    assert.equal(add(), 0n);
  });

  it('maxOf floors at zero for goal remainders', () => {
    assert.equal(maxOf(subtract(parseMoney('30'), parseMoney('40')), 0n), 0n);
  });
});

describe('percentageOf', () => {
  it('matches the SQL progress figure', () => {
    // 13,000,000 of 30,000,000 -> 43.3, as the constraint suite reports.
    assert.equal(percentageOf(parseMoney('13000000'), parseMoney('30000000')), 43.3);
  });

  it('rounds half away from zero', () => {
    assert.equal(percentageOf(parseMoney('1'), parseMoney('16')), 6.3);
    assert.equal(percentageOf(parseMoney('2'), parseMoney('3')), 66.7);
  });

  it('returns 0 rather than NaN when the whole is zero', () => {
    assert.equal(percentageOf(parseMoney('5'), parseMoney('0')), 0);
  });

  it('exceeds 100 for an overspend, so being over budget is visible', () => {
    assert.equal(percentageOf(parseMoney('120'), parseMoney('100')), 120);
  });

  it('honours the requested precision', () => {
    assert.equal(percentageOf(parseMoney('1'), parseMoney('3'), 0), 33);
    assert.equal(percentageOf(parseMoney('1'), parseMoney('3'), 2), 33.33);
  });
});

describe('clampPercentage', () => {
  it('caps and floors', () => {
    assert.equal(clampPercentage(150), 100);
    assert.equal(clampPercentage(-10), 0);
    assert.equal(clampPercentage(42.5), 42.5);
  });

  it('turns NaN into 0 so a progress bar never renders undefined width', () => {
    assert.equal(clampPercentage(Number.NaN), 0);
  });
});
