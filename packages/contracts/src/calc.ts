/**
 * Derived financial values.
 *
 * Balances, budget usage and goal progress are never stored — they are computed
 * from transaction and contribution history, which is the only record that
 * cannot silently disagree with itself. These functions are the single
 * implementation, shared by the API (which serves them) and the app (which shows
 * optimistic values before a refetch lands), so the two can never round or
 * classify differently.
 */

import {
  type Scaled,
  add,
  clampPercentage,
  maxOf,
  percentageOf,
  subtract,
  ZERO,
} from './money.ts';
import { isRepeatingBudgetPeriod, TransactionStatus, TransactionType, type BudgetPeriodType } from './enums.ts';
import { dayOfInstant } from './calendar.ts';

/** The minimum a balance calculation needs to know about a transaction. */
export interface BalanceRelevantTransaction {
  type: TransactionType;
  status: TransactionStatus;
  amount: Scaled;
  fromAccountId: string | null;
  toAccountId: string | null;
}

/**
 * Only COMPLETED transactions move a balance. A PENDING transaction is a record
 * of an intention and a DELETED one is a record of a mistake; counting either
 * would make the app's balance disagree with the bank's.
 */
export function affectsBalance(transaction: { status: TransactionStatus }): boolean {
  return transaction.status === TransactionStatus.COMPLETED;
}

/**
 * initial_balance + money in - money out, over completed transactions only.
 *
 * Direction is read from which side of the transaction names this account, not
 * from the type, so a TRANSFER correctly debits one account and credits the
 * other in a single pass — including when both belong to different wallets.
 */
export function calculateAccountBalance(
  initialBalance: Scaled,
  transactions: readonly BalanceRelevantTransaction[],
  accountId: string,
): Scaled {
  let balance = initialBalance;

  for (const transaction of transactions) {
    if (!affectsBalance(transaction)) continue;
    if (transaction.toAccountId === accountId) balance = add(balance, transaction.amount);
    if (transaction.fromAccountId === accountId) balance = subtract(balance, transaction.amount);
  }

  return balance;
}

/**
 * Callers must pass accounts from ONE wallet and only that wallet's currency:
 * summing a VND account and a USD account produces a number that means nothing.
 * Multi-currency totalling needs conversion and is deliberately not done here.
 */
export function calculateWalletBalance(accountBalances: readonly Scaled[]): Scaled {
  return add(...accountBalances);
}

/**
 * A budget's kind is its target: a category, a goal, or — naming neither — the whole wallet
 * (API spec §12.2, `chk_budget_kind`). A goal and a category are never both set.
 */
export interface BudgetSpendInput {
  walletId: string;
  categoryId: string | null;
  /** A category budget's category and every subcategory beneath it (`categorySubtreeIds`); empty for the other kinds. */
  categoryIds: readonly string[];
  goalId: string | null;
  currency: string;
  startDate: string;
  endDate: string;
  /** The budget's wallet zone, which decides the calendar day each expense falls on. */
  timeZone: string;
}

export interface SpendRelevantTransaction {
  type: TransactionType;
  status: TransactionStatus;
  amount: Scaled;
  currency: string;
  categoryId: string | null;
  goalId: string | null;
  /** The paying account's wallet, which is what a wallet-wide budget is scoped by. */
  walletId: string | null;
  transactionDate: string;
}

export type BudgetTarget = Pick<BudgetSpendInput, 'walletId' | 'categoryId' | 'categoryIds' | 'goalId'>;

/**
 * A category and all its descendants, so a budget on a parent also counts its subcategories'
 * spending. Visited ids are tracked: the service rejects cycles, but a bad row must not hang a read.
 */
export function categorySubtreeIds(
  rootId: string,
  categories: readonly { id: string; parentId: string | null }[],
): string[] {
  const childrenOf = new Map<string, string[]>();
  for (const category of categories) {
    if (category.parentId === null) continue;
    childrenOf.set(category.parentId, [...(childrenOf.get(category.parentId) ?? []), category.id]);
  }
  const subtree = new Set<string>([rootId]);
  const pending = [rootId];
  while (pending.length > 0) {
    for (const child of childrenOf.get(pending.pop()!) ?? []) {
      if (subtree.has(child)) continue;
      subtree.add(child);
      pending.push(child);
    }
  }
  return [...subtree];
}

