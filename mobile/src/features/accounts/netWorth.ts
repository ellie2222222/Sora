import { add, formatMoney, isNegative, negate, parseMoney, ZERO, type AccountResponse, type MoneyString } from '@sora/contracts';

// A direct path, not `@/utils`: node --test runs this file and has no alias.
import { sumScaledByKey } from '../../utils/money.ts';

export interface CurrencyFigure {
  currency: string;
  amount: MoneyString;
}

/** Per currency, never summed across (BR-07); a negative balance (VL-04's one signed amount) is a liability. */
export function netWorthByCurrency(accounts: readonly AccountResponse[]): {
  assets: CurrencyFigure[];
  liabilities: CurrencyFigure[];
  netWorth: CurrencyFigure[];
} {
  const isAsset = (account: AccountResponse) => !isNegative(parseMoney(account.balance));
  const assetsByCurrency = sumScaledByKey(accounts.filter(isAsset), (account) => account.currency, (account) => account.balance);
  const liabilitiesByCurrency = sumScaledByKey(
    accounts.filter((account) => !isAsset(account)),
    (account) => account.currency,
    (account) => account.balance,
  );

  const currencies = new Set([...assetsByCurrency.keys(), ...liabilitiesByCurrency.keys()]);

  const assets = Array.from(assetsByCurrency.entries()).map(([currency, amount]) => ({ currency, amount: formatMoney(amount) }));
  const liabilities = Array.from(liabilitiesByCurrency.entries()).map(([currency, amount]) => ({
    currency,
    amount: formatMoney(negate(amount)),
  }));
  const netWorth = Array.from(currencies).map((currency) => ({
    currency,
    amount: formatMoney(add(assetsByCurrency.get(currency) ?? ZERO, liabilitiesByCurrency.get(currency) ?? ZERO)),
  }));

  return { assets, liabilities, netWorth };
}

/** Sign, mark and digits of a formatted amount, rejoining to exactly `text`; an unknown shape comes back whole. */
export function splitMoneyText(text: string): { sign: string; prefix: string; digits: string; suffix: string } {
  const match = /^([+\-−]?)([^\d+\-−]*?)(\d[\d.,\s  ]*\d|\d)([^\d]*)$/u.exec(text);
  if (!match) return { sign: '', prefix: '', digits: text, suffix: '' };
  return { sign: match[1]!, prefix: match[2]!, digits: match[3]!, suffix: match[4]! };
}

/** The headline's size step for this many digits, so a long balance steps down instead of clipping. */
export function headlineSizeFor(digits: string): 'display' | 'xxl' | 'xl' {
  if (digits.length <= 11) return 'display';
  if (digits.length <= 15) return 'xxl';
  return 'xl';
}
