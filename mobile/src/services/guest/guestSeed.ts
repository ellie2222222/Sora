/**
 * Seeds a fresh guest wallet the first time guest mode is entered.
 *
 * Mirrors `auth.service.ts`'s `seedWallet` field-for-field — one wallet, the
 * shared `STARTER_CATEGORIES`, one default CASH account — so a guest's
 * starting state is identical to what registration produces. `STARTER_CATEGORIES`
 * lives in `@sora/contracts` for exactly this reason: a mobile-side copy that
 * drifts from the server's list would mean a guest's starter set silently
 * differs from what a registered user gets.
 */

import { STARTER_CATEGORIES, AccountStatus, AccountType, type StarterCategory } from '@sora/contracts';

import { newGuestCategory } from './guestCategories.ts';
import { newLocalId } from './guestIds.ts';
import { guestStore } from './guestStorage.ts';
import { type GuestCategory, type GuestData } from './guestStore.ts';

/** VND matches `registerSchema`'s own default `baseCurrency` — there is no
 * registration step in guest mode to have supplied one. */
const DEFAULT_GUEST_CURRENCY = 'VND';

/** Bump alongside a server starter-category backfill migration, so existing guest wallets get the same top-up. */
export const STARTER_CATEGORIES_VERSION = 1;

export async function ensureSeeded(): Promise<GuestData> {
  await guestStore.hydrate();
  if (guestStore.hasData()) return backfillStarterCategories();

  return guestStore.mutate((data) => {
    if (data.wallet !== null) return data;

    const now = new Date().toISOString();
    const walletId = newLocalId();

    return {
      ...data,
      wallet: { id: walletId, name: 'Guest Wallet', createdAt: now, updatedAt: now },
      categories: STARTER_CATEGORIES.map((category) => fromStarter(category, walletId, now)),
      starterCategoriesVersion: STARTER_CATEGORIES_VERSION,
      accounts: [
        {
          id: newLocalId(),
          walletId,
          name: 'Cash',
          type: AccountType.CASH,
          currency: DEFAULT_GUEST_CURRENCY,
          initialBalance: '0.0000',
          status: AccountStatus.ACTIVE,
          createdAt: now,
          updatedAt: now,
        },
      ],
    };
  });
}

/** Once per version, so a starter the guest deletes afterwards stays deleted; skips names already in use. */
async function backfillStarterCategories(): Promise<GuestData> {
  const data = guestStore.current();
  const wallet = data.wallet;
  if (wallet === null || data.starterCategoriesVersion >= STARTER_CATEGORIES_VERSION) return data;

  const now = new Date().toISOString();
  const takenRootNames = new Set(
    data.categories.filter((category) => category.parentId === null).map((category) => category.name.toLowerCase()),
  );
  // "Other Expense" replaced the old starter "Other"; a wallet that has "Other" already has its catch-all.
  const hasLegacyOther = takenRootNames.has('other');
  const added = STARTER_CATEGORIES.filter(
    (category) =>
      !takenRootNames.has(category.name.toLowerCase()) && !(hasLegacyOther && category.name === 'Other Expense'),
  ).map((category) => fromStarter(category, wallet.id, now));

  return guestStore.mutate((current) => ({
    ...current,
    categories: [...current.categories, ...added],
    starterCategoriesVersion: STARTER_CATEGORIES_VERSION,
  }));
}

function fromStarter(category: StarterCategory, walletId: string, now: string): GuestCategory {
  const { name, type, icon, color } = category;
  return newGuestCategory({ walletId, parentId: null, name, type, icon, color }, now);
}
