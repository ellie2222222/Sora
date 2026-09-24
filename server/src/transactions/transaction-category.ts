import { TransactionType, type CategoryType } from '@sora/contracts';

import { AppError } from '../common/app-error.ts';

export interface CategoryFacts {
  type: CategoryType;
  wallet_id: string;
}

/**
 * Which account's wallet a transaction's category must come from. A transfer takes the paying
 * side's, so a cross-wallet transfer is labelled in the payer's own category tree.
 */
export function categorisedAccountId(
  type: TransactionType,
  fromAccountId: string | null,
  toAccountId: string | null,
): string {
  const accountId = type === TransactionType.INCOME ? toAccountId : fromAccountId;
  if (accountId === null) throw new Error(`A ${type} transaction is missing the account its category belongs to`);
  return accountId;
}

/** The one category rule create and update both apply (API spec §11 shape table). */
export function assertCategoryFits(
  category: CategoryFacts | undefined,
  transactionType: TransactionType,
  walletId: string,
): void {
  if (!category) throw new AppError('CATEGORY_NOT_FOUND');
  if (category.type !== transactionType) throw new AppError('CATEGORY_WRONG_TYPE');
  if (category.wallet_id !== walletId) throw new AppError('CATEGORY_WRONG_WALLET');
}

/** Only a transfer may be left uncategorised; income and expense always carry one (BR-06). */
export function assertCategoryRemovable(transactionType: TransactionType): void {
  if (transactionType !== TransactionType.TRANSFER) {
    throw new AppError('CATEGORY_WRONG_TYPE', 'Only a transfer can have no category');
  }
}
