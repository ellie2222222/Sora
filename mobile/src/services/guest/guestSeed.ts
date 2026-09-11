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

import { STARTER_CATEGORIES } from '@sora/contracts';

import { newLocalId } from './guestIds.ts';
import { guestStore } from './guestStorage.ts';
import { type GuestData } from './guestStore.ts';

/** VND matches `registerSchema`'s own default `baseCurrency` — there is no
 * registration step in guest mode to have supplied one. */
const DEFAULT_GUEST_CURRENCY = 'VND';

export async function ensureSeeded(): Promise<GuestData> {
  await guestStore.hydrate();
  if (guestStore.hasData()) return guestStore.current();

  return guestStore.mutate((data) => {
    if (data.wallet !== null) return data;

    const now = new Date().toISOString();
    const walletId = newLocalId();

    return {
      ...data,
      wallet: { id: walletId, name: 'Guest Wallet', createdAt: now, updatedAt: now },
      categories: STARTER_CATEGORIES.map((category) => ({
        id: newLocalId(),
        walletId,
        parentId: null,
        name: category.name,
        type: category.type,
        icon: category.icon,
        color: category.color,
        status: 'ACTIVE' as const,
        createdAt: now,
        updatedAt: now,
      })),
      accounts: [
        {
          id: newLocalId(),
          walletId,
          name: 'Cash',
          type: 'CASH' as const,
          currency: DEFAULT_GUEST_CURRENCY,
          initialBalance: '0.0000',
          status: 'ACTIVE' as const,
          createdAt: now,
          updatedAt: now,
        },
      ],
    };
  });
}
