/**
 * Money for the screen.
 *
 * Everything arithmetic lives in `@sora/contracts` and operates on scaled
 * bigints; this module only turns one of those into characters. The formatter is
 * handed an exact decimal string already rounded to the digits the currency
 * prints, never a float, so no total can come back as a wrong figure.
 */

import {
  MONEY_SCALE,
  add,
  formatMoney,
  formatMoneyCompact,
  parseMoney,
  ZERO,
  TransactionStatus,
  TransactionType,
  type CurrencyTotal,
  type MoneyString,
  type Scaled,
  type TransactionResponse,
} from '@sora/contracts';

/**
 * Currencies whose smallest unit is the unit itself. VND is the app's primary
 * case, and printing "₫150,000.00" for it is simply wrong, not merely verbose.
 */
const ZERO_DECIMAL_CURRENCIES = new Set(['VND', 'JPY', 'KRW', 'CLP', 'ISK', 'XAF', 'XOF']);

const DEFAULT_CURRENCY_DECIMALS = 2;

export function currencyDecimals(currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 0 : DEFAULT_CURRENCY_DECIMALS;
}

export function absScaled(value: Scaled): Scaled {
  return value < 0n ? -value : value;
}

/** Half-up to `decimals` places, still at full scale: a total that differs from a hand sum reads as a bug. */
function roundToDecimals(value: Scaled, decimals: number): Scaled {
  const divisor = 10n ** BigInt(MONEY_SCALE - decimals);
  const magnitude = absScaled(value);
  const quotient = magnitude / divisor;
  const rounded = (magnitude % divisor) * 2n >= divisor ? quotient + 1n : quotient;
  return (value < 0n ? -rounded : rounded) * divisor;
}

function clampDecimals(decimals: number): number {
  return Math.max(0, Math.min(decimals, MONEY_SCALE));
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

/** Fraction digits of the abbreviated figure: ₫11.42M, not ₫11M, even for a zero-decimal currency. */
const COMPACT_FRACTION_DIGITS = 2;

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
  const rounded = roundToDecimals(value, decimals);
  const negative = rounded < 0n;
  const text = formatMoneyCompact(absScaled(rounded), decimals);
  const [whole = '0', fraction] = text.split('.');
  const body = fraction === undefined ? groupDigits(whole) : `${groupDigits(whole)}.${fraction}`;
  const sign = negative ? '-' : options.signDisplay === 'always' && rounded > 0n ? '+' : '';
  return options.hideCurrency ? `${sign}${body}` : `${sign}${body} ${currency.toUpperCase()}`;
}

export function formatScaled(
  value: Scaled,
  currency: string,
  options: MoneyFormatOptions = {},
): string {
  const decimals = clampDecimals(currencyDecimals(currency));
  const shown = options.signDisplay === 'never' ? absScaled(value) : value;
  const exact = formatMoneyCompact(roundToDecimals(shown, decimals), decimals);

  try {
    // A numeric string formats exactly (ES2023; this TS lib lacks the overload). An engine without it
    // coerces the string to a number, losing cents only past 2^53 minor units.
    return new Intl.NumberFormat(options.locale ?? DEFAULT_LOCALE, {
      style: options.hideCurrency ? 'decimal' : 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      notation: options.compact ? 'compact' : 'standard',
      minimumFractionDigits: options.compact ? 0 : decimals,
      maximumFractionDigits: options.compact ? Math.max(decimals, COMPACT_FRACTION_DIGITS) : decimals,
      signDisplay: options.signDisplay === 'always' ? 'exceptZero' : 'auto',
    }).format(exact as unknown as number);
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

/**
 * Per-currency total of one transaction type across `transactions`, formatted for
 * display. Shared by every "totals" summary row (a day's heading, a month's header)
 * so none hand-rolls its own filter+sum. Each type is summed on its own, so a
 * transfer never lands in income or expense (BR-06); only COMPLETED rows count.
 */
export function sumByTransactionType(
  transactions: readonly TransactionResponse[],
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER',
): CurrencyTotal[] {
  const byCurrency = sumScaledByKey(
    transactions.filter((transaction) => transaction.type === type && transaction.status === TransactionStatus.COMPLETED),
    (transaction) => transaction.currency,
    (transaction) => transaction.amount,
  );
  return Array.from(byCurrency, ([currency, amount]) => ({ currency, amount: formatMoney(amount) }));
}

export interface NetCurrencyTotal extends CurrencyTotal {
  type: TransactionType;
}

/**
 * Net total (INCOME - EXPENSE) per currency across `transactions`.
 * Used for showing a single daily/group net figure instead of separate + and - numbers.
 */
export function netSumByCurrency(transactions: readonly TransactionResponse[]): NetCurrencyTotal[] {
  const totals = new Map<string, Scaled>();
  for (const t of transactions) {
    if (t.status !== TransactionStatus.COMPLETED) continue;
    if (t.type === TransactionType.TRANSFER) continue;
    
    const amount = parseMoney(t.amount);
    const current = totals.get(t.currency) ?? ZERO;
    totals.set(t.currency, t.type === TransactionType.INCOME ? current + amount : current - amount);
  }
  return Array.from(totals, ([currency, netAmount]) => {
    const type = netAmount < ZERO ? TransactionType.EXPENSE : TransactionType.INCOME;
    const absAmount = absScaled(netAmount);
    return { currency, amount: formatMoney(absAmount), type };
  });
}

/**
 * Which direction the figure points, for colour and sign.
 *
 * A TRANSFER is deliberately neither: it is the one classification the product
 * cannot get wrong, because folding it into either side makes every other total
 * on the dashboard untrustworthy.
 */
export function directionOf(type: TransactionType): 'in' | 'out' | 'neutral' {
  if (type === TransactionType.INCOME) return 'in';
  if (type === TransactionType.EXPENSE) return 'out';
  return 'neutral';
}
