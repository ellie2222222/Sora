/**
 * Live expression evaluator for the money-amount calculator keypad.
 *
 * Money itself is never a JS number (CLAUDE.md Part 7 rule 1) — every intermediate value here
 * is a `Scaled` bigint at the same MONEY_SCALE the contract's own `parseMoney` uses, and number
 * literals are parsed through `parseMoney` itself so a typed literal is held to the exact same
 * range/precision rules the server enforces. Only the arithmetic (multiply/divide/power, which
 * `@sora/contracts` has no use for outside this UI) is written here.
 */
import { MONEY_SCALE, parseMoney, type Scaled } from '@sora/contracts';

export class CalculatorError extends Error {}

const SCALE = 10n ** BigInt(MONEY_SCALE);
const MAX_MAGNITUDE = 10n ** 19n - 1n;
const MAX_EXPONENT = 12n;

const OPERATOR_ALIASES: Record<string, '+' | '-' | '*' | '/' | '^'> = {
  '+': '+',
  '-': '-',
  '−': '-',
  '*': '*',
  '×': '*',
  '/': '/',
  '÷': '/',
  '^': '^',
};

type Token =
  | { type: 'number'; value: string }
  | { type: 'operator'; value: '+' | '-' | '*' | '/' | '^' }
  | { type: 'lparen' }
  | { type: 'rparen' };

function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expression.length) {
    const ch = expression.charAt(i);
    if (ch === ' ') {
      i++;
      continue;
    }
    if ((ch >= '0' && ch <= '9') || ch === '.') {
      let j = i + 1;
      let next = expression.charAt(j);
      while (j < expression.length && ((next >= '0' && next <= '9') || next === '.')) {
        j++;
        next = expression.charAt(j);
      }
      tokens.push({ type: 'number', value: expression.slice(i, j) });
      i = j;
      continue;
    }
    if (ch === '(') {
      tokens.push({ type: 'lparen' });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen' });
      i++;
      continue;
    }
    const operator = OPERATOR_ALIASES[ch];
    if (operator !== undefined) {
      tokens.push({ type: 'operator', value: operator });
      i++;
      continue;
    }
    throw new CalculatorError(`Unexpected character: ${ch}`);
  }
  return tokens;
}

function assertInRange(value: Scaled): Scaled {
  const magnitude = value < 0n ? -value : value;
  if (magnitude > MAX_MAGNITUDE) {
    throw new CalculatorError('Result out of range');
  }
  return value;
}

function roundDiv(numerator: bigint, denominator: bigint): bigint {
  const negative = numerator < 0n !== denominator < 0n;
  const n = numerator < 0n ? -numerator : numerator;
  const d = denominator < 0n ? -denominator : denominator;
  const quotient = (n + d / 2n) / d;
  return negative ? -quotient : quotient;
}

function mul(a: Scaled, b: Scaled): Scaled {
  return roundDiv(a * b, SCALE);
}

function div(a: Scaled, b: Scaled): Scaled {
  if (b === 0n) throw new CalculatorError('Division by zero');
  return roundDiv(a * SCALE, b);
}

function power(base: Scaled, exponent: Scaled): Scaled {
  if (exponent % SCALE !== 0n) {
    throw new CalculatorError('Exponent must be a whole number');
  }
  let n = exponent / SCALE;
  const negative = n < 0n;
  if (negative) n = -n;
  if (n > MAX_EXPONENT) throw new CalculatorError('Exponent too large');

  let result = SCALE;
  for (let i = 0n; i < n; i++) {
    result = assertInRange(mul(result, base));
  }
  if (negative) {
    if (result === 0n) throw new CalculatorError('Division by zero');
    result = div(SCALE, result);
  }
  return result;
}

function parseLiteral(raw: string): Scaled {
  let text = raw;
  if (text.startsWith('.')) text = `0${text}`;
  if (text.endsWith('.')) text = text.slice(0, -1);
  if (text === '') throw new CalculatorError('Incomplete number');
  try {
    return parseMoney(text);
  } catch {
    throw new CalculatorError(`Not a valid number: ${raw}`);
  }
}

/**
 * Parse and evaluate a calculator expression into a `Scaled` bigint.
 * Throws `CalculatorError` on anything incomplete or invalid — callers driving a live,
 * per-keystroke display should use `tryEvaluate` instead and fall back to the last good value.
 */
export function evaluateExpression(expression: string): Scaled {
  const tokens = tokenize(expression);
  if (tokens.length === 0) throw new CalculatorError('Empty expression');

  let pos = 0;
  const peek = () => tokens[pos];
  const consume = () => tokens[pos++];

  function parseExpr(): Scaled {
    let value = parseTerm();
    let next = peek();
    while (next !== undefined && next.type === 'operator' && (next.value === '+' || next.value === '-')) {
      const op = consume() as Token & { type: 'operator' };
      const rhs = parseTerm();
      value = assertInRange(op.value === '+' ? value + rhs : value - rhs);
      next = peek();
    }
    return value;
  }

  function parseTerm(): Scaled {
    let value = parsePower();
    let next = peek();
    while (next !== undefined && next.type === 'operator' && (next.value === '*' || next.value === '/')) {
      const op = consume() as Token & { type: 'operator' };
      const rhs = parsePower();
      value = assertInRange(op.value === '*' ? mul(value, rhs) : div(value, rhs));
      next = peek();
    }
    return value;
  }

  function parsePower(): Scaled {
    const base = parseUnary();
    const next = peek();
    if (next !== undefined && next.type === 'operator' && next.value === '^') {
      consume();
      const exponent = parsePower();
      return assertInRange(power(base, exponent));
    }
    return base;
  }

  function parseUnary(): Scaled {
    const next = peek();
    if (next !== undefined && next.type === 'operator' && next.value === '-') {
      consume();
      return assertInRange(-parseUnary());
    }
    return parsePrimary();
  }

  function parsePrimary(): Scaled {
    const token = peek();
    if (token === undefined) throw new CalculatorError('Unexpected end of expression');
    if (token.type === 'number') {
      consume();
      return parseLiteral(token.value);
    }
    if (token.type === 'lparen') {
      consume();
      const value = parseExpr();
      const close = peek();
      if (close === undefined || close.type !== 'rparen') {
        throw new CalculatorError('Missing closing parenthesis');
      }
      consume();
      return value;
    }
    throw new CalculatorError('Unexpected operator');
  }

  const result = parseExpr();
  if (pos !== tokens.length) throw new CalculatorError('Unexpected trailing input');
  return assertInRange(result);
}

/** `evaluateExpression`, but returns `null` instead of throwing — for live, per-keystroke display. */
export function tryEvaluate(expression: string): Scaled | null {
  try {
    return evaluateExpression(expression);
  } catch {
    return null;
  }
}
