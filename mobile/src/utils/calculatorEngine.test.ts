import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { formatMoney } from '@sora/contracts';

import { CalculatorError, evaluateExpression, formatExpressionDisplay, hasOperator, hasTrailingOperator, insertToken, spaceExpression, tryEvaluate } from './calculatorEngine.ts';

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

describe('hasTrailingOperator', () => {
  it('is true when the expression ends in an operator glyph', () => {
    assert.equal(hasTrailingOperator('100+'), true);
    assert.equal(hasTrailingOperator('100 + 50 ×'), true);
  });

  it('is false for a complete number or an empty/whitespace expression', () => {
    assert.equal(hasTrailingOperator('100'), false);
    assert.equal(hasTrailingOperator('100+50'), false);
    assert.equal(hasTrailingOperator(''), false);
    assert.equal(hasTrailingOperator('   '), false);
  });
});

describe('hasOperator', () => {
  it('is true when an operator appears anywhere in the expression', () => {
    assert.equal(hasOperator('100+50'), true);
    assert.equal(hasOperator('100+'), true);
    assert.equal(hasOperator('1 × 2 + 3'), true);
  });

  it('is false for a plain number or an empty/whitespace expression', () => {
    assert.equal(hasOperator('100'), false);
    assert.equal(hasOperator(''), false);
    assert.equal(hasOperator('   '), false);
  });
});

describe('insertToken', () => {
  it('appends a digit or operator normally', () => {
    assert.equal(insertToken('100', '+'), '100+');
    assert.equal(insertToken('100+', '5'), '100+5');
  });

  it('replaces a trailing operator instead of stacking a second one', () => {
    assert.equal(insertToken('100+', '×'), '100×');
    assert.equal(insertToken('100−−', '+'), '100−+', 'only the last operator is a candidate to replace');
  });

  it('ignores a second "." within the number currently being typed', () => {
    assert.equal(insertToken('1.5', '.'), '1.5');
    assert.equal(insertToken('100+1.5', '.'), '100+1.5');
  });

  it('allows a fresh "." after an operator starts a new number segment', () => {
    assert.equal(insertToken('100+1.5+', '.'), '100+1.5+.');
  });
});

describe('spaceExpression', () => {
  it('adds a space around each operator, for display only', () => {
    assert.equal(spaceExpression('100+50'), '100 + 50');
    assert.equal(spaceExpression('100+50×2'), '100 + 50 × 2');
  });

  it('collapses to one space and trims a trailing operator', () => {
    assert.equal(spaceExpression('100+'), '100 +');
  });

  it('leaves a plain number or an already-spaced expression unchanged', () => {
    assert.equal(spaceExpression('100'), '100');
    assert.equal(spaceExpression(''), '');
  });

  it('never changes what the expression evaluates to', () => {
    assert.equal(tryEvaluate(spaceExpression('100+50×2')), tryEvaluate('100+50×2'));
  });
});

describe('formatExpressionDisplay', () => {
  it('shows the empty text the caller chose for a blank field', () => {
    assert.equal(formatExpressionDisplay('', null), '');
    assert.equal(formatExpressionDisplay('  ', null, '0'), '0');
  });

  it('echoes an operator expression as typed (spaced), never a running total', () => {
    assert.equal(formatExpressionDisplay('100+5', tryEvaluate('100+5')), '100 + 5');
  });

  it('keeps the sign of a negative plain amount', () => {
    const shown = formatExpressionDisplay('-1500', tryEvaluate('-1500'));
    assert.ok(shown.startsWith('-') && shown.includes('1'), shown);
  });

  it('echoes an expression that does not evaluate yet', () => {
    assert.equal(formatExpressionDisplay('12.', null), '12.');
  });
});
