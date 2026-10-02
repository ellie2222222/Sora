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
 * overlapping inclusive `daterange`, ACTIVE only — db/migrations/008_redesign_budgets.sql)
 * has no database to enforce it here, so it is checked explicitly in
 * `assertNoOverlap` instead of relying on `translatingPgErrors`.
 */

import {
  calculateBudgetRemaining,
  calculateBudgetSpent,
  calculateBudgetUsage,
  createBudgetSchema,
  formatMoney,
  isOverBudget,
  parseMoney,
  updateBudgetSchema,
  BudgetStatus,
  GoalStatus,
  CategoryType,
  type BudgetResponse,
  type CreateBudgetRequest,
  type UpdateBudgetRequest,
} from '@sora/contracts';

import { fromZodError, guestError } from './guestErrors.ts';
import { newLocalId } from './guestIds.ts';
import { guestStore } from './guestStorage.ts';
import { type GuestBudget, type GuestWallet } from './guestStore.ts';
import { toSpendRelevant } from './guestTransactions.ts';

export interface BudgetListQuery {
  walletId: string;
  status?: BudgetStatus | undefined;
  /** Budgets whose window contains this calendar day (YYYY-MM-DD). */
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

/** Inclusive daterange overlap test, mirroring `daterange(start, end, '[]') WITH &&`. */
function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd;
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
  endDate: string,
  excludingBudgetId?: string,
): void {
  const collides = budgets.some(
    (budget) =>
      budget.id !== excludingBudgetId &&
      sameTarget(budget, categoryId, goalId) &&
      budget.status === BudgetStatus.ACTIVE &&
      rangesOverlap(budget.startDate, budget.endDate, startDate, endDate),
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
}

function toBudgetResponse(budget: GuestBudget): BudgetResponse {
  const { categories, transactions } = guestStore.current();
  const category = budget.categoryId ? categories.find((candidate) => candidate.id === budget.categoryId) : null;
  const amount = parseMoney(budget.amount);
  const spent = calculateBudgetSpent(
    {
      walletId: budget.walletId,
      categoryId: budget.categoryId,
      goalId: budget.goalId,
      currency: budget.currency,
      startDate: budget.startDate,
      endDate: budget.endDate,
    },
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
    status: budget.status,
    categoryId: budget.categoryId,
    goalId: budget.goalId,
    category: category
      ? { id: category.id, name: category.name, icon: category.icon, color: category.color }
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
    requireWallet();
    const { budgets } = guestStore.current();

    return budgets
      .filter((budget) => !query.status || budget.status === query.status)
      .filter((budget) => !query.activeOn || (budget.startDate <= query.activeOn && budget.endDate >= query.activeOn))
      .map(toBudgetResponse);
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
    assertNoOverlap(budgets, request.categoryId ?? null, request.goalId ?? null, request.startDate, request.endDate);

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
      endDate: request.endDate,
      status: BudgetStatus.ACTIVE,
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
      status: patch.status ?? existing.status,
      updatedAt: new Date().toISOString(),
    };

    await guestStore.mutate((current) => ({
      ...current,
      budgets: current.budgets.map((candidate) => (candidate.id === budgetId ? updated : candidate)),
    }));

    return toBudgetResponse(updated);
  },

  /** Archives, which also frees its slot for `assertNoOverlap` (mirrors §12.5). */
  async archive(budgetId: string): Promise<void> {
    requireWallet();
    const { budgets } = guestStore.current();
    const existing = findBudget(budgets, budgetId);
    if (existing.status === BudgetStatus.ARCHIVED) return;

    await guestStore.mutate((current) => ({
      ...current,
      budgets: current.budgets.map((candidate) =>
        candidate.id === budgetId
          ? { ...candidate, status: BudgetStatus.ARCHIVED, updatedAt: new Date().toISOString() }
          : candidate,
      ),
    }));
  },
};