/** Whether an expense falls under a budget's target, whatever its date, status or currency. */
export function isBudgetTarget(
  budget: BudgetTarget,
  transaction: Pick<SpendRelevantTransaction, 'categoryId' | 'goalId' | 'walletId'>,
): boolean {
  if (budget.goalId != null) return transaction.goalId === budget.goalId;
  if (budget.categoryId != null) {
    return transaction.categoryId === budget.categoryId
      || (transaction.categoryId !== null && budget.categoryIds.includes(transaction.categoryId));
  }
  return transaction.walletId === budget.walletId;
}

/**
 * TRANSFER is excluded by the type test, which is the whole "a transfer is not
 * spending" rule: moving 2,000,000 from a bank account to cash, or to a
 * partner's wallet, must not consume a food budget — or a wallet-wide one.
 */
export function calculateBudgetSpent(
  budget: BudgetSpendInput,
  transactions: readonly SpendRelevantTransaction[],
): Scaled {
  let spent = ZERO;

  for (const transaction of transactions) {
    if (transaction.type !== TransactionType.EXPENSE) continue;
    if (transaction.status !== TransactionStatus.COMPLETED) continue;
    if (!isBudgetTarget(budget, transaction)) continue;
    // BR-07: a category can hold expenses in several currencies, and summing them is meaningless.
    if (transaction.currency !== budget.currency) continue;
    if (!isWithinPeriod(transaction.transactionDate, budget.startDate, budget.endDate, budget.timeZone)) continue;
    spent = add(spent, transaction.amount);
  }

  return spent;
}

/**
 * Remaining budget, allowed to go negative.
 *
 * Not floored at zero: "you are 400,000 over" is the number a user needs to see,
 * and clamping it to zero hides exactly the situation a budget exists to surface.
 */
export function calculateBudgetRemaining(amount: Scaled, spent: Scaled): Scaled {
  return subtract(amount, spent);
}

/** Budget usage as a percentage, uncapped so an overspend reads above 100. */
export function calculateBudgetUsage(amount: Scaled, spent: Scaled): number {
  return percentageOf(spent, amount);
}

export function isOverBudget(amount: Scaled, spent: Scaled): boolean {
  return spent > amount;
}

/** Goal progress: contributions summed, never a stored running total. */
export function calculateGoalCurrent(contributionAmounts: readonly Scaled[]): Scaled {
  return add(...contributionAmounts);
}

/** Floored at zero — overshooting a savings target does not leave a negative gap. */
export function calculateGoalRemaining(targetAmount: Scaled, current: Scaled): Scaled {
  return maxOf(subtract(targetAmount, current), ZERO);
}

/** Goal progress percentage, capped at 100 so a progress bar cannot overflow. */
export function calculateGoalProgress(targetAmount: Scaled, current: Scaled): number {
  return clampPercentage(percentageOf(current, targetAmount), 100);
}

export function isGoalReached(targetAmount: Scaled, current: Scaled): boolean {
  return current >= targetAmount;
}

export interface PeriodActivityTransaction {
  type: TransactionType;
  status: TransactionStatus;
  transactionDate: string;
}

/**
 * Does this row count toward a period's income/expense figures?
 *
 * BR-06: a TRANSFER is excluded outright rather than netted to zero. Shared so
 * the wallet-level totals and any breakdown of them (by category, by member)
 * are filtered by one predicate — a breakdown computed under a second, subtly
 * different rule would not reconcile against the total it sits under.
 */
export function countsAsPeriodActivity(
  transaction: PeriodActivityTransaction,
  dateFrom: string,
  dateTo: string,
  timeZone: string,
): boolean {
  if (transaction.status !== TransactionStatus.COMPLETED) return false;
  if (transaction.type !== TransactionType.INCOME && transaction.type !== TransactionType.EXPENSE) {
    return false;
  }
  return isWithinPeriod(transaction.transactionDate, dateFrom, dateTo, timeZone);
}

export interface TransferDirectionTransaction {
  type: TransactionType;
  status: TransactionStatus;
  fromAccountId: string | null;
  toAccountId: string | null;
}

