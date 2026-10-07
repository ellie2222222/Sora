/**
 * Guest-mode budgets repository — the local mirror of `budgetsApi`.
 *
 * `spent`/`remaining`/`usagePercentage`/`isOverBudget` are derived the same
 * way `budgets.service.ts` derives them, via `calc.ts`'s
 * `calculateBudgetSpent`/`calculateBudgetRemaining`/`calculateBudgetUsage`/
 * `isOverBudget` over the local transaction list through `toSpendRelevant`.
 *
 * The overlap rule the server enforces at the database via the
 * `excl_budget_*_overlap` GIST exclusions (same category, goal or wallet-wide target,
 * overlapping inclusive `daterange`, an open end unbounded — db/migrations/001_schema.sql)
 * has no database to enforce it here, so it is checked explicitly in
 * `assertNoOverlap` instead of relying on `translatingPgErrors`.
 */

import {
  budgetWindow,
  calculateBudgetRemaining,
  calculateBudgetSpent,
  categorySubtreeIds,
  calculateBudgetUsage,
  createBudgetSchema,
  formatMoney,
  isOverBudget,
  parseMoney,
  todayIn,
  updateBudgetSchema,
  isBudgetActiveOn,
  GoalStatus,
  CategoryStatus,
  CategoryType,
  type BudgetResponse,
  type CreateBudgetRequest,
  type UpdateBudgetRequest,
} from '@sora/contracts';

import { guestCategoryName } from './guestCategoryName.ts';
import { fromZodError, guestError } from './guestErrors.ts';
import { newLocalId } from './guestIds.ts';
import { guestStore } from './guestStorage.ts';
import { guestTimeZone } from './guestTimeZone.ts';
import { type GuestBudget, type GuestWallet } from './guestStore.ts';
import { toSpendRelevant } from './guestTransactions.ts';

export interface BudgetListQuery {
  walletId: string;
  /** Budgets covering this calendar day (YYYY-MM-DD); also the day each repeating budget's period is taken on. */
  activeOn?: string | undefined;
}

function requireWallet(): GuestWallet {
  const wallet = guestStore.current().wallet;
  if (!wallet) throw guestError('WALLET_NOT_FOUND');
  return wallet;
}

function findBudget(budgets: readonly GuestBudget[], budgetId: string): GuestBudget {
  const budget = budgets.find((candidate) => candidate.id === budgetId);
  if (!budget) throw guestError('BUDGET_NOT_FOUND');
  return budget;
}

/** Inclusive daterange overlap test, mirroring `daterange(start, end, '[]') WITH &&`; a null end is unbounded. */
function rangesOverlap(aStart: string, aEnd: string | null, bStart: string, bEnd: string | null): boolean {
  return (bEnd === null || aStart <= bEnd) && (aEnd === null || bStart <= aEnd);
}

/** Same kind and target (API spec §12.2): one category, one goal, or the wallet as a whole. */
function sameTarget(budget: GuestBudget, categoryId: string | null, goalId: string | null): boolean {
  return budget.categoryId === categoryId && budget.goalId === goalId;
}

function assertNoOverlap(
  budgets: readonly GuestBudget[],
  categoryId: string | null,
  goalId: string | null,
  startDate: string,
  endDate: string | null,
): void {
  const collides = budgets.some(
    (budget) => sameTarget(budget, categoryId, goalId) && rangesOverlap(budget.startDate, budget.endDate, startDate, endDate),
  );
  if (collides) throw guestError('BUDGET_PERIOD_OVERLAP');
}

function assertBudgetableGoal(walletId: string, goalId: string | null): void {
  if (!goalId) return;
  const goal = guestStore.current().goals.find((candidate) => candidate.id === goalId);
  if (!goal || goal.walletId !== walletId) throw guestError('GOAL_NOT_FOUND');
  if (goal.status !== GoalStatus.ACTIVE) throw guestError('GOAL_NOT_ACTIVE');
}

function assertBudgetableCategory(walletId: string, categoryId: string | null): void {
  if (!categoryId) return;
  const { categories } = guestStore.current();
  const category = categories.find((candidate) => candidate.id === categoryId);
  if (!category) throw guestError('CATEGORY_NOT_FOUND');
  if (category.walletId !== walletId) throw guestError('CATEGORY_WRONG_WALLET');
  if (category.type !== CategoryType.EXPENSE) throw guestError('CATEGORY_WRONG_TYPE');
  if (category.status === CategoryStatus.ARCHIVED) throw guestError('CATEGORY_ARCHIVED');
}

