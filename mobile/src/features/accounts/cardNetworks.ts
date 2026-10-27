import type { AccountResponse, CardNetwork } from '@sora/contracts';

/** Brand names are proper nouns and read the same in every language; only OTHER is translated (`accounts.networkOther`). */
export const CARD_NETWORK_NAME: Record<Exclude<CardNetwork, 'OTHER'>, string> = {
  VISA: 'Visa',
  MASTERCARD: 'Mastercard',
  JCB: 'JCB',
  AMEX: 'American Express',
  NAPAS: 'NAPAS',
  UNIONPAY: 'UnionPay',
};

/** Masked as on a statement: the four digits the owner knows the card by, and nothing implying more. */
export function maskedCardDigits(last4: string): string {
  return `•••• ${last4}`;
}

/**
 * An account's card details with every absent one as null. A server or saved copy from before the fields existed
 * leaves them out entirely, and an undefined must neither print nor read as a change.
 */
export function cardDetailsOf(account: AccountResponse): Pick<AccountResponse, 'institutionName' | 'cardNetwork' | 'cardLast4'> {
  return {
    institutionName: account.institutionName ?? null,
    cardNetwork: account.cardNetwork ?? null,
    cardLast4: account.cardLast4 ?? null,
  };
}
