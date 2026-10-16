import type { AccountTint } from '@/design-system';

/**
 * The same tint for an account on every screen, every render and in both modes: picked from its id,
 * which never changes, rather than its position in a list, which does.
 */
export function accountTintIndex(accountId: string, count: number): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < accountId.length; i++) {
    hash ^= accountId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % count;
}

export function accountTint(accountId: string, tints: readonly AccountTint[]): AccountTint {
  return tints[accountTintIndex(accountId, tints.length)]!;
}
