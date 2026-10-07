/**
 * Presentation math for the dashboard's category breakdown.
 *
 * Pure functions over `CategorySpendSlice[]`, kept out of the screen so the
 * ranking and grouping rules can be tested under plain `node --test` — the
 * screen itself is a `.tsx` file the test runner cannot load. Every amount is
 * handled as a scaled bigint through `@sora/contracts`, never a JS number
 * (rule 1).
 */

import {
  ZERO,
  add,
  formatMoney,
  isNegative,
  negate,
  parseMoney,
  percentageOf,
  subtract,
  type CategorySpendSlice,
  type MoneyString,
} from '@sora/contracts';

export interface RankedCategory {
  slice: CategorySpendSlice;
  /** Rank within the period, 1-based, by amount descending. */
  rank: number;
  /**
   * Change against the comparison period as a percentage of it, or `null` when
   * there is nothing honest to compare against: no comparison period was
   * loaded, or the category recorded nothing then (a jump from zero is an
   * infinite increase, not a "+100%").
   */
  changePercent: number | null;
  /** True when this category recorded nothing in the comparison period. */
  isNew: boolean;
}

/**
 * Categories ranked by spend, each carrying its change against the previous
 * period.
 *
 * `spendingByCategory` already arrives sorted by amount, but that is the
 * server's ordering of its own slices — re-sorting here keeps the ranking
 * correct if a caller ever passes a filtered or merged array.
 */
export function rankCategories(
  current: readonly CategorySpendSlice[],
  previous: readonly CategorySpendSlice[] = [],
  limit?: number,
): RankedCategory[] {
  const previousById = new Map(previous.map((slice) => [slice.categoryId, slice]));

  const ranked = [...current]
    .sort(byAmountDescending)
    .map((slice, index): RankedCategory => {
      const before = previousById.get(slice.categoryId);
      return {
        slice,
        rank: index + 1,
        changePercent: before === undefined ? null : changeAgainst(slice.amount, before.amount),
        isNew: before === undefined,
      };
    });

  return limit === undefined ? ranked : ranked.slice(0, limit);
}

/**
 * `current` against `previous` as a percentage of `previous`.
 *
 * `null` when `previous` was zero: the change is undefined, not 100% — a
 * category that went from nothing to 500,000 has no meaningful percentage, and
 * reporting one would be inventing a figure.
 */
export function changeAgainst(current: MoneyString, previous: MoneyString): number | null {
  const before = parseMoney(previous);
  if (before === ZERO) return null;

  const difference = subtract(parseMoney(current), before);
  // A negative denominator would flip the sign of the result; spending is
  // never negative in practice, but the guard costs nothing and keeps a
  // corrected/refunded category from reading backwards.
  const magnitude = isNegative(before) ? negate(before) : before;
  return percentageOf(difference, magnitude, 0);
}

export interface CategoryGroup {
  /** The parent's id, or the category's own id when it has no parent. */
  id: string;
  name: string;
  color: string | null;
  /** The parent's own direct spending first, then its children, by amount. */
  slices: CategorySpendSlice[];
  amount: MoneyString;
  /** Sum of the group's slice percentages — every slice shares one denominator. */
  percentage: number;
  /** False for a top-level category standing alone, so a caller can skip the grouping chrome. */
  hasChildren: boolean;
}

export interface CategoryNode {
  id: string;
  name: string;
  parentId: string | null;
}

/**
 * The breakdown rolled up to each slice's top-level category, at any depth, so a
 * wallet that splits "Food" into "Groceries"/"Dining Out" reads the Food total
 * without losing the children — the same subtree a budget on Food counts.
 *
 * `categories` supplies the ancestors a slice doesn't carry and names a top-level
 * category that recorded no direct spending of its own; one it can't resolve falls
 * back to the slice's direct parent and then its first child's name, rather than
 * rendering an empty header.
 */
export function groupByTopLevel(
  slices: readonly CategorySpendSlice[],
  categories: readonly CategoryNode[] = [],
): CategoryGroup[] {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const topLevelOf = (startId: string): string => {
    const visited = new Set<string>();
    let currentId = startId;
    // Visited ids are tracked: the server rejects cycles, but a bad cached row must not hang the dashboard.
    while (!visited.has(currentId)) {
      visited.add(currentId);
      const parentId = byId.get(currentId)?.parentId;
      if (!parentId) return currentId;
      currentId = parentId;
    }
    return currentId;
  };
  const groups = new Map<string, CategoryGroup>();

  for (const slice of slices) {
    const id = topLevelOf(slice.parentId ?? slice.categoryId);
    const isChild = slice.categoryId !== id;
    const existing = groups.get(id);

    if (existing === undefined) {
      groups.set(id, {
        id,
        name: isChild ? (byId.get(id)?.name ?? slice.categoryName) : slice.categoryName,
        color: slice.color,
        slices: [slice],
        amount: slice.amount,
        percentage: slice.percentage,
        hasChildren: isChild,
      });
      continue;
    }

    existing.slices.push(slice);
    existing.amount = formatMoney(add(parseMoney(existing.amount), parseMoney(slice.amount)));
    existing.percentage = roundPercentage(existing.percentage + slice.percentage);
    if (isChild) existing.hasChildren = true;
    // A parent with direct spending of its own names and colours the group.
    if (slice.categoryId === id) {
      existing.name = slice.categoryName;
      existing.color = slice.color;
    }
  }

  return [...groups.values()]
    .map((group) => ({ ...group, slices: [...group.slices].sort(byAmountDescending) }))
    .sort((a, b) => compareAmount(b.amount, a.amount));
}

function byAmountDescending(a: CategorySpendSlice, b: CategorySpendSlice): number {
  return compareAmount(b.amount, a.amount);
}

function compareAmount(a: MoneyString, b: MoneyString): number {
  const left = parseMoney(a);
  const right = parseMoney(b);
  return left === right ? 0 : left > right ? 1 : -1;
}

/** Percentages arrive rounded to one decimal; summing them re-introduces float noise. */
function roundPercentage(value: number): number {
  return Math.round(value * 10) / 10;
}

export type DashboardEmptyReason = 'no-accounts' | 'no-transactions' | 'empty-period';

/** The fields of `DashboardResponse` that decide *why* a dashboard has nothing to show. */
export interface DashboardEmptinessInput {
  totalBalance: readonly unknown[];
  income: readonly unknown[];
  expense: readonly unknown[];
  transferredIn: readonly unknown[];
  transferredOut: readonly unknown[];
  recentTransactions: readonly unknown[];
}

/**
 * Why this dashboard is blank, or `null` when it is not.
 *
 * The three reasons need different copy and different actions, and both
 * discriminators are all-time figures rather than period-scoped ones:
 * `totalBalance` carries one entry per account even at a zero balance, and
 * `recentTransactions` is the wallet's last ten regardless of the window. A
 * wallet with neither has never been set up; one with both has simply recorded
 * nothing in the period being viewed.
 */
export function emptyReasonFor(data: DashboardEmptinessInput): DashboardEmptyReason | null {
  const hasActivity =
    data.income.length > 0 ||
    data.expense.length > 0 ||
    data.transferredIn.length > 0 ||
    data.transferredOut.length > 0;
  if (hasActivity) return null;

  if (data.totalBalance.length === 0) return 'no-accounts';
  if (data.recentTransactions.length === 0) return 'no-transactions';
  return 'empty-period';
}
