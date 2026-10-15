/**
 * Whether a record made offline belongs in a cached list read with given arguments. An offline
 * create is unshifted into the cached lists it would appear in once synced, and only those: an
 * expense in one wallet must not show in another wallet's list, or under an income filter.
 *
 * Mirrors the server's list filters (API spec §9.1, §10.1, §11.1, §12.1, §13.1). Platform-free for `node --test`.
 */

import { dayOfInstant, parseMoney, type TransactionQuery, type TransactionResponse } from '@sora/contracts';

/** The list arguments a record must equal wherever both name the field; paging, sorting and unknown keys never exclude. */
const EQUALITY_FILTERS = ['walletId', 'status', 'type', 'parentId'] as const;

export function fitsListFilters(record: object, args: unknown): boolean {
  if (typeof args !== 'object' || args === null) return true;
  const filters = args as Record<string, unknown>;
  const fields = record as Record<string, unknown>;
  return EQUALITY_FILTERS.every((key) => filters[key] === undefined || !(key in fields) || fields[key] === filters[key]);
}

export function fitsTransactionList(
  transaction: TransactionResponse,
  args: Partial<TransactionQuery> | undefined,
  timeZoneOfWallet: (walletId: string) => string,
): boolean {
  if (!args) return true;
  const sides = [transaction.fromAccount, transaction.toAccount].filter((side) => side !== null);

  if (args.walletId !== undefined && !sides.some((side) => side.walletId === args.walletId)) return false;
  if (args.accountId !== undefined && !sides.some((side) => side.id === args.accountId)) return false;
  if (args.categoryId !== undefined && transaction.category?.id !== args.categoryId) return false;
  if (args.type !== undefined && transaction.type !== args.type) return false;
  if (args.status !== undefined && transaction.status !== args.status) return false;

  if (args.dateFrom !== undefined || args.dateTo !== undefined) {
    // The day is the paying wallet's, as the server files it (rule 18).
    const walletId = args.walletId ?? sides[0]?.walletId;
    if (walletId === undefined) return false;
    const day = dayOfInstant(transaction.transactionDate, timeZoneOfWallet(walletId));
    if (args.dateFrom !== undefined && day < args.dateFrom) return false;
    if (args.dateTo !== undefined && day > args.dateTo) return false;
  }

  const amount = parseMoney(transaction.amount);
  if (args.minAmount !== undefined && amount < parseMoney(args.minAmount)) return false;
  if (args.maxAmount !== undefined && amount > parseMoney(args.maxAmount)) return false;

  if (args.search !== undefined && args.search !== '') {
    const needle = args.search.toLowerCase();
    const haystacks = [transaction.description, transaction.reference].filter((text) => text !== null);
    if (!haystacks.some((text) => text.toLowerCase().includes(needle))) return false;
  }
  return true;
}
