import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import type { AccountResponse } from '@sora/contracts';

import { formatScaled } from '../../utils/money.ts';
import { headlineSizeFor, netWorthByCurrency, splitMoneyText } from './netWorth.ts';

const account = (currency: string, balance: string) => ({ currency, balance }) as AccountResponse;

describe('netWorthByCurrency', () => {
  it('keeps every currency separate and counts a negative balance as a liability (BR-07, VL-04)', () => {
    const result = netWorthByCurrency([
      account('VND', '81814100.0000'),
      account('VND', '-3299000.0000'),
      account('USD', '5809.1800'),
      account('JPY', '8920.0000'),
    ]);
    assert.deepEqual(result.netWorth, [
      { currency: 'VND', amount: '78515100.0000' },
      { currency: 'USD', amount: '5809.1800' },
      { currency: 'JPY', amount: '8920.0000' },
    ]);
    assert.deepEqual(result.liabilities, [{ currency: 'VND', amount: '3299000.0000' }]);
    assert.equal(result.assets.length, 3);
  });

  it('reports a negative net worth when debts outweigh assets', () => {
    assert.deepEqual(netWorthByCurrency([account('USD', '100.0000'), account('USD', '-250.5000')]).netWorth, [
      { currency: 'USD', amount: '-150.5000' },
    ]);
  });

  it('reports a zero net worth and no liabilities for an all-zero wallet', () => {
    const result = netWorthByCurrency([account('VND', '0.0000')]);
    assert.deepEqual(result.netWorth, [{ currency: 'VND', amount: '0.0000' }]);
    assert.deepEqual(result.liabilities, []);
  });
});

describe('splitMoneyText', () => {
  const cases: [string, string][] = [
    ['VND', '78515100.0000'],
    ['USD', '-150.5000'],
    ['JPY', '8920.0000'],
    ['EUR', '1234.5600'],
  ];
  for (const [currency, amount] of cases) {
    it(`cuts ${currency} ${amount} into parts that join back to the same text`, () => {
      const text = formatScaled(BigInt(amount.replace('.', '')), currency);
      const parts = splitMoneyText(text);
      assert.equal(parts.sign + parts.prefix + parts.digits + parts.suffix, text);
      assert.match(parts.digits, /^\d/);
    });
  }

  it('puts the minus before the mark and the mark apart from the digits', () => {
    assert.deepEqual(splitMoneyText('-$150.50'), { sign: '-', prefix: '$', digits: '150.50', suffix: '' });
    assert.deepEqual(splitMoneyText('₫78,515,100'), { sign: '', prefix: '₫', digits: '78,515,100', suffix: '' });
    assert.deepEqual(splitMoneyText('78,515,100 VND'), { sign: '', prefix: '', digits: '78,515,100', suffix: ' VND' });
  });

  it('returns text it cannot read whole, as digits', () => {
    assert.deepEqual(splitMoneyText('—'), { sign: '', prefix: '', digits: '—', suffix: '' });
  });
});

describe('headlineSizeFor', () => {
  it('steps down for long figures instead of letting them clip', () => {
    assert.equal(headlineSizeFor('78,515,100'), 'display');
    assert.equal(headlineSizeFor('1,234,567,890'), 'xxl');
    assert.equal(headlineSizeFor('999,999,999,999,999.99'), 'xl');
  });
});
