/**
 * The expenses a set of budgets could count, for `calculateBudgetSpent` to filter.
 *
 * Shared by BudgetsService and the dashboard's active-budget slice, so both read one
 * definition of which rows a category, goal or wallet-wide budget draws on (API spec §12.2).
 */

import type { Kysely } from 'kysely';

import {
  categorySubtreeIds,
  nextDay,
  parseMoney,
  startOfDay,
  TransactionStatus,
  TransactionType,
  type BudgetWindow,
  type SpendRelevantTransaction,
} from '@sora/contracts';

import type { DB } from '../database/types.ts';

export interface BudgetSpendTarget {
  wallet_id: string;
  category_id: string | null;
  /** `category_id` and its subcategories (`withCategorySubtrees`); empty for goal and wallet-wide budgets. */
  category_ids: readonly string[];
  goal_id: string | null;
  /** The window this read counts: a repeating budget's current period, a fixed one's own dates. */
  window: BudgetWindow;
  /** The wallet's zone, which the window's calendar days are read in. */
  time_zone: string;
}

/**
 * Every EXPENSE matching any budget's target: its category, its goal tag, or — for a
 * wallet-wide budget — the paying account's wallet, within the span the budgets' windows cover.
 * Currency and each budget's own window are left to `calculateBudgetSpent`; only COMPLETED rows
 * are read, matching its own rule, so the partial `idx_transactions_budget_scan` index can serve it.
 */
export async function spendableExpenses(
  db: Kysely<DB>,
  budgets: readonly BudgetSpendTarget[],
): Promise<SpendRelevantTransaction[]> {
  const categoryIds = unique(budgets.flatMap((budget) => budget.category_ids));
  const goalIds = unique(budgets.map((budget) => budget.goal_id));
  const walletIds = unique(
    budgets.filter((budget) => budget.category_id === null && budget.goal_id === null).map((budget) => budget.wallet_id),
  );
  if (categoryIds.length + goalIds.length + walletIds.length === 0) return [];
  // Windows are wallet calendar days, so the span runs from the earliest window's local midnight
  // to the local midnight after the latest one.
  const spanStart = Math.min(...budgets.map((budget) => startOfDay(budget.window.startDate, budget.time_zone).getTime()));
  const spanEnd = Math.max(...budgets.map((budget) => startOfDay(nextDay(budget.window.endDate), budget.time_zone).getTime()));

  const rows = await db
    .selectFrom('transactions as t')
    .innerJoin('accounts as a', 'a.id', 't.from_account_id')
    .select(['t.type', 't.status', 't.amount', 't.currency', 't.category_id', 't.goal_id', 't.transaction_date', 'a.wallet_id'])
    .where('t.type', '=', TransactionType.EXPENSE)
    .where('t.status', '=', TransactionStatus.COMPLETED)
    .where('t.transaction_date', '>=', new Date(spanStart))
    .where('t.transaction_date', '<', new Date(spanEnd))
    .where((eb) =>
      eb.or([
        ...(categoryIds.length > 0 ? [eb('t.category_id', 'in', categoryIds)] : []),
        ...(goalIds.length > 0 ? [eb('t.goal_id', 'in', goalIds)] : []),
        // On the transaction's own column, which its index covers, not on the joined account's wallet.
        ...(walletIds.length > 0
          ? [eb('t.from_account_id', 'in', eb.selectFrom('accounts').select('id').where('wallet_id', 'in', walletIds))]
          : []),
      ]),
    )
    .execute();

  return rows.map((row) => ({
    type: row.type,
    status: row.status,
    amount: parseMoney(row.amount),
    currency: row.currency,
    categoryId: row.category_id,
    goalId: row.goal_id,
    walletId: row.wallet_id,
    transactionDate: row.transaction_date.toISOString(),
  }));
}

/** Attaches each category budget's subtree, so a budget on a parent counts its subcategories too (API spec §12.2). */
export async function withCategorySubtrees<T extends { wallet_id: string; category_id: string | null }>(
  db: Kysely<DB>,
  budgets: readonly T[],
): Promise<(T & { category_ids: string[] })[]> {
  const walletIds = unique(budgets.filter((budget) => budget.category_id !== null).map((budget) => budget.wallet_id));
  // Archived subcategories stay in: spending recorded under them still happened.
  const categories = walletIds.length === 0
    ? []
    : await db.selectFrom('categories').select(['id', 'parent_id as parentId']).where('wallet_id', 'in', walletIds).execute();
  return budgets.map((budget) => ({
    ...budget,
    category_ids: budget.category_id === null ? [] : categorySubtreeIds(budget.category_id, categories),
  }));
}

function unique(ids: readonly (string | null)[]): string[] {
  return [...new Set(ids.filter((id): id is string => id !== null))];
}
