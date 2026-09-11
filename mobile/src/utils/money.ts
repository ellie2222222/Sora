/**
 * Money for the screen.
 *
 * Everything arithmetic lives in `@sora/contracts` and operates on scaled
 * bigints; this module only turns one of those into characters. The float that
 * `Intl.NumberFormat` needs is produced at the very last step, from a value
 * already rounded to the digits the currency actually prints, so the discarded
 * precision can never reach the formatter and come back as a wrong figure.
 */

import {
  MONEY_SCALE,
  add,
  formatMoneyCompact,
  parseMoney,
  ZERO,
  type MoneyString,
  type Scaled,
  type TransactionType,
} from '@sora/contracts';

/**
 * Currencies whose smallest unit is the unit itself. VND is the app's primary
 * case, and printing "₫150,000.00" for it is simply wrong, not merely verbose.
 */
const ZERO_DECIMAL_CURRENCIES = new Set(['VND', 'JPY', 'KRW', 'CLP', 'ISK', 'XAF', 'XOF']);

export const DEFAULT_CURRENCY_DECIMALS = 2;

export function currencyDecimals(currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 0 : DEFAULT_CURRENCY_DECIMALS;
}

export function absScaled(value: Scaled): Scaled {
  return value < 0n ? -value : value;
}

/**
 * Scaled minor units to the number a formatter can take, rounded half-up to
 * `decimals` places first.
 *
 * Half-up rather than bankers' rounding because a displayed total that differs
 * from the sum a user computes by hand reads as a bug, whichever way it leans.
 */
export function scaledToDisplayNumber(value: Scaled, decimals: number): number {
  const keep = Math.max(0, Math.min(decimals, MONEY_SCALE));
  const divisor = 10n ** BigInt(MONEY_SCALE - keep);
  const negative = value < 0n;
  const magnitude = negative ? -value : value;
  const quotient = magnitude / divisor;
  const remainder = magnitude % divisor;
  const rounded = remainder * 2n >= divisor ? quotient + 1n : quotient;
  const signed = negative ? -rounded : rounded;
  return Number(signed) / 10 ** keep;
}

export interface MoneyFormatOptions {
  locale?: string;
  /** Abbreviate large figures ("₫12M"), for cards where the exact digit count does not fit. */
  compact?: boolean;
  /** `always` prefixes a + on positives — the transaction list wants it, a balance does not. */
  signDisplay?: 'auto' | 'always' | 'never';
  /** Drop the currency symbol, for a field the user is typing into. */
  hideCurrency?: boolean;
}

const DEFAULT_LOCALE = 'en-US';

function groupDigits(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Used when `Intl` is missing or refuses a currency code. Hermes ships a
 * platform-backed `Intl` whose coverage varies by OS version, so a fallback that
 * still prints a correct number is the difference between a readable screen and
 * a crash inside a list row.
 */
function fallbackFormat(
  value: Scaled,
  currency: string,
  decimals: number,
  options: MoneyFormatOptions,
): string {
  const negative = value < 0n;
  const text = formatMoneyCompact(absScaled(value), decimals);
  const [whole = '0', fraction] = text.split('.');
  const body = fraction === undefined ? groupDigits(whole) : `${groupDigits(whole)}.${fraction}`;
  const sign = negative ? '-' : options.signDisplay === 'always' && value > 0n ? '+' : '';
  return options.hideCurrency ? `${sign}${body}` : `${sign}${body} ${currency.toUpperCase()}`;
}

export function formatScaled(
  value: Scaled,
  currency: string,
  options: MoneyFormatOptions = {},
): string {
  const decimals = currencyDecimals(currency);
  const shown = options.signDisplay === 'never' ? absScaled(value) : value;

  try {
    return new Intl.NumberFormat(options.locale ?? DEFAULT_LOCALE, {
      style: options.hideCurrency ? 'decimal' : 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      notation: options.compact ? 'compact' : 'standard',
      minimumFractionDigits: options.compact ? 0 : decimals,
      maximumFractionDigits: decimals,
      signDisplay: options.signDisplay === 'always' ? 'exceptZero' : 'auto',
    }).format(scaledToDisplayNumber(shown, decimals));
  } catch {
    return fallbackFormat(shown, currency, decimals, options);
  }
}

export function formatMoneyString(
  amount: MoneyString,
  currency: string,
  options: MoneyFormatOptions = {},
): string {
  return formatScaled(parseMoney(amount), currency, options);
}

/** `null` when the text is not a usable amount, so a field can show it as it is typed. */
export function tryParseMoney(input: string): Scaled | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;
  try {
    return parseMoney(trimmed);
  } catch {
    return null;
  }
}

/**
 * Which direction the figure points, for colour and sign.
 *
 * A TRANSFER is deliberately neither: it is the one classification the product
 * cannot get wrong, because folding it into either side makes every other total
 * on the dashboard untrustworthy.
 */
/**
 * Sums `amountOf(item)` per `keyOf(item)` (currency, almost always), in
 * bigint space — the one grouping loop every per-currency total in the app
 * shares, rather than each screen hand-rolling its own Map-and-`add` (BR-07:
 * a currency is never summed against another).
 */
export function sumScaledByKey<T>(
  items: readonly T[],
  keyOf: (item: T) => string,
  amountOf: (item: T) => MoneyString,
): Map<string, Scaled> {
  const totals = new Map<string, Scaled>();
  for (const item of items) {
    const key = keyOf(item);
    totals.set(key, add(totals.get(key) ?? ZERO, parseMoney(amountOf(item))));
  }
  return totals;
}

export function directionOf(type: TransactionType): 'in' | 'out' | 'neutral' {
  if (type === 'INCOME') return 'in';
  if (type === 'EXPENSE') return 'out';
  return 'neutral';
}

export function signPrefixOf(type: TransactionType): string {
  const direction = directionOf(type);
  if (direction === 'in') return '+';
  if (direction === 'out') return '-';
  return '';
}
