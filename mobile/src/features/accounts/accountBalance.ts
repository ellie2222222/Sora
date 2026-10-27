import { AccountType, formatMoney, isNegative, negate, parseMoney, type AccountResponse, type MoneyString } from '@sora/contracts';

// A direct path, not `@/utils`: node --test runs this file and has no alias.
import { absScaled, tryParseMoney } from '../../utils/money.ts';

/**
 * A credit card account is the debt owed to the issuer, stored as a negative balance (VL-04). The form asks for
 * what is owed as a plain amount, since a forgotten minus would book the debt as money owned.
 */
export function openingBalanceFor(type: AccountType, entered: MoneyString): MoneyString {
  if (type !== AccountType.CREDIT_CARD) return entered;
  const owed = tryParseMoney(entered);
  // Not an amount: passed on as typed, so the form's validation names the problem.
  return owed === null ? entered : formatMoney(negate(owed));
}

/** A credit card in debt shows what is owed, unsigned and labelled; every other balance shows as it stands. */
export function cardBalanceOf(account: Pick<AccountResponse, 'type' | 'balance'>): { amount: MoneyString; owed: boolean } {
  const balance = parseMoney(account.balance);
  if (account.type === AccountType.CREDIT_CARD && isNegative(balance)) return { amount: formatMoney(absScaled(balance)), owed: true };
  return { amount: account.balance, owed: false };
}
