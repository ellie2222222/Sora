import { TransactionType, type CategoryType } from '@sora/contracts';

import { AppError } from '../common/app-error.ts';

export interface CategoryFacts {
  type: CategoryType;
  wallet_id: string;
  /** Whether the caller is a member of the category's own wallet. */
  visibleToCaller: boolean;
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
  // AC-01: a category in a wallet the caller can't see is answered exactly like a missing one,
  // and before its type is judged, or a 403 or 422 would confirm the id is real.
  if (!category || !category.visibleToCaller) throw new AppError('CATEGORY_NOT_FOUND');
  if (category.wallet_id !== walletId) throw new AppError('CATEGORY_WRONG_WALLET');
  if (category.type !== transactionType) throw new AppError('CATEGORY_WRONG_TYPE');
}

/** Only a transfer may be left uncategorised; income and expense always carry one (`chk_transaction_shape`). */
export function assertCategoryRemovable(transactionType: TransactionType): void {
  if (transactionType !== TransactionType.TRANSFER) {
    throw new AppError('CATEGORY_WRONG_TYPE', 'Only a transfer can have no category');
  }
}