/** Windows are the guest wallet's calendar days; `day` (default: today there) picks a repeating budget's period. */
function toBudgetResponse(budget: GuestBudget, day?: string): BudgetResponse {
  const { categories, transactions, wallet } = guestStore.current();
  const timeZone = guestTimeZone(wallet);
  day ??= todayIn(timeZone);
  const category = budget.categoryId ? categories.find((candidate) => candidate.id === budget.categoryId) : null;
  const amount = parseMoney(budget.amount);
  const window = budgetWindow(budget, day);
  const categoryIds = budget.categoryId ? categorySubtreeIds(budget.categoryId, categories) : [];
  const spent = calculateBudgetSpent(
    { walletId: budget.walletId, categoryId: budget.categoryId, categoryIds, goalId: budget.goalId, currency: budget.currency, ...window, timeZone },
    transactions.map((transaction) => toSpendRelevant(transaction, budget.walletId)),
  );
  const remaining = calculateBudgetRemaining(amount, spent);

  return {
    id: budget.id,
    walletId: budget.walletId,
    name: budget.name,
    amount: budget.amount,
    currency: budget.currency,
    periodType: budget.periodType,
    startDate: budget.startDate,
    endDate: budget.endDate,
    periodStart: window.startDate,
    periodEnd: window.endDate,
    timeZone,
    categoryId: budget.categoryId,
    categoryIds,
    goalId: budget.goalId,
    category: category
      ? { id: category.id, name: guestCategoryName(category), icon: category.icon, color: category.color }
      : budget.categoryId 
        ? { id: budget.categoryId, name: '', icon: null, color: null }
        : null,
    spent: formatMoney(spent),
    remaining: formatMoney(remaining),
    usagePercentage: calculateBudgetUsage(amount, spent),
    isOverBudget: isOverBudget(amount, spent),
    createdAt: budget.createdAt,
    updatedAt: budget.updatedAt,
  };
}

export const guestBudgetsApi = {
  async list(query: BudgetListQuery): Promise<BudgetResponse[]> {
    const wallet = requireWallet();
    const { budgets } = guestStore.current();

    const day = query.activeOn ?? todayIn(guestTimeZone(wallet));
    return budgets
      .filter((budget) => query.activeOn === undefined || isBudgetActiveOn(budget, query.activeOn))
      .map((budget) => toBudgetResponse(budget, day));
  },

  async detail(budgetId: string): Promise<BudgetResponse> {
    requireWallet();
    const { budgets } = guestStore.current();
    return toBudgetResponse(findBudget(budgets, budgetId));
  },

  async create(body: CreateBudgetRequest): Promise<BudgetResponse> {
    const wallet = requireWallet();
    const parsed = createBudgetSchema.safeParse(body);
    if (!parsed.success) throw fromZodError(parsed.error);
    const request = parsed.data;

    assertBudgetableCategory(wallet.id, request.categoryId ?? null);
    assertBudgetableGoal(wallet.id, request.goalId ?? null);
    const { budgets } = guestStore.current();
    assertNoOverlap(budgets, request.categoryId ?? null, request.goalId ?? null, request.startDate, request.endDate ?? null);

    const now = new Date().toISOString();
    const budget: GuestBudget = {
      id: newLocalId(),
      walletId: wallet.id,
      categoryId: request.categoryId ?? null,
      goalId: request.goalId ?? null,
      name: request.name,
      amount: request.amount,
      currency: request.currency,
      periodType: request.periodType,
      startDate: request.startDate,
      endDate: request.endDate ?? null,
      createdAt: now,
      updatedAt: now,
    };

    await guestStore.mutate((current) => ({ ...current, budgets: [...current.budgets, budget] }));
    return toBudgetResponse(budget);
  },

  async update(budgetId: string, body: UpdateBudgetRequest): Promise<BudgetResponse> {
    requireWallet();
    const parsed = updateBudgetSchema.safeParse(body);
    if (!parsed.success) throw fromZodError(parsed.error);
    const patch = parsed.data;

    const { budgets } = guestStore.current();
    const existing = findBudget(budgets, budgetId);

    const updated: GuestBudget = {
      ...existing,
      name: patch.name ?? existing.name,
      amount: patch.amount ?? existing.amount,
      updatedAt: new Date().toISOString(),
    };

    await guestStore.mutate((current) => ({
      ...current,
      budgets: current.budgets.map((candidate) => (candidate.id === budgetId ? updated : candidate)),
    }));

    return toBudgetResponse(updated);
  },

  /** Removes the budget, freeing its slot for `assertNoOverlap` (mirrors §12.5). */
  async delete(budgetId: string): Promise<void> {
    requireWallet();
    findBudget(guestStore.current().budgets, budgetId);
    await guestStore.mutate((current) => ({
      ...current,
      budgets: current.budgets.filter((candidate) => candidate.id !== budgetId),
    }));
  },
};
