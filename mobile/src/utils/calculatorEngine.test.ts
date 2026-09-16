import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { formatMoney } from '@sora/contracts';

import { CalculatorError, evaluateExpression, tryEvaluate } from './calculatorEngine.ts';

function evalToString(expression: string): string {
  return formatMoney(evaluateExpression(expression));
}

describe('evaluateExpression', () => {
  it('evaluates a plain literal', () => {
    assert.equal(evalToString('1500'), '1500.0000');
  });

  it('adds and subtracts left to right', () => {
    assert.equal(evalToString('100+50-20'), '130.0000');
  });

  it('respects * and / over + and -', () => {
    assert.equal(evalToString('10+2*3'), '16.0000');
    assert.equal(evalToString('20-8/4'), '18.0000');
  });

  it('honors parentheses', () => {
    assert.equal(evalToString('(10+2)*3'), '36.0000');
  });

  it('applies unary minus tighter than any binary operator', () => {
    assert.equal(evalToString('-5+10'), '5.0000');
    assert.equal(evalToString('3*-2'), '-6.0000');
  });

  it('computes integer powers, right-associatively', () => {
    assert.equal(evalToString('2^3'), '8.0000');
    assert.equal(evalToString('2^3^2'), '512.0000', '2^(3^2), not (2^2)^3');
  });

  it('computes a negative power as a reciprocal', () => {
    assert.equal(evalToString('2^-2'), '0.2500');
  });

  it('divides with half-up rounding to MONEY_SCALE', () => {
    assert.equal(evalToString('1/3'), '0.3333');
    assert.equal(evalToString('2/3'), '0.6667');
  });

  it('rejects division by zero', () => {
    assert.throws(() => evaluateExpression('5/0'), CalculatorError);
  });

  it('rejects a fractional exponent', () => {
    assert.throws(() => evaluateExpression('2^1.5'), CalculatorError);
  });

  it('rejects an incomplete expression', () => {
    assert.throws(() => evaluateExpression('12+'), CalculatorError);
    assert.throws(() => evaluateExpression('(12+3'), CalculatorError);
    assert.throws(() => evaluateExpression(''), CalculatorError);
  });

  it('rejects a value out of DECIMAL(19,4) range', () => {
    assert.throws(() => evaluateExpression('99999999999999999999+1'), CalculatorError);
  });
});

describe('tryEvaluate', () => {
  it('returns the value for a complete expression', () => {
    assert.equal(tryEvaluate('4*5'), 200000n);
  });

  it('returns null instead of throwing for an incomplete expression', () => {
    assert.equal(tryEvaluate('4*'), null);
    assert.equal(tryEvaluate(''), null);
  });
});
