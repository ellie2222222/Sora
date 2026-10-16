import { formatMoneyCompact, parseMoney, type CurrencyTotal, type Locale } from '@sora/contracts';

/** Chat text, not a form field, so an amount reads the way the reader's language writes numbers. */
export const NUMBER_FORMAT: Readonly<Record<Locale, { group: string; decimal: string }>> = {
  en: { group: ',', decimal: '.' },
  vi: { group: '.', decimal: ',' },
  de: { group: '.', decimal: ',' },
  es: { group: '.', decimal: ',' },
  fr: { group: ' ', decimal: ',' },
  hi: { group: ',', decimal: '.' },
  ja: { group: ',', decimal: '.' },
  ko: { group: ',', decimal: '.' },
  ru: { group: ' ', decimal: ',' },
  zh: { group: ',', decimal: '.' },
};

export function displayAmount(amount: string, currency: string, locale: Locale): string {
  const compact = formatMoneyCompact(parseMoney(amount));
  const negative = compact.startsWith('-');
  const [whole, fraction] = (negative ? compact.slice(1) : compact).split('.');
  const { group, decimal } = NUMBER_FORMAT[locale];
  const grouped = whole!.replace(/\B(?=(\d{3})+(?!\d))/g, group);
  return `${negative ? '-' : ''}${grouped}${fraction ? decimal + fraction : ''} ${currency}`;
}

export function joinTotals(totals: CurrencyTotal[], locale: Locale): string {
  return totals.map((total) => displayAmount(total.amount, total.currency, locale)).join(' + ');
}
