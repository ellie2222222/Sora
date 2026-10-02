/**
 * Shared setup for the guest-layer tests.
 *
 * Not a `.test.ts` file so `node --test`'s glob does not try to run it. The
 * guest APIs are wired to the one `guestStore` singleton, so a test drives
 * them by swapping in memory persistence first (`setPersistence`) — see its
 * note in guestStore.ts.
 */

import { AccountStatus, AccountType, CategoryStatus, CategoryType } from '@sora/contracts';

import { isApiError } from '../../utils/errors.ts';
import { guestStore } from './guestStorage.ts';
import type { GuestPersistence } from './guestStore.ts';

export function memoryPersistence(initial: string | null = null): GuestPersistence & {
  saves: number;
  raw: () => string | null;
} {
  let raw = initial;
  let saves = 0;

  return {
    get saves() {
      return saves;
    },
    raw: () => raw,
    async load() {
      return raw;
    },
    async save(next) {
      raw = next;
      saves += 1;
    },
    async clear() {
      raw = null;
    },
  };
}

/** A clean, hydrated singleton backed by memory. Call at the top of each test. */
/** The error code a guest call rejects with; fails the test if it resolves. */
export async function codeOf(work: () => Promise<unknown>): Promise<string> {
  try {
    await work();
  } catch (error) {
    if (isApiError(error)) return error.code;
    throw error;
  }
  throw new Error('expected a rejection, got none');
}

export async function withFreshStore(initial: string | null = null): Promise<void> {
  guestStore.setPersistence(memoryPersistence(initial));
  await guestStore.hydrate();
}

/**
 * Real UUIDs, because they have to be: the shared `createTransactionSchema`
 * validates every account/category id with `uuidSchema`, and guest ids come
 * from `newLocalId()`, which mints UUIDs. A readable placeholder id here
 * would pass through the store fine and then be rejected by the schema —
 * i.e. it would test a shape production never has.
 */
export const WALLET_ID = '3f1a7c62-0000-4000-8000-000000000001';
export const ACCOUNT_ID = '3f1a7c62-0000-4000-8000-000000000002';
export const OTHER_ACCOUNT_ID = '3f1a7c62-0000-4000-8000-000000000003';
export const EXPENSE_CATEGORY_ID = '3f1a7c62-0000-4000-8000-000000000004';
export const INCOME_CATEGORY_ID = '3f1a7c62-0000-4000-8000-000000000005';

const NOW = '2026-09-01T00:00:00.000Z';

/**
 * One wallet, two VND accounts and one category of each type — the smallest
 * shape every entity test needs. Written straight into the store rather than
 * through `ensureSeeded`, so a test's numbers do not shift when the starter
 * category list changes.
 */
export async function seedFixture(): Promise<void> {
  await guestStore.mutate(() => ({
    wallet: { id: WALLET_ID, name: 'Guest Wallet', createdAt: NOW, updatedAt: NOW },
    accounts: [
      {
        id: ACCOUNT_ID,
        walletId: WALLET_ID,
        name: 'Cash',
        type: AccountType.CASH,
        currency: 'VND',
        initialBalance: '1000000.0000',
        status: AccountStatus.ACTIVE,
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        id: OTHER_ACCOUNT_ID,
        walletId: WALLET_ID,
        name: 'Bank',
        type: AccountType.BANK_ACCOUNT,
        currency: 'VND',
        initialBalance: '0.0000',
        status: AccountStatus.ACTIVE,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
    categories: [
      {
        id: EXPENSE_CATEGORY_ID,
        walletId: WALLET_ID,
        parentId: null,
        name: 'Food',
        type: CategoryType.EXPENSE,
        icon: null,
        color: null,
        status: CategoryStatus.ACTIVE,
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        id: INCOME_CATEGORY_ID,
        walletId: WALLET_ID,
        parentId: null,
        name: 'Salary',
        type: CategoryType.INCOME,
        icon: null,
        color: null,
        status: CategoryStatus.ACTIVE,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
    transactions: [],
    budgets: [],
    goals: [],
    contributions: [],
    uploadProgress: null,
    starterCategoriesVersion: 0,
  }));
}