/** `IN`/`OUT` across the wallet boundary; `null` for anything that isn't one. */
export type TransferDirection = 'IN' | 'OUT' | null;

/**
 * Which way a completed TRANSFER moved money across one wallet's boundary.
 *
 * A transfer whose two legs are both inside `accountIds` is **internal** and
 * returns `null`: the wallet moved money to itself, so counting it as both in
 * and out would inflate both figures by the same amount and report activity
 * that never crossed the boundary (the same reasoning BR-06 applies to
 * income/expense). Only a cross-wallet transfer (BR-02) has a direction here.
 */
export function transferDirection(
  transaction: TransferDirectionTransaction,
  accountIds: ReadonlySet<string>,
): TransferDirection {
  if (transaction.type !== TransactionType.TRANSFER) return null;
  if (transaction.status !== TransactionStatus.COMPLETED) return null;

  const isIncoming = transaction.toAccountId !== null && accountIds.has(transaction.toAccountId);
  const isOutgoing = transaction.fromAccountId !== null && accountIds.has(transaction.fromAccountId);

  if (isIncoming && isOutgoing) return null;
  if (isIncoming) return 'IN';
  if (isOutgoing) return 'OUT';
  return null;
}

/**
 * Inclusive date-window test, by wallet calendar day.
 *
 * The instant is read in the wallet's zone before it is compared, so an expense at
 * 23:30 local on August 31 belongs to an August budget, and one at 00:30 local on
 * September 1 does not, whatever either is in UTC.
 */
export function isWithinPeriod(
  transactionDate: string,
  startDate: string,
  endDate: string,
  timeZone: string,
): boolean {
  const day = dayOfInstant(transactionDate, timeZone);
  return day >= startDate.slice(0, 10) && day <= endDate.slice(0, 10);
}

export interface BudgetSchedule {
  periodType: BudgetPeriodType;
  startDate: string;
  endDate: string | null;
}

export interface BudgetWindow {
  startDate: string;
  endDate: string;
}

/** Whether a budget covers `day` (YYYY-MM-DD): on or after its start, and before its end if it has one. */
export function isBudgetActiveOn(budget: BudgetSchedule, day: string): boolean {
  return budget.startDate <= day && (budget.endDate === null || budget.endDate >= day);
}

/**
 * The window a budget's `spent` covers on `day`: a fixed budget's own dates, or the period of a repeating one
 * that contains `day` (its first period before it starts). Periods step from the start date, so a monthly
 * budget begun on the 1st follows calendar months; one begun on the 31st starts on the month's last day when it is shorter.
 */
export function budgetWindow(budget: BudgetSchedule, day: string): BudgetWindow {
  if (!isRepeatingBudgetPeriod(budget.periodType) || budget.endDate !== null) {
    return { startDate: budget.startDate, endDate: budget.endDate ?? budget.startDate };
  }
  const start = utcDate(budget.startDate);
  const target = utcDate(day < budget.startDate ? budget.startDate : day);

  switch (budget.periodType) {
    case 'DAILY':
      return { startDate: isoDay(target), endDate: isoDay(target) };
    case 'WEEKLY': {
      const weeks = Math.floor((target.getTime() - start.getTime()) / (7 * DAY_MS));
      const from = addDays(start, weeks * 7);
      return { startDate: isoDay(from), endDate: isoDay(addDays(from, 6)) };
    }
    case 'MONTHLY':
    case 'YEARLY': {
      const step = budget.periodType === 'MONTHLY' ? 1 : 12;
      const months = (target.getUTCFullYear() - start.getUTCFullYear()) * 12 + (target.getUTCMonth() - start.getUTCMonth());
      let index = Math.floor(months / step);
      if (monthsAfter(start, index * step) > target) index -= 1;
      return {
        startDate: isoDay(monthsAfter(start, index * step)),
        endDate: isoDay(addDays(monthsAfter(start, (index + 1) * step), -1)),
      };
    }
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

function utcDate(day: string): Date {
  return new Date(`${day.slice(0, 10)}T00:00:00.000Z`);
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** `start` moved `months` calendar months on, its day clamped to that month's length (Jan 31 → Feb 28). */
function monthsAfter(start: Date, months: number): Date {
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(start.getUTCDate(), lastDay)));
}
