import { Locale } from '../../i18n.config'

const LOCALE_TAGS: Record<Locale, string> = {
  en: 'en-US',
  vi: 'vi-VN',
}

/**
 * Formats a money amount in the given currency.
 * VND has no minor unit, so it is shown without decimals; USD keeps 2 (VL-04).
 */
export function formatCurrency(
  amount: number,
  currency: string,
  locale: Locale = 'en'
): string {
  const fractionDigits = currency === 'VND' ? 0 : 2
  try {
    return new Intl.NumberFormat(LOCALE_TAGS[locale], {
      style: 'currency',
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(amount)
  } catch {
    // Unknown/invalid ISO currency code — fall back to a plain number plus the raw code.
    return `${amount.toFixed(fractionDigits)} ${currency}`
  }
}

/**
 * Formats an exchange rate.
 *
 * Rates span orders of magnitude — 1 USD is ~26,183.58 VND, 1 VND is
 * ~0.0000382 USD — so a fixed decimal count fails at one end or the other.
 * `toLocaleString()` alone is worse than useless here: it stops at 3 decimals
 * and renders the VND->USD rate as "0". Significant digits read correctly at
 * both scales.
 */
export function formatRate(rate: number, locale: Locale = 'en'): string {
  return new Intl.NumberFormat(LOCALE_TAGS[locale], {
    maximumSignificantDigits: rate >= 1 ? 8 : 4,
  }).format(rate)
}

export function formatDate(value: string | Date, locale: Locale = 'en'): string {
  const date = typeof value === 'string' ? new Date(value) : value
  return new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}
