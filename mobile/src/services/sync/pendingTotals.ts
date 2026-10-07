/**
 * Applies a write made offline to the totals the server last reported, so balances,
 * budgets, goals and the dashboard move the moment a queued write is made rather than
 * once it syncs. Each rule mirrors the server's own aggregation (`BalanceService`,
 * `DashboardService`), on scaled bigints through `@sora/contracts` only (rule 1).
 * The sync engine's tag invalidation replaces every patched figure with the server's.
 *
 * Mutates in place: callers hand it RTK Query drafts. Platform-free for `node --test`.
 */

import {
  add,
  calculateBudgetRemaining,
  calculateBudgetUsage,
  calculateGoalProgress,
  calculateGoalRemaining,
  formatMoney,
  isBudgetTarget,
  isOverBudget,
  isWithinPeriod,
  parseMoney,
  percentageOf,
  subtract,
  TransactionStatus,
  TransactionType,
  ZERO,
  type AccountDetailResponse,
  type AccountResponse,
  type BudgetResponse,
  type CurrencyTotal,
  type DashboardResponse,
  type GoalResponse,
  type Scaled,
  type TransactionResponse,
  type WalletResponse,
} from '@sora/contracts';

import { deviceTimeZone } from '../../utils/date.ts';

/** Matches the server's `RECENT_TRANSACTIONS_LIMIT`. */
const RECENT_TRANSACTIONS_LIMIT = 10;

export interface LedgerLeg {
  accountId: string;
  /** Null when the account is not cached; that leg then moves no wallet-level figure. */
  walletId: string | null;
}

/** One transaction appearing (`create`) or being deleted (`cancel`) while offline. */
export interface LedgerChange {
  kind: 'create' | 'cancel';
  transaction: TransactionResponse;
  from: LedgerLeg | null;
  to: LedgerLeg | null;
  /** Whose per-member slice moves; an optimistic record's `createdBy` is only a placeholder. */
  actorUserId: string;
  /** Half of an in-place edit (the old figures reversed, or the new ones applied): no row appears or disappears. */
  inPlace: boolean;
}

export function ledgerChangeOf(
  kind: LedgerChange['kind'],
  transaction: TransactionResponse,
  options: { accountIds?: { from: string | null; to: string | null }; actorUserId?: string; inPlace?: boolean } = {},
): LedgerChange {
  const accountIds = options.accountIds ?? {
    from: transaction.fromAccount?.id ?? null,
    to: transaction.toAccount?.id ?? null,
  };
  const leg = (accountId: string | null, ref: TransactionResponse['fromAccount']): LedgerLeg | null =>
    accountId === null ? null : { accountId, walletId: ref?.id === accountId ? ref.walletId : null };
  return {
    kind,
    transaction,
    from: leg(accountIds.from, transaction.fromAccount),
    to: leg(accountIds.to, transaction.toAccount),
    actorUserId: options.actorUserId ?? transaction.createdBy.id,
    inPlace: options.inPlace ?? false,
  };
}

/** Only a completed transaction moves money (`affectsBalance`); a cancel reverses one. */
function signedAmount(change: LedgerChange): Scaled | null {
  if (change.transaction.status !== TransactionStatus.COMPLETED) return null;
  const amount = parseMoney(change.transaction.amount);
  return change.kind === 'create' ? amount : subtract(ZERO, amount);
}

function addMoney(value: string, delta: Scaled): string {
  return formatMoney(add(parseMoney(value), delta));
}

function addToTotals(totals: CurrencyTotal[], currency: string, delta: Scaled): void {
  const existing = totals.find((total) => total.currency === currency);
  if (existing) {
    existing.amount = addMoney(existing.amount, delta);
    return;
  }
  totals.push({ currency, amount: formatMoney(delta) });
  totals.sort((a, b) => a.currency.localeCompare(b.currency));
}

function totalOf(totals: readonly CurrencyTotal[], currency: string): Scaled {
  const found = totals.find((total) => total.currency === currency);
  return found ? parseMoney(found.amount) : ZERO;
}

/** What the change does to one wallet's money: legs inside it, netted (an internal transfer is zero). */
function walletDelta(change: LedgerChange, walletId: string, amount: Scaled): Scaled {
  let delta = ZERO;
  if (change.to?.walletId === walletId) delta = add(delta, amount);
  if (change.from?.walletId === walletId) delta = subtract(delta, amount);
  return delta;
}

