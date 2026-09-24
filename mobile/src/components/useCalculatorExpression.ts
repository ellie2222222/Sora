import { useMemo, useRef, useState, type RefObject } from 'react';
import type { Scaled } from '@sora/contracts';

import { formatExpressionDisplay, hasOperator, tryEvaluate } from '@/utils';

export interface CalculatorExpression {
  expression: string;
  setExpression: (next: string) => void;
  /** For `CalculatorKeypad`, which reads the live value at press time without re-rendering its grid. */
  expressionRef: RefObject<string>;
  evaluated: Scaled | null;
  hasOperator: boolean;
  /** Display text for the amount; `empty` is shown for a blank expression. */
  display: string;
}

/**
 * The expression state every amount field driving a `CalculatorKeypad` shares. When an expression
 * commits (live, or on a confirm tap) stays with each caller — MoneyInput and AddTransactionModal
 * deliberately differ there.
 */
export function useCalculatorExpression(initial: string, empty = ''): CalculatorExpression {
  const [expression, setExpression] = useState(initial);
  const expressionRef = useRef(expression);
  expressionRef.current = expression;

  const evaluated = useMemo(() => tryEvaluate(expression), [expression]);
  const display = useMemo(() => formatExpressionDisplay(expression, evaluated, empty), [expression, evaluated, empty]);

  return { expression, setExpression, expressionRef, evaluated, hasOperator: hasOperator(expression), display };
}
