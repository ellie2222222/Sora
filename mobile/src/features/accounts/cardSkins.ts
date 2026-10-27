import { accountTintIndex } from './accountTint.ts';

export interface SkinnedAccount {
  id: string;
  createdAt: string;
}

/**
 * Which card skin each account wears: no two alike while the wallet has no more accounts than skins.
 * Accounts claim in the order they were created, each taking the skin its id hashes to or the next free
 * one, so adding an account never recolours an older card. Past `skinCount` accounts, skins repeat.
 */
export function assignCardSkins(accounts: readonly SkinnedAccount[], skinCount: number): Map<string, number> {
  const assigned = new Map<string, number>();
  if (skinCount <= 0) return assigned;
  const taken = new Set<number>();
  const byAge = [...accounts].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));

  for (const account of byAge) {
    const preferred = accountTintIndex(account.id, skinCount);
    let skin = preferred;
    if (taken.size < skinCount) {
      while (taken.has(skin)) skin = (skin + 1) % skinCount;
    }
    taken.add(skin);
    assigned.set(account.id, skin);
  }
  return assigned;
}
