/**
 * §14.1 GET /dashboard — one wallet's headline numbers for a period.
 *
 * `totalBalance` reuses BalanceService (BR-05: balance is derived once, not
 * re-summed here). Income/expense/spendingByCategory need a *period-scoped*,
 * transfer-excluding aggregate that BalanceService has no method for, so those
 * are queried directly here and classified with the same calc.ts functions the
 * budgets/goals math already uses, rather than inventing a second rule for
 * "does this transaction count".
 */

import { Injectable } from '@nestjs/common';

import {
  ZERO,
  add,
  calculateBudgetRemaining,
  calculateBudgetSpent,
  calculateBudgetUsage,
  calculateGoalCurrent,
  calculateGoalProgress,
  calculateGoalRemaining,
  formatMoney,
  isOverBudget,
  isWithinPeriod,
  parseMoney,
  percentageOf,
  type BudgetResponse,
  type CategorySpendSlice,
  type CurrencyTotal,
  type DashboardQuery,
  type DashboardResponse,
  type GoalResponse,
  type Scaled,
  type TransactionAccountRef,
  type TransactionResponse,
} from '@sora/contracts';

import type { AuthenticatedUser } from '../common/decorators.ts';
import { BalanceService } from '../accounts/balance.service.ts';
import { CurrencyLedger, netOf } from '../common/currency-totals.ts';
import { DatabaseService } from '../database/database.service.ts';
import { WalletAccessService } from '../wallets/wallet-access.service.ts';

const RECENT_TRANSACTIONS_LIMIT = 10;

@Injectable()
export class DashboardService {
  constructor(
    private readonly database: DatabaseService,
    private readonly access: WalletAccessService,
    private readonly balances: BalanceService,
  ) {}

  async summary(user: AuthenticatedUser, query: DashboardQuery): Promise<DashboardResponse> {
    const access = await this.access.require(user.id, query.walletId, 'VIEWER');
    const walletId = access.walletId;
    const { dateFrom, dateTo } = resolvePeriod(query);

    const accountRows = await this.database.db
      .selectFrom('accounts')
      .select(['id'])
      .where('wallet_id', '=', walletId)
      .execute();
    const accountIds = accountRows.map((row) => row.id);

    const [totalBalanceByWallet, activity, recentTransactions, activeBudgets, activeGoals] =
      await Promise.all([
        this.balances.walletBalances([walletId]),
        this.periodActivity(accountIds, dateFrom, dateTo),
        this.recentTransactions(accountIds),
        this.activeBudgets(walletId),
        this.activeGoals(walletId),
      ]);

    return {
      walletId,
      period: { dateFrom, dateTo },
      totalBalance: totalBalanceByWallet.get(walletId) ?? [],
      income: activity.income.toArray(),
      expense: activity.expense.toArray(),
      net: netOf(activity.income, activity.expense),
      spendingByCategory: await this.spendingByCategory(activity),
      recentTransactions,
      activeBudgets,
      activeGoals,
    };
  }

  /**
   * INCOME/EXPENSE only, `COMPLETED` only, within `[dateFrom, dateTo]` — BR-06:
   * a TRANSFER is excluded outright rather than netted to zero, because a
   * wallet that moved money to itself did not earn or spend anything.
   *
   * The date window is applied in JS via `isWithinPeriod`, the same calendar-day
   * comparison `calculateBudgetSpent` uses, rather than a second SQL-side rule
   * for what "within the period" means.
   */
  private async periodActivity(
    accountIds: readonly string[],
    dateFrom: string,
    dateTo: string,
  ): Promise<{
    income: CurrencyLedger;
    expense: CurrencyLedger;
    expenseByCategory: Map<string, Map<string, Scaled>>;
  }> {
    const income = new CurrencyLedger();
    const expense = new CurrencyLedger();
    const expenseByCategory = new Map<string, Map<string, Scaled>>();

    if (accountIds.length === 0) return { income, expense, expenseByCategory };

    const rows = await this.database.db
      .selectFrom('transactions')
      .select(['type', 'amount', 'currency', 'category_id', 'transaction_date'])
      .where('status', '=', 'COMPLETED')
      .where('type', 'in', ['INCOME', 'EXPENSE'])
      .where((eb) =>
        eb.or([
          eb('to_account_id', 'in', [...accountIds]),
          eb('from_account_id', 'in', [...accountIds]),
        ]),
      )
      .execute();

    for (const row of rows) {
      const isoDate = row.transaction_date.toISOString();
      if (!isWithinPeriod(isoDate, dateFrom, dateTo)) continue;

      const amount = parseMoney(row.amount);

      if (row.type === 'INCOME') {
        income.addTo(row.currency, amount);
        continue;
      }

      expense.addTo(row.currency, amount);
      // chk_transaction_shape guarantees an EXPENSE row always carries a category.
      const categoryId = row.category_id as string;
      const byCurrency = expenseByCategory.get(categoryId) ?? new Map<string, Scaled>();
      byCurrency.set(row.currency, add(byCurrency.get(row.currency) ?? ZERO, amount));
      expenseByCategory.set(categoryId, byCurrency);
    }

    return { income, expense, expenseByCategory };
  }

