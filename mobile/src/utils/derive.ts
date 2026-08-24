/**
 * Optimistic derivations.
 *
 * The API serves every balance, budget `spent` and goal progress already
 * derived, so these run only in the window between a mutation succeeding and its
 * refetch landing. They call the shared functions in `@finance/contracts` rather
 * than re-deriving anything, because a locally-invented rule that disagrees with
 * the server produces a figure that flickers to a different number a moment
 * later — the exact bug the shared math exists to prevent.
 */

import {
  affectsBalance,
  calculateAccountBalance,
  calculateBudgetSpent,
  calculateGoalCurrent,
  calculateGoalProgress,
  calculateGoalRemaining,
  formatMoney,
  parseMoney,
  add,
  type AccountResponse,
  type BalanceRelevantTransaction,
  type BudgetResponse,
  type ContributionResponse,
  type GoalResponse,
  type Scaled,
  type SpendRelevantTransaction,
  type TransactionResponse,
} from '@finance/contracts';

export function toBalanceRelevant(transaction: TransactionResponse): BalanceRelevantTransaction {
  return {
    type: transaction.type,
    status: transaction.status,
    amount: parseMoney(transaction.amount),
    fromAccountId: transaction.fromAccount?.id ?? null,
    toAccountId: transaction.toAccount?.id ?? null,
  };
}

export function toSpendRelevant(transaction: TransactionResponse): SpendRelevantTransaction {
  return {
    type: transaction.type,
    status: transaction.status,
    amount: parseMoney(transaction.amount),
    categoryId: transaction.category?.id ?? null,
    transactionDate: transaction.transactionDate,
  };
}

/**
 * Fold one new transaction into an account's already-derived balance.
 *
 * The server's `balance` stands in for the initial balance here: it already
 * includes every earlier transaction, so replaying only the new one is both
 * correct and cheap. Accounts the transaction does not name come back unchanged,
 * which is what makes this safe to map over a whole list.
 */
export function applyTransactionToAccount(
  account: AccountResponse,
  transaction: TransactionResponse,
): AccountResponse {
  const relevant = toBalanceRelevant(transaction);
  if (relevant.fromAccountId !== account.id && relevant.toAccountId !== account.id) {
    return account;
  }
  const next = calculateAccountBalance(parseMoney(account.balance), [relevant], account.id);
  return { ...account, balance: formatMoney(next) };
}

export function applyTransactionToAccounts(
  accounts: readonly AccountResponse[],
  transaction: TransactionResponse,
): AccountResponse[] {
  return accounts.map((account) => applyTransactionToAccount(account, transaction));
}

/**
 * Fold one new transaction into a budget's `spent`.
 *
 * `calculateBudgetSpent` decides on its own whether the transaction counts — a
 * TRANSFER, a cancelled row, a different category or a date outside the window
 * all contribute zero — so the caller never restates the "a transfer is not
 * spending" rule.
 */
export function applyTransactionToBudget(
  budget: BudgetResponse,
  transaction: TransactionResponse,
): BudgetResponse {
  const delta = calculateBudgetSpent(
    { categoryId: budget.category.id, startDate: budget.startDate, endDate: budget.endDate },
    [toSpendRelevant(transaction)],
  );
  if (delta === 0n) return budget;

  const amount = parseMoney(budget.amount);
  const spent = add(parseMoney(budget.spent), delta);
  return {
    ...budget,
    spent: formatMoney(spent),
    remaining: formatMoney(amount - spent),
    usagePercentage: percentage(spent, amount),
    isOverBudget: spent > amount,
  };
}

export function applyTransactionToBudgets(
  budgets: readonly BudgetResponse[],
  transaction: TransactionResponse,
): BudgetResponse[] {
  return budgets.map((budget) => applyTransactionToBudget(budget, transaction));
}

function percentage(part: Scaled, whole: Scaled): number {
  if (whole === 0n) return 0;
  return Number((part * 1000n) / whole) / 10;
}

/** Goal progress recomputed from the contribution history the screen holds. */
export function goalProgressFrom(
  goal: GoalResponse,
  contributions: readonly ContributionResponse[],
): { current: Scaled; remaining: Scaled; percentage: number } {
  const target = parseMoney(goal.targetAmount);
  const current = calculateGoalCurrent(contributions.map((item) => parseMoney(item.amount)));
  return {
    current,
    remaining: calculateGoalRemaining(target, current),
    percentage: calculateGoalProgress(target, current),
  };
}

export function applyContributionToGoal(
  goal: GoalResponse,
  contribution: ContributionResponse,
): GoalResponse {
  const target = parseMoney(goal.targetAmount);
  const current = add(parseMoney(goal.currentAmount), parseMoney(contribution.amount));
  return {
    ...goal,
    currentAmount: formatMoney(current),
    remaining: formatMoney(calculateGoalRemaining(target, current)),
    progressPercentage: calculateGoalProgress(target, current),
    contributionCount: goal.contributionCount + 1,
  };
}

export interface PeriodTotals {
  income: Scaled;
  expense: Scaled;
  net: Scaled;
  transferred: Scaled;
}

/**
 * Income, expense and transfers over a loaded page of transactions.
 *
 * Transfers are counted into their own bucket and into neither of the other two.
 * `affectsBalance` decides what counts at all, so a PENDING or CANCELLED row is
 * excluded here on exactly the same test the server applies.
 */
export function periodTotals(transactions: readonly TransactionResponse[]): PeriodTotals {
  let income = 0n;
  let expense = 0n;
  let transferred = 0n;

  for (const transaction of transactions) {
    if (!affectsBalance(transaction)) continue;
    const amount = parseMoney(transaction.amount);
    if (transaction.type === 'INCOME') income += amount;
    else if (transaction.type === 'EXPENSE') expense += amount;
    else transferred += amount;
  }

  return { income, expense, net: income - expense, transferred };
}
