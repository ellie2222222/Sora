/**
 * Demo data for guest mode: a whole `GuestData` blob, as `scripts/seed/seed-demo.mts --guest-fixture`
 * writes it, replacing the guest ledger. Only a development build offers it (Settings).
 */

import { guestStore } from './guestStorage.ts';
import type { GuestData } from './guestStore.ts';

const LISTS = ['accounts', 'categories', 'transactions', 'budgets', 'goals', 'contributions'] as const;

export function isGuestData(value: unknown): value is GuestData {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  const wallet = candidate.wallet as Record<string, unknown> | null | undefined;
  return (
    typeof wallet === 'object' &&
    wallet !== null &&
    typeof wallet.id === 'string' &&
    LISTS.every((list) => Array.isArray(candidate[list])) &&
    typeof candidate.starterCategoriesVersion === 'number'
  );
}

/** Upload progress belongs to the ledger it was made for, so a loaded fixture starts with none. */
export async function loadGuestFixture(value: unknown): Promise<GuestData> {
  if (!isGuestData(value)) throw new Error('Not a guest-mode data file');
  return guestStore.mutate(() => ({ ...value, uploadProgress: null }));
}
