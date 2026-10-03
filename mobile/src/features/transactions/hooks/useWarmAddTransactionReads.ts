import { useEffect } from 'react';
import { AccountStatus, CategoryStatus, TransactionType } from '@sora/contracts';

import { accountsApiSlice, categoriesApiSlice } from '@/app/store';
import { categoryTypeFor } from '@/utils';

const SHEET_TYPES = [TransactionType.EXPENSE, TransactionType.INCOME, TransactionType.TRANSFER] as const;

/**
 * Reads the add sheet's accounts and categories while the list is on screen, with the sheet's own
 * arguments, so their saved copies exist if the network drops before the sheet is first opened.
 */
export function useWarmAddTransactionReads(walletId: string | undefined, skip: boolean): void {
  const prefetchAccounts = accountsApiSlice.usePrefetch('listAccounts');
  const prefetchCategories = categoriesApiSlice.usePrefetch('listCategories');

  useEffect(() => {
    if (skip || walletId === undefined) return;
    prefetchAccounts({ walletId, status: AccountStatus.ACTIVE });
    for (const type of SHEET_TYPES) {
      prefetchCategories({ walletId, type: categoryTypeFor(type), status: CategoryStatus.ACTIVE });
    }
  }, [walletId, skip, prefetchAccounts, prefetchCategories]);
}
