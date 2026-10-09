/** Beyond this many accounts the scope row keeps two chips and moves the rest behind "…", so it never scrolls. */
const MAX_INLINE_ACCOUNTS = 3;
const INLINE_WHEN_OVERFLOWING = 2;

export function overflowsScopeRow(accountCount: number): boolean {
  return accountCount > MAX_INLINE_ACCOUNTS;
}

/** The accounts shown as chips: the first few, with a selection from further down taking the last slot so it stays visible. */
export function inlineAccounts<T extends { id: string }>(accounts: readonly T[], selectedAccountId: string | null): T[] {
  if (!overflowsScopeRow(accounts.length)) return [...accounts];
  const leading = accounts.slice(0, INLINE_WHEN_OVERFLOWING);
  const selected = accounts.find((account) => account.id === selectedAccountId);
  if (selected === undefined || leading.includes(selected)) return leading;
  return [...leading.slice(0, INLINE_WHEN_OVERFLOWING - 1), selected];
}
