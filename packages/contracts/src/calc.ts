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
import { TransactionStatus, TransactionType } from './enums.ts';

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
  goalId: string | null;
  currency: string;
  startDate: string;
  endDate: string;
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

export type BudgetTarget = Pick<BudgetSpendInput, 'walletId' | 'categoryId' | 'goalId'>;

/** Whether an expense falls under a budget's target, whatever its date, status or currency. */
export function isBudgetTarget(
  budget: BudgetTarget,
  transaction: Pick<SpendRelevantTransaction, 'categoryId' | 'goalId' | 'walletId'>,
): boolean {
  if (budget.goalId != null) return transaction.goalId === budget.goalId;
  if (budget.categoryId != null) return transaction.categoryId === budget.categoryId;
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
    if (!isWithinPeriod(transaction.transactionDate, budget.startDate, budget.endDate)) continue;
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
): boolean {
  if (transaction.status !== TransactionStatus.COMPLETED) return false;
  if (transaction.type !== TransactionType.INCOME && transaction.type !== TransactionType.EXPENSE) {
    return false;
  }
  return isWithinPeriod(transaction.transactionDate, dateFrom, dateTo);
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
 * Inclusive date-window test.
 *
 * Compares calendar days, not instants: a budget runs to the end of its
 * end_date, so an expense stamped 2026-08-31T23:30:00Z belongs to an August
 * budget even though the instant is after 2026-08-31T00:00:00Z.
 */
export function isWithinPeriod(
  transactionDate: string,
  startDate: string,
  endDate: string,
): boolean {
  const day = calendarDay(transactionDate);
  return day >= calendarDay(startDate) && day <= calendarDay(endDate);
}

function calendarDay(value: string): string {
  return value.slice(0, 10);
}
