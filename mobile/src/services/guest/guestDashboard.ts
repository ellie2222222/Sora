/**
 * Guest-mode dashboard — the local mirror of `dashboardApi`, mirroring
 * `dashboard.service.ts`'s shape. `totalBalance`/`activeBudgets`/`activeGoals`/
 * `recentTransactions` are reused from the sibling guest APIs rather than
 * recomputed a second time; only period-scoped income/expense/spending —
 * which none of those already expose — is computed here.
 *
 * BR-06: a TRANSFER is excluded outright from income/expense/spendingByCategory,
 * not netted to zero — a wallet that moved money to itself did not earn or
 * spend anything.
 */

import {
  add,
  countsAsPeriodActivity,
  formatMoney,
  isWithinPeriod,
  parseMoney,
  percentageOf,
  subtract,
  transferDirection,
  ZERO,
  BudgetStatus,
  GoalStatus,
  TransactionType,
  ValuationStatus,
  type CategorySpendSlice,
  type ConvertedValuation,
  type CurrencyTotal,
  type DashboardQuery,
  type DashboardResponse,
  type Scaled,
} from '@sora/contracts';

import { guestError } from './guestErrors.ts';
import { guestBudgetsApi } from './guestBudgets.ts';
import { guestGoalsApi } from './guestGoals.ts';
import { guestStore } from './guestStorage.ts';
import { type GuestTransaction, type GuestWallet } from './guestStore.ts';
import { guestTransactionsApi } from './guestTransactions.ts';
import { guestWalletsApi } from './guestWallets.ts';

const RECENT_TRANSACTIONS_LIMIT = 10;

function requireWallet(): GuestWallet {
  const wallet = guestStore.current().wallet;
  if (!wallet) throw guestError('WALLET_NOT_FOUND');
  return wallet;
}

/** `dateFrom`/`dateTo` each default independently to the current calendar month's bound. */
function resolvePeriod(query: DashboardQuery): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));

  return {
    dateFrom: query.dateFrom ?? monthStart.toISOString().slice(0, 10),
    dateTo: query.dateTo ?? monthEnd.toISOString().slice(0, 10),
  };
}

function toCurrencyTotals(byCurrency: ReadonlyMap<string, Scaled>): CurrencyTotal[] {
  return [...byCurrency.keys()].sort().map((currency) => ({ currency, amount: formatMoney(byCurrency.get(currency)!) }));
}

function netOf(income: ReadonlyMap<string, Scaled>, expense: ReadonlyMap<string, Scaled>): CurrencyTotal[] {
  const currencies = new Set([...income.keys(), ...expense.keys()]);
  const net = new Map<string, Scaled>();
  for (const currency of currencies) {
    net.set(currency, subtract(income.get(currency) ?? ZERO, expense.get(currency) ?? ZERO));
  }
  return toCurrencyTotals(net);
}

interface PeriodActivity {
  income: Map<string, Scaled>;
  expense: Map<string, Scaled>;
  expenseByCategory: Map<string, Map<string, Scaled>>;
  transferredIn: Map<string, Scaled>;
  transferredOut: Map<string, Scaled>;
}

/**
 * INCOME/EXPENSE only, COMPLETED only, within `[dateFrom, dateTo]`, plus the
 * period's transfer flow — the same rules `periodActivity` enforces
 * server-side, through the same shared `countsAsPeriodActivity`/
 * `transferDirection` predicates rather than a second local copy of BR-06.
 *
 * A guest wallet has no other wallet to transfer with, so `transferredIn/Out`
 * are structurally always empty here; they are computed anyway so the guest
 * response cannot drift into a different *shape* from the server's.
 */
function periodActivity(
  transactions: readonly GuestTransaction[],
  accountIds: ReadonlySet<string>,
  dateFrom: string,
  dateTo: string,
): PeriodActivity {
  const income = new Map<string, Scaled>();
  const expense = new Map<string, Scaled>();
  const expenseByCategory = new Map<string, Map<string, Scaled>>();
  const transferredIn = new Map<string, Scaled>();
  const transferredOut = new Map<string, Scaled>();

  for (const transaction of transactions) {
    const amount = parseMoney(transaction.amount);

    if (!countsAsPeriodActivity(transaction, dateFrom, dateTo)) {
      if (!isWithinPeriod(transaction.transactionDate, dateFrom, dateTo)) continue;
      const direction = transferDirection(transaction, accountIds);
      if (direction === 'IN') transferredIn.set(transaction.currency, add(transferredIn.get(transaction.currency) ?? ZERO, amount));
      if (direction === 'OUT') transferredOut.set(transaction.currency, add(transferredOut.get(transaction.currency) ?? ZERO, amount));
      continue;
    }

    if (transaction.type === TransactionType.INCOME) {
      income.set(transaction.currency, add(income.get(transaction.currency) ?? ZERO, amount));
      continue;
    }

    expense.set(transaction.currency, add(expense.get(transaction.currency) ?? ZERO, amount));
    // chk_transaction_shape guarantees an EXPENSE row always carries a category.
    const categoryId = transaction.categoryId!;
    const byCurrency = expenseByCategory.get(categoryId) ?? new Map<string, Scaled>();
    byCurrency.set(transaction.currency, add(byCurrency.get(transaction.currency) ?? ZERO, amount));
    expenseByCategory.set(categoryId, byCurrency);
  }

  return { income, expense, expenseByCategory, transferredIn, transferredOut };
}

