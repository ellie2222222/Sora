import type { Transaction } from 'kysely';

import { AppError } from '../common/app-error.ts';
import type { DB } from '../database/types.ts';

/**
 * For a write that names accounts: share-locks them until the caller's transaction ends and
 * re-checks their currency, so a concurrent currency change (which takes `FOR UPDATE`) either
 * waits for this row to commit and sees it, or commits first and fails this check.
 */
export async function lockAccountsInCurrency(
  trx: Transaction<DB>,
  accountIds: readonly string[],
  currency: string,
): Promise<void> {
  const rows = await trx
    .selectFrom('accounts')
    .select('currency')
    .where('id', 'in', [...new Set(accountIds)])
    .orderBy('id')
    .forShare()
    .execute();
  if (rows.some((row) => row.currency !== currency)) throw new AppError('ACCOUNT_CURRENCY_MISMATCH');
}

/** For the currency change itself: the exclusive side of {@link lockAccountsInCurrency}. */
export async function lockAccountForCurrencyChange(trx: Transaction<DB>, accountId: string): Promise<void> {
  await trx.selectFrom('accounts').select('id').where('id', '=', accountId).forUpdate().executeTakeFirst();
}
