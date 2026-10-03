/**
 * The expenses a set of budgets could count, for `calculateBudgetSpent` to filter.
 *
 * Shared by BudgetsService and the dashboard's active-budget slice, so both read one
 * definition of which rows a category, goal or wallet-wide budget draws on (API spec §12.2).
 */

import type { Kysely } from 'kysely';

import { parseMoney, TransactionStatus, TransactionType, type SpendRelevantTransaction } from '@sora/contracts';

import type { DB } from '../database/types.ts';

export interface BudgetTargetRow {
  wallet_id: string;
  category_id: string | null;
  goal_id: string | null;
  start_date: string;
  end_date: string;
}

/**
 * Every EXPENSE matching any budget's target: its category, its goal tag, or — for a
 * wallet-wide budget — the paying account's wallet, within the span the budgets' windows cover.
 * Currency and each budget's own window are left to `calculateBudgetSpent`; only COMPLETED rows
 * are read, matching its own rule, so the partial `idx_transactions_budget_scan` index can serve it.
 */
export async function spendableExpenses(
  db: Kysely<DB>,
  budgets: readonly BudgetTargetRow[],
): Promise<SpendRelevantTransaction[]> {
  const categoryIds = unique(budgets.map((budget) => budget.category_id));
  const goalIds = unique(budgets.map((budget) => budget.goal_id));
  const walletIds = unique(
    budgets.filter((budget) => budget.category_id === null && budget.goal_id === null).map((budget) => budget.wallet_id),
  );
  if (categoryIds.length + goalIds.length + walletIds.length === 0) return [];
  // Windows are UTC calendar days (calc.ts isWithinPeriod), so the span ends at the next UTC midnight.
  const spanStart = `${budgets.map((budget) => budget.start_date).sort()[0]}T00:00:00.000Z`;
  const lastDay = budgets.map((budget) => budget.end_date).sort().at(-1)!;
  const spanEnd = new Date(Date.parse(`${lastDay}T00:00:00.000Z`) + 86_400_000).toISOString();

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

function unique(ids: readonly (string | null)[]): string[] {
  return [...new Set(ids.filter((id): id is string => id !== null))];
}
