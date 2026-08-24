/**
 * Exact decimal money.
 *
 * Amounts cross the wire as strings and are computed on as scaled bigints, never
 * as JS numbers. `DECIMAL(19,4)` reaches 999999999999999.9999, which is well past
 * the 2^53 boundary where a float64 silently stops being able to represent
 * integers, and even inside that range 0.1 + 0.2 is not 0.3 — either failure mode
 * produces a balance that is wrong by a rounding error nobody can trace back.
 */

/** Decimal places carried by every monetary column in the schema. */
export const MONEY_SCALE = 4;

const SCALE_FACTOR = 10n ** BigInt(MONEY_SCALE);

/** Largest magnitude DECIMAL(19,4) can hold, as scaled minor units. */
const MAX_SCALED = 10n ** 19n - 1n;

/** A decimal amount in string form, e.g. "150000.00" or "-2000000". */
export type MoneyString = string;

/** A money amount in minor units scaled by 10^MONEY_SCALE. */
export type Scaled = bigint;

const MONEY_PATTERN = /^-?\d{1,15}(\.\d{1,4})?$/;

export class MoneyError extends Error {}

/**
 * Parse a decimal string into scaled minor units.
 *
 * Rejects rather than rounds when more than MONEY_SCALE decimals are supplied:
 * silently dropping a digit off an amount a user typed is a data-loss bug that
 * only shows up as a balance that does not reconcile.
 */
export function parseMoney(input: MoneyString | number): Scaled {
  const raw = typeof input === 'number' ? numberToDecimalString(input) : input;
  const text = raw.trim();

  if (!MONEY_PATTERN.test(text)) {
    throw new MoneyError(
      `Not a valid amount: ${JSON.stringify(raw)} (expected up to 15 integer digits and ${MONEY_SCALE} decimals)`,
    );
  }

  const negative = text.startsWith('-');
  const unsigned = negative ? text.slice(1) : text;
  const dot = unsigned.indexOf('.');
  const whole = dot === -1 ? unsigned : unsigned.slice(0, dot);
  const fraction = dot === -1 ? '' : unsigned.slice(dot + 1);
  const padded = fraction.padEnd(MONEY_SCALE, '0');
  const scaled = BigInt(whole) * SCALE_FACTOR + BigInt(padded);

  if (scaled > MAX_SCALED) {
    throw new MoneyError(`Amount out of range for DECIMAL(19,${MONEY_SCALE}): ${raw}`);
  }

  return negative ? -scaled : scaled;
}

function numberToDecimalString(value: number): string {
  if (!Number.isFinite(value)) {
    throw new MoneyError(`Not a valid amount: ${value}`);
  }
  // toFixed is safe here only because the caller is a UI field, not a stored
  // balance; anything already exact should arrive as a string.
  return value.toFixed(MONEY_SCALE);
}

/** Render scaled minor units back to a fixed-scale decimal string. */
export function formatMoney(value: Scaled): MoneyString {
  const negative = value < 0n;
  const magnitude = negative ? -value : value;
  const whole = magnitude / SCALE_FACTOR;
  const fraction = (magnitude % SCALE_FACTOR).toString().padStart(MONEY_SCALE, '0');
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

/** Render for display, dropping trailing zeros beyond `minDecimals`. */
export function formatMoneyCompact(value: Scaled, minDecimals = 0): MoneyString {
  const fixed = formatMoney(value);
  const dot = fixed.indexOf('.');
  const whole = fixed.slice(0, dot);
  const trimmed = fixed.slice(dot + 1).replace(/0+$/, '');
  const kept = trimmed.padEnd(minDecimals, '0');
  return kept.length > 0 ? `${whole}.${kept}` : whole;
}

export const ZERO: Scaled = 0n;

export function add(...values: Scaled[]): Scaled {
  return values.reduce((total, value) => total + value, 0n);
}

export function subtract(from: Scaled, ...values: Scaled[]): Scaled {
  return values.reduce((total, value) => total - value, from);
}

export function negate(value: Scaled): Scaled {
  return -value;
}

export function isPositive(value: Scaled): boolean {
  return value > 0n;
}

export function isNegative(value: Scaled): boolean {
  return value < 0n;
}

export function isZero(value: Scaled): boolean {
  return value === 0n;
}

export function maxOf(a: Scaled, b: Scaled): Scaled {
  return a > b ? a : b;
}

export function minOf(a: Scaled, b: Scaled): Scaled {
  return a < b ? a : b;
}

/**
 * `part` as a percentage of `whole`, rounded half-up to `decimals` places and
 * returned as a JS number because a percentage is a display value, not money.
 *
 * Returns 0 when `whole` is zero: a budget or goal of zero has no meaningful
 * usage figure, and the alternative is NaN leaking into a progress bar.
 */
export function percentageOf(part: Scaled, whole: Scaled, decimals = 1): number {
  if (whole === 0n) return 0;

  const factor = 10n ** BigInt(decimals);
  const scaled = (part * 100n * factor * 2n) / whole;
  const rounded = (scaled + (scaled < 0n ? -1n : 1n)) / 2n;
  return Number(rounded) / Number(factor);
}

/** Clamp a percentage into 0..cap, for progress bars that must not overflow. */
export function clampPercentage(value: number, cap = 100): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(Math.max(value, 0), cap);
}
