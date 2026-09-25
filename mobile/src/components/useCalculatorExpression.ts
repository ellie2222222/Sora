import { useMemo, useRef, useState, type RefObject } from 'react';
import type { Scaled } from '@sora/contracts';

import { confirmExpression, formatExpressionDisplay, tryEvaluate } from '@/utils';

export interface CalculatorExpression {
  expression: string;
  setExpression: (next: string) => void;
  /** For `CalculatorKeypad`, which reads the live value at press time without re-rendering its grid. */
  expressionRef: RefObject<string>;
  evaluated: Scaled | null;
  /** Display text for the amount; `empty` is shown for a blank expression. */
  display: string;
  /** Applies one confirm tap (see `confirmExpression`); returns the amount to submit, or `null` while still editing. */
  confirm: () => string | null;
}

/**
 * The expression state every amount field driving a `CalculatorKeypad` shares. When an expression
 * commits (live, or on a confirm tap) stays with each caller — MoneyInput and the create sheets
 * deliberately differ there.
 */
export function useCalculatorExpression(initial: string, empty = ''): CalculatorExpression {
  const [expression, setExpression] = useState(initial);
  const expressionRef = useRef(expression);
  expressionRef.current = expression;

  const evaluated = useMemo(() => tryEvaluate(expression), [expression]);
  const display = useMemo(() => formatExpressionDisplay(expression, evaluated, empty), [expression, evaluated, empty]);

  function confirm(): string | null {
    const outcome = confirmExpression(expression, evaluated);
    if (outcome === null) return null;
    if ('edit' in outcome) {
      setExpression(outcome.edit);
      return null;
    }
    return outcome.submit;
  }

  return { expression, setExpression, expressionRef, evaluated, display, confirm };
}