  /**
   * `CategorySpendSlice` carries one `amount`/`percentage` pair, not one per
   * currency, so a wallet whose expenses span more than one currency cannot
   * report a single meaningful breakdown. Scoping to whichever currency
   * accounts for the most expense keeps the number honest for the common case
   * (one wallet, one currency) instead of silently summing incompatible units.
   */
  private async spendingByCategory(activity: {
    expense: CurrencyLedger;
    expenseByCategory: Map<string, Map<string, Scaled>>;
  }): Promise<CategorySpendSlice[]> {
    const currencies = activity.expense.currencies();
    if (currencies.length === 0) return [];

    const dominant = currencies.reduce((best, currency) =>
      activity.expense.get(currency) > activity.expense.get(best) ? currency : best,
    );
    const totalExpense = activity.expense.get(dominant);

    const slices: { categoryId: string; amount: Scaled }[] = [];
    for (const [categoryId, byCurrency] of activity.expenseByCategory) {
      const amount = byCurrency.get(dominant);
      if (amount !== undefined) slices.push({ categoryId, amount });
    }
    if (slices.length === 0) return [];

    const categories = await this.database.db
      .selectFrom('categories')
      .select(['id', 'name', 'icon', 'color'])
      .where('id', 'in', slices.map((slice) => slice.categoryId))
      .execute();
    const categoryById = new Map(categories.map((category) => [category.id, category]));

    return slices
      .sort((a, b) => (a.amount > b.amount ? -1 : a.amount < b.amount ? 1 : 0))
      .map((slice) => {
        const category = categoryById.get(slice.categoryId);
        return {
          categoryId: slice.categoryId,
          categoryName: category?.name ?? '',
          icon: category?.icon ?? null,
          color: category?.color ?? null,
          amount: formatMoney(slice.amount),
          percentage: percentageOf(slice.amount, totalExpense),
        };
      });
  }

  /** Last 10 transactions touching any of this wallet's accounts, newest first. */
  private async recentTransactions(accountIds: readonly string[]): Promise<TransactionResponse[]> {
    if (accountIds.length === 0) return [];

    const rows = await this.database.db
      .selectFrom('transactions as t')
      .leftJoin('accounts as fa', 'fa.id', 't.from_account_id')
      .leftJoin('wallets as fw', 'fw.id', 'fa.wallet_id')
      .leftJoin('accounts as ta', 'ta.id', 't.to_account_id')
      .leftJoin('wallets as tw', 'tw.id', 'ta.wallet_id')
      .leftJoin('categories as c', 'c.id', 't.category_id')
      .innerJoin('users as u', 'u.id', 't.created_by_user_id')
      .select([
        't.id as id',
        't.type as type',
        't.status as status',
        't.amount as amount',
        't.currency as currency',
        't.description as description',
        't.transaction_date as transaction_date',
        't.reference as reference',
        't.created_at as created_at',
        't.updated_at as updated_at',
        'fa.id as from_account_id',
        'fa.name as from_account_name',
        'fa.currency as from_account_currency',
        'fa.wallet_id as from_wallet_id',
        'fw.name as from_wallet_name',
        'ta.id as to_account_id',
        'ta.name as to_account_name',
        'ta.currency as to_account_currency',
        'ta.wallet_id as to_wallet_id',
        'tw.name as to_wallet_name',
        'c.id as category_id',
        'c.name as category_name',
        'c.type as category_type',
        'c.icon as category_icon',
        'c.color as category_color',
        'u.id as user_id',
        'u.display_name as user_display_name',
      ])
      .where((eb) =>
        eb.or([
          eb('t.from_account_id', 'in', [...accountIds]),
          eb('t.to_account_id', 'in', [...accountIds]),
        ]),
      )
      .orderBy('t.transaction_date', 'desc')
      .limit(RECENT_TRANSACTIONS_LIMIT)
      .execute();

    return rows.map((row): TransactionResponse => {
      const fromAccount: TransactionAccountRef | null =
        row.from_account_id !== null
          ? {
              id: row.from_account_id,
              name: row.from_account_name as string,
              currency: row.from_account_currency as string,
              walletId: row.from_wallet_id as string,
              walletName: row.from_wallet_name as string,
            }
          : null;

      const toAccount: TransactionAccountRef | null =
        row.to_account_id !== null
          ? {
              id: row.to_account_id,
              name: row.to_account_name as string,
              currency: row.to_account_currency as string,
              walletId: row.to_wallet_id as string,
              walletName: row.to_wallet_name as string,
            }
          : null;

      return {
        id: row.id,
        type: row.type,
        status: row.status,
        amount: row.amount,
        currency: row.currency,
        description: row.description,
        transactionDate: row.transaction_date.toISOString(),
        reference: row.reference,
        fromAccount,
        toAccount,
        category:
          row.category_id !== null
            ? {
                id: row.category_id,
                name: row.category_name as string,
                type: row.category_type as 'INCOME' | 'EXPENSE',
                icon: row.category_icon,
                color: row.category_color,
              }
            : null,
        createdBy: { id: row.user_id, displayName: row.user_display_name },
        isCrossWallet: fromAccount !== null && toAccount !== null && fromAccount.walletId !== toAccount.walletId,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
      };
    });
  }