export function applyToAccount(account: AccountResponse | AccountDetailResponse, change: LedgerChange): void {
  const touchesTo = change.to?.accountId === account.id;
  const touchesFrom = change.from?.accountId === account.id;
  if (!touchesTo && !touchesFrom) return;

  // Every row counts, cancelled included, so a cancel leaves the count alone (`activityForAccount`).
  if ('transactionCount' in account && change.kind === 'create' && !change.inPlace) account.transactionCount += 1;

  const amount = signedAmount(change);
  if (amount === null) return;
  if (touchesTo) account.balance = addMoney(account.balance, amount);
  if (touchesFrom) account.balance = addMoney(account.balance, subtract(ZERO, amount));
  if (!('transactionCount' in account)) return;

  const { type } = change.transaction;
  if (type === TransactionType.INCOME && touchesTo) account.totalIncome = addMoney(account.totalIncome, amount);
  if (type === TransactionType.EXPENSE && touchesFrom) account.totalExpense = addMoney(account.totalExpense, amount);
  if (type === TransactionType.TRANSFER) {
    if (touchesTo) account.transferredIn = addMoney(account.transferredIn, amount);
    if (touchesFrom) account.transferredOut = addMoney(account.transferredOut, amount);
  }
}

export function applyToWallet(wallet: WalletResponse, change: LedgerChange): void {
  const amount = signedAmount(change);
  if (amount === null) return;
  const delta = walletDelta(change, wallet.id, amount);
  if (delta !== ZERO) addToTotals(wallet.balances, change.transaction.currency, delta);
}

/** An account's opening balance is part of its wallet's total from the moment it exists. */
export function applyNewAccountToWallet(wallet: WalletResponse, account: AccountResponse): void {
  if (wallet.id !== account.walletId) return;
  addToTotals(wallet.balances, account.currency, parseMoney(account.initialBalance));
  wallet.accountCount += 1;
}

export function applyNewAccountToDashboard(dashboard: DashboardResponse, account: AccountResponse): void {
  if (dashboard.walletId !== account.walletId) return;
  addToTotals(dashboard.totalBalance, account.currency, parseMoney(account.initialBalance));
}

/** `calculateBudgetSpent`: completed EXPENSE on the budget's target, in its currency and the period it currently reports. */
export function applyToBudget(budget: BudgetResponse, change: LedgerChange): void {
  const { transaction } = change;
  if (transaction.type !== TransactionType.EXPENSE) return;
  const target = {
    categoryId: transaction.category?.id ?? null,
    goalId: transaction.goalId,
    walletId: transaction.fromAccount?.walletId ?? null,
  };
  // A budget cached by an app version before `categoryIds` existed still matches its own category.
  if (!isBudgetTarget({ ...budget, categoryIds: budget.categoryIds ?? [] }, target)) return;
  if (transaction.currency !== budget.currency) return;
  // A budget cached before responses carried a zone is read in this device's.
  if (!isWithinPeriod(transaction.transactionDate, budget.periodStart, budget.periodEnd, budget.timeZone ?? deviceTimeZone())) return;
  const amount = signedAmount(change);
  if (amount === null) return;

  const limit = parseMoney(budget.amount);
  const spent = add(parseMoney(budget.spent), amount);
  budget.spent = formatMoney(spent);
  budget.remaining = formatMoney(calculateBudgetRemaining(limit, spent));
  budget.usagePercentage = calculateBudgetUsage(limit, spent);
  budget.isOverBudget = isOverBudget(limit, spent);
}

/** A contribution added offline: `calculateGoalCurrent` is the sum, so it just grows by one. */
export function applyContributionToGoal(goal: GoalResponse, goalId: string, amount: string): void {
  if (goal.id !== goalId) return;
  const target = parseMoney(goal.targetAmount);
  const current = add(parseMoney(goal.currentAmount), parseMoney(amount));
  goal.currentAmount = formatMoney(current);
  goal.remaining = formatMoney(calculateGoalRemaining(target, current));
  goal.progressPercentage = calculateGoalProgress(target, current);
  goal.contributionCount += 1;
}

/**
 * The category breakdown covers only the wallet's dominant expense currency. When a
 * change would make another currency dominant, the slices for it aren't in the
 * response, so they are left as the server said until the next read.
 */
