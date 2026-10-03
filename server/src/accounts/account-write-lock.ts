import { AccountStatus, WalletStatus } from '@sora/contracts';
import type { Transaction } from 'kysely';

import { AppError } from '../common/app-error.ts';
import type { DB } from '../database/types.ts';

/**
 * For a write that names accounts: share-locks them and their wallets until the caller's
 * transaction ends, then re-checks what the pre-checks read without a lock. An archive or a
 * currency change (an UPDATE, or `FOR UPDATE`) either waits for this write to commit, or commits
 * first and fails it here. Share locks never conflict with each other, so writers don't queue.
 */
export async function lockAccountsForWrite(
  trx: Transaction<DB>,
  accountIds: readonly string[],
  currency: string,
  { allowArchived = false }: { allowArchived?: boolean } = {},
): Promise<void> {
  const rows = await trx
    .selectFrom('accounts')
    .innerJoin('wallets', 'wallets.id', 'accounts.wallet_id')
    .select(['accounts.status as account_status', 'accounts.currency as currency', 'wallets.status as wallet_status'])
    .where('accounts.id', 'in', [...new Set(accountIds)])
    .orderBy('accounts.id')
    .forShare()
    .execute();

  if (!allowArchived) {
    if (rows.some((row) => row.wallet_status === WalletStatus.ARCHIVED)) throw new AppError('WALLET_ARCHIVED');
    if (rows.some((row) => row.account_status === AccountStatus.ARCHIVED)) throw new AppError('ACCOUNT_ARCHIVED');
  }
  if (rows.some((row) => row.currency !== currency)) throw new AppError('ACCOUNT_CURRENCY_MISMATCH');
}

/** For a currency change: the exclusive side of {@link lockAccountsForWrite}. Returns the currency as committed. */
export async function lockAccountForCurrencyChange(trx: Transaction<DB>, accountId: string): Promise<string> {
  const row = await trx.selectFrom('accounts').select('currency').where('id', '=', accountId).forUpdate().executeTakeFirst();
  if (!row) throw new AppError('ACCOUNT_NOT_FOUND');
  return row.currency;
}

/**
 * For an archive: locks every active account of the wallet, in id order, and refuses when
 * `accountId` is the last one. Two archives in one wallet then queue, and the second sees the
 * first one's result instead of each counting the other as still active.
 * Returns false when `accountId` is already archived, so the caller can skip the write.
 */
export async function lockForArchive(trx: Transaction<DB>, walletId: string, accountId: string): Promise<boolean> {
  const active = await trx
    .selectFrom('accounts')
    .select('id')
    .where('wallet_id', '=', walletId)
    .where('status', '=', AccountStatus.ACTIVE)
    .orderBy('id')
    .forUpdate()
    .execute();

  if (!active.some((row) => row.id === accountId)) return false;
  if (active.length === 1) throw new AppError('ACCOUNT_LAST_ACTIVE');
  return true;
}