  /** §12.1's shape, scoped to `status = 'ACTIVE'` — the dashboard's overview slice. */
  private async activeBudgets(walletId: string): Promise<BudgetResponse[]> {
    const budgets = await this.database.db
      .selectFrom('budgets as b')
      .innerJoin('categories as c', 'c.id', 'b.category_id')
      .select([
        'b.id as id',
        'b.wallet_id as wallet_id',
        'b.name as name',
        'b.amount as amount',
        'b.currency as currency',
        'b.period_type as period_type',
        'b.start_date as start_date',
        'b.end_date as end_date',
        'b.status as status',
        'b.created_at as created_at',
        'b.updated_at as updated_at',
        'c.id as category_id',
        'c.name as category_name',
        'c.icon as category_icon',
        'c.color as category_color',
      ])
      .where('b.wallet_id', '=', walletId)
      .where('b.status', '=', 'ACTIVE')
      .execute();

    if (budgets.length === 0) return [];

    const categoryIds = [...new Set(budgets.map((budget) => budget.category_id))];
    const expenseRows = await this.database.db
      .selectFrom('transactions')
      .select(['status', 'amount', 'category_id', 'transaction_date'])
      .where('type', '=', 'EXPENSE')
      .where('category_id', 'in', categoryIds)
      .execute();

    return budgets.map((budget) => {
      const relevant = expenseRows
        .filter((row) => row.category_id === budget.category_id)
        .map((row) => ({
          type: 'EXPENSE' as const,
          status: row.status,
          amount: parseMoney(row.amount),
          categoryId: row.category_id as string,
          transactionDate: row.transaction_date.toISOString(),
        }));

      const amount = parseMoney(budget.amount);
      const spent = calculateBudgetSpent(
        { categoryId: budget.category_id, startDate: budget.start_date, endDate: budget.end_date },
        relevant,
      );

      return {
        id: budget.id,
        walletId: budget.wallet_id,
        name: budget.name,
        amount: budget.amount,
        currency: budget.currency,
        periodType: budget.period_type,
        startDate: budget.start_date,
        endDate: budget.end_date,
        status: budget.status,
        category: {
          id: budget.category_id,
          name: budget.category_name,
          icon: budget.category_icon,
          color: budget.category_color,
        },
        spent: formatMoney(spent),
        remaining: formatMoney(calculateBudgetRemaining(amount, spent)),
        usagePercentage: calculateBudgetUsage(amount, spent),
        isOverBudget: isOverBudget(amount, spent),
        createdAt: budget.created_at.toISOString(),
        updatedAt: budget.updated_at.toISOString(),
      };
    });
  }

  /** §13.1's shape, scoped to `status = 'ACTIVE'`. */
  private async activeGoals(walletId: string): Promise<GoalResponse[]> {
    const goals = await this.database.db
      .selectFrom('goals')
      .selectAll()
      .where('wallet_id', '=', walletId)
      .where('status', '=', 'ACTIVE')
      .execute();

    if (goals.length === 0) return [];

    const goalIds = goals.map((goal) => goal.id);
    const contributions = await this.database.db
      .selectFrom('goal_contributions')
      .select(['goal_id', 'amount'])
      .where('goal_id', 'in', goalIds)
      .execute();

    return goals.map((goal) => {
      const own = contributions.filter((contribution) => contribution.goal_id === goal.id);
      const targetAmount = parseMoney(goal.target_amount);
      const current = calculateGoalCurrent(own.map((contribution) => parseMoney(contribution.amount)));

      return {
        id: goal.id,
        walletId: goal.wallet_id,
        name: goal.name,
        description: goal.description,
        targetAmount: goal.target_amount,
        currency: goal.currency,
        targetDate: goal.target_date,
        status: goal.status,
        currentAmount: formatMoney(current),
        remaining: formatMoney(calculateGoalRemaining(targetAmount, current)),
        progressPercentage: calculateGoalProgress(targetAmount, current),
        contributionCount: own.length,
        createdAt: goal.created_at.toISOString(),
        updatedAt: goal.updated_at.toISOString(),
      };
    });
  }
}

/** `dateFrom`/`dateTo` each default independently to the current calendar month's bound. */
function resolvePeriod(query: DashboardQuery): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));

  return {
    dateFrom: query.dateFrom ?? toCalendarDate(monthStart),
    dateTo: query.dateTo ?? toCalendarDate(monthEnd),
  };
}

function toCalendarDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