function applyToCategorySlices(dashboard: DashboardResponse, change: LedgerChange, amount: Scaled, before: string | null): void {
  const { transaction } = change;
  const after = dominantCurrency(dashboard.expense);
  if (after !== before || after !== transaction.currency || !transaction.category) return;

  const categoryId = transaction.category.id;
  const slice = dashboard.spendingByCategory.find((candidate) => candidate.categoryId === categoryId);
  if (slice) {
    slice.amount = addMoney(slice.amount, amount);
  } else if (amount > ZERO) {
    dashboard.spendingByCategory.push({
      categoryId,
      categoryName: transaction.category.name,
      icon: transaction.category.icon,
      color: transaction.category.color,
      amount: formatMoney(amount),
      percentage: 0,
      parentId: null,
    });
  }

  const total = totalOf(dashboard.expense, after);
  dashboard.spendingByCategory = dashboard.spendingByCategory
    .filter((candidate) => parseMoney(candidate.amount) > ZERO)
    .sort((a, b) => {
      const left = parseMoney(a.amount);
      const right = parseMoney(b.amount);
      return left > right ? -1 : left < right ? 1 : 0;
    });
  for (const candidate of dashboard.spendingByCategory) {
    candidate.percentage = percentageOf(parseMoney(candidate.amount), total);
  }
}

// Sorted first so a tie picks the same currency `DashboardService.spendingByCategory` does.
function dominantCurrency(expense: readonly CurrencyTotal[]): string | null {
  let best: CurrencyTotal | null = null;
  for (const total of [...expense].sort((a, b) => a.currency.localeCompare(b.currency))) {
    if (best === null || parseMoney(total.amount) > parseMoney(best.amount)) best = total;
  }
  return best?.currency ?? null;
}

function recomputeNet(dashboard: DashboardResponse): void {
  const currencies = [...new Set([...dashboard.income, ...dashboard.expense].map((total) => total.currency))].sort();
  dashboard.net = currencies.map((currency) => ({
    currency,
    amount: formatMoney(subtract(totalOf(dashboard.income, currency), totalOf(dashboard.expense, currency))),
  }));
}

export function applyToDashboard(dashboard: DashboardResponse, change: LedgerChange): void {
  const walletId = dashboard.walletId;
  const { transaction } = change;
  const touchesWallet = change.to?.walletId === walletId || change.from?.walletId === walletId;
  if (!touchesWallet) return;

  for (const budget of dashboard.activeBudgets) applyToBudget(budget, change);
  if (change.inPlace) {
    if (change.kind === 'create') {
      dashboard.recentTransactions = dashboard.recentTransactions.map((candidate) => (candidate.id === transaction.id ? transaction : candidate));
    }
  } else if (change.kind === 'create') {
    dashboard.recentTransactions = [transaction, ...dashboard.recentTransactions].slice(0, RECENT_TRANSACTIONS_LIMIT);
  } else {
    const recent = dashboard.recentTransactions.find((candidate) => candidate.id === transaction.id);
    if (recent) recent.status = TransactionStatus.DELETED;
  }

  const amount = signedAmount(change);
  if (amount === null) return;
  const balanceDelta = walletDelta(change, walletId, amount);
  if (balanceDelta !== ZERO) addToTotals(dashboard.totalBalance, transaction.currency, balanceDelta);
  const { dateFrom, dateTo, timeZone = deviceTimeZone() } = dashboard.period;
  if (!isWithinPeriod(transaction.transactionDate, dateFrom, dateTo, timeZone)) return;

  if (transaction.type === TransactionType.TRANSFER) {
    const incoming = change.to?.walletId === walletId;
    const outgoing = change.from?.walletId === walletId;
    if (incoming && !outgoing) addToTotals(dashboard.transferredIn, transaction.currency, amount);
    if (outgoing && !incoming) addToTotals(dashboard.transferredOut, transaction.currency, amount);
    return;
  }

  const isIncome = transaction.type === TransactionType.INCOME;
  const before = dominantCurrency(dashboard.expense);
  addToTotals(isIncome ? dashboard.income : dashboard.expense, transaction.currency, amount);
  recomputeNet(dashboard);
  const member = dashboard.spendingByMember.find((candidate) => candidate.userId === change.actorUserId);
  if (member) addToTotals(isIncome ? member.income : member.expense, transaction.currency, amount);
  if (!isIncome) applyToCategorySlices(dashboard, change, amount, before);
}