/**
 * Scoped to whichever currency accounts for the most expense — a
 * `CategorySpendSlice` carries one amount/percentage pair, not one per
 * currency, so a wallet whose expenses span more than one currency cannot
 * report a single meaningful breakdown.
 */
function spendingByCategory(activity: PeriodActivity): CategorySpendSlice[] {
  const currencies = [...activity.expense.keys()];
  if (currencies.length === 0) return [];

  const dominant = currencies.reduce((best, currency) =>
    (activity.expense.get(currency) ?? ZERO) > (activity.expense.get(best) ?? ZERO) ? currency : best,
  );
  const totalExpense = activity.expense.get(dominant) ?? ZERO;

  const { categories } = guestStore.current();
  const slices: { categoryId: string; amount: Scaled }[] = [];
  for (const [categoryId, byCurrency] of activity.expenseByCategory) {
    const amount = byCurrency.get(dominant);
    if (amount !== undefined) slices.push({ categoryId, amount });
  }

  return slices
    .sort((a, b) => (a.amount > b.amount ? -1 : a.amount < b.amount ? 1 : 0))
    .map((slice) => {
      const category = categories.find((candidate) => candidate.id === slice.categoryId);
      return {
        categoryId: slice.categoryId,
        categoryName: category?.name ?? '',
        icon: category?.icon ?? null,
        color: category?.color ?? null,
        amount: formatMoney(slice.amount),
        percentage: percentageOf(slice.amount, totalExpense),
        parentId: category?.parentId ?? null,
      };
    });
}

export const guestDashboardApi = {
  async summary(query: DashboardQuery): Promise<DashboardResponse> {
    const wallet = requireWallet();
    const { dateFrom, dateTo } = resolvePeriod(query);
    const { transactions } = guestStore.current();

    const [walletResponse, recent, activeBudgets, activeGoals] = await Promise.all([
      guestWalletsApi.detail(wallet.id),
      guestTransactionsApi.list({ sortBy: '-transactionDate', page: 1, pageSize: RECENT_TRANSACTIONS_LIMIT }),
      guestBudgetsApi.list({ walletId: wallet.id, status: BudgetStatus.ACTIVE }),
      guestGoalsApi.list({ walletId: wallet.id, status: GoalStatus.ACTIVE }),
    ]);

    const accountIds = new Set(guestStore.current().accounts.map((account) => account.id));
    const activity = periodActivity(transactions, accountIds, dateFrom, dateTo);
    const totalBalance = walletResponse.balances;

    let valuation: ConvertedValuation | null | undefined = undefined;
    if (query.displayCurrency) {
      const isAllTarget = totalBalance.every((t) => t.currency === query.displayCurrency);
      if (isAllTarget) {
        const sum = totalBalance.reduce((acc, t) => add(acc, parseMoney(t.amount)), ZERO);
        valuation = {
          currency: query.displayCurrency,
          amount: formatMoney(sum),
          isApproximate: false,
          status: ValuationStatus.FRESH,
        };
      } else {
        valuation = {
          currency: query.displayCurrency,
          amount: null,
          isApproximate: true,
          status: ValuationStatus.UNAVAILABLE,
          missingCurrencies: totalBalance
            .filter((t) => t.currency !== query.displayCurrency)
            .map((t) => t.currency),
        };
      }
    }

    return {
      walletId: wallet.id,
      period: { dateFrom, dateTo },
      totalBalance,
      income: toCurrencyTotals(activity.income),
      expense: toCurrencyTotals(activity.expense),
      net: netOf(activity.income, activity.expense),
      transferredIn: toCurrencyTotals(activity.transferredIn),
      transferredOut: toCurrencyTotals(activity.transferredOut),
      spendingByCategory: spendingByCategory(activity),
      // A guest wallet has exactly one (local, unnamed) member, so there is no
      // split to report — the widget that consumes this only renders for a
      // shared wallet anyway.
      spendingByMember: [],
      recentTransactions: recent.items,
      activeBudgets,
      activeGoals,
      ...(valuation !== undefined ? { valuation } : {}),
    };
  },
};
