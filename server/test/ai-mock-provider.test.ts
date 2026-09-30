import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { formatMoney } from '@sora/contracts';

import { normalize, parseAmount } from '../src/ai/mock-llm.provider.ts';

const amount = (message: string) => {
  const value = parseAmount(message);
  return value === null ? null : formatMoney(value);
};

describe('MockLlmProvider amount parsing', () => {
  it('reads shorthand and grouped amounts exactly, never through a float', () => {
    assert.equal(amount('Spent 50k on lunch'), '50000.0000');
    assert.equal(amount('chi 1.5tr tiền nhà'), '1500000.0000');
    assert.equal(amount('paid 65,000 for pho'), '65000.0000');
    assert.equal(amount('trả 65.000 đ'), '65000.0000');
    assert.equal(amount('coffee 12.50'), '12.5000');
    assert.equal(amount('2 triệu lương'), '2000000.0000');
  });

  it('finds no amount where there is none, and never a zero one', () => {
    assert.equal(amount('what is my balance'), null);
    assert.equal(amount('spent 0 today'), null);
  });

  it('matches Vietnamese with or without diacritics', () => {
    assert.equal(normalize('Số dư Đà Nẵng'), 'so du da nang');
  });
});
