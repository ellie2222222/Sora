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

import { STARTER_CASH_ACCOUNT_NAME, STARTER_CATEGORIES, AccountStatus, AccountType, type StarterCategory } from '@sora/contracts';

// Relative, not `@/services/locale`: guest modules run under bare `node --test`, which has no path aliases.
import { activeLocale } from '../locale/activeLocale.ts';
import { deviceTimeZone } from '../../utils/date.ts';

import { newGuestCategory } from './guestCategories.ts';
import { newLocalId } from './guestIds.ts';
import { guestStore } from './guestStorage.ts';
import { type GuestCategory, type GuestData } from './guestStore.ts';

/** VND matches `registerSchema`'s own default `baseCurrency` — there is no
 * registration step in guest mode to have supplied one. */
const DEFAULT_GUEST_CURRENCY = 'VND';

/** A stored marker, not display text: screens show `wallets.yourWallet` in its place, so it follows the app's language. */
export const GUEST_WALLET_NAME = 'Guest Wallet';

/**
 * Bump alongside a server starter-category backfill migration, so existing guest wallets get the same top-up.
 * 1 added the missing starters; 2 gave existing starters their `systemKey`.
 */
export const STARTER_CATEGORIES_VERSION = 2;

export async function ensureSeeded(): Promise<GuestData> {
  await guestStore.hydrate();
  if (guestStore.hasData()) return backfillStarterCategories();

  return guestStore.mutate((data) => {
    if (data.wallet !== null) return data;

    const now = new Date().toISOString();
    const walletId = newLocalId();

    return {
      ...data,
      wallet: { id: walletId, name: GUEST_WALLET_NAME, timeZone: deviceTimeZone(), createdAt: now, updatedAt: now },
      categories: STARTER_CATEGORIES.map((category) => fromStarter(category, walletId, now)),
      starterCategoriesVersion: STARTER_CATEGORIES_VERSION,
      accounts: [
        {
          id: newLocalId(),
          walletId,
          // Named once, in the app's language at seeding, as registration names it in the sign-up language.
          name: STARTER_CASH_ACCOUNT_NAME[activeLocale()],
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
  const added = data.starterCategoriesVersion >= 1 ? [] : STARTER_CATEGORIES.filter(
    (category) =>
      !takenRootNames.has(category.names.en.toLowerCase()) && !(hasLegacyOther && category.names.en === 'Other Expense'),
  ).map((category) => fromStarter(category, wallet.id, now));

  return guestStore.mutate((current) => ({
    ...current,
    categories: [...current.categories.map(withStarterKey), ...added],
    starterCategoriesVersion: STARTER_CATEGORIES_VERSION,
  }));
}

const STARTER_BY_ENGLISH_NAME = new Map(STARTER_CATEGORIES.map((category) => [`${category.type}|${category.names.en.toLowerCase()}`, category]));

/** A starter saved before keys existed still carries its English name, unless the guest renamed it — then it stays theirs. */
function withStarterKey(category: GuestCategory): GuestCategory {
  if (category.systemKey != null || category.parentId !== null) return category;
  const starter = STARTER_BY_ENGLISH_NAME.get(`${category.type}|${category.name.toLowerCase()}`);
  return starter ? { ...category, name: starter.names.en, systemKey: starter.key } : category;
}

function fromStarter(category: StarterCategory, walletId: string, now: string): GuestCategory {
  const { key, names, type, icon, color } = category;
  return newGuestCategory({ walletId, parentId: null, systemKey: key, name: names.en, type, icon, color }, now);
}
