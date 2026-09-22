/**
 * Guest-mode goals + contributions repository — the local mirror of
 * `goalsApi`. `currentAmount`/`remaining`/`progressPercentage` are derived
 * via `calc.ts` over the local contribution list (never stored, mirroring
 * `goals.service.ts`); adding a contribution with `recordAsTransaction`
 * inserts a `GuestTransaction` directly (mirrors `goal-contributions.service.ts`'s
 * single DB transaction) rather than calling through `guestTransactionsApi`,
 * since the server does the same direct insert rather than calling its own
 * create endpoint.
 */

import {
  calculateGoalCurrent,
  calculateGoalProgress,
  calculateGoalRemaining,
  createContributionSchema,
  createGoalSchema,
  formatMoney,
  parseMoney,
  updateGoalSchema,
  GoalStatus,
  CategoryType,
  TransactionType,
  TransactionStatus,
  type ContributionResponse,
  type CreateContributionRequest,
  type CreateGoalRequest,
  type GoalResponse,
  type UpdateGoalRequest,
} from '@sora/contracts';

import { fromZodError, guestError } from './guestErrors.ts';
import { newLocalId } from './guestIds.ts';
import { guestStore } from './guestStorage.ts';
import {
  type GuestContribution,
  type GuestGoal,
  type GuestTransaction,
  type GuestWallet,
} from './guestStore.ts';

export interface GoalListQuery {
  walletId: string;
  status?: GoalStatus | undefined;
}

function requireWallet(): GuestWallet {
  const wallet = guestStore.current().wallet;
  if (!wallet) throw guestError('WALLET_NOT_FOUND');
  return wallet;
}

function findGoal(goals: readonly GuestGoal[], goalId: string): GuestGoal {
  const goal = goals.find((candidate) => candidate.id === goalId);
  if (!goal) throw guestError('GOAL_NOT_FOUND');
  return goal;
}

function toGoalResponse(goal: GuestGoal, contributions: readonly GuestContribution[]): GoalResponse {
  const targetAmount = parseMoney(goal.targetAmount);
  const current = calculateGoalCurrent(contributions.map((contribution) => parseMoney(contribution.amount)));
  const remaining = calculateGoalRemaining(targetAmount, current);

  return {
    id: goal.id,
    walletId: goal.walletId,
    name: goal.name,
    description: goal.description,
    targetAmount: goal.targetAmount,
    currency: goal.currency,
    targetDate: goal.targetDate,
    status: goal.status,
    currentAmount: formatMoney(current),
    remaining: formatMoney(remaining),
    progressPercentage: calculateGoalProgress(targetAmount, current),
    contributionCount: contributions.length,
    createdAt: goal.createdAt,
    updatedAt: goal.updatedAt,
  };
}

function toContributionResponse(contribution: GuestContribution, accountName: string): ContributionResponse {
  return {
    id: contribution.id,
    goalId: contribution.goalId,
    accountId: contribution.accountId,
    accountName,
    transactionId: contribution.transactionId,
    amount: contribution.amount,
    currency: contribution.currency,
    contributionDate: contribution.contributionDate,
    note: contribution.note,
    createdAt: contribution.createdAt,
  };
}

export const guestGoalsApi = {
  async list(query: GoalListQuery): Promise<GoalResponse[]> {
    requireWallet();
    const { goals, contributions } = guestStore.current();

    return goals
      .filter((goal) => !query.status || goal.status === query.status)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((goal) => toGoalResponse(goal, contributions.filter((c) => c.goalId === goal.id)));
  },

  async detail(goalId: string): Promise<GoalResponse> {
    requireWallet();
    const { goals, contributions } = guestStore.current();
    const goal = findGoal(goals, goalId);
    return toGoalResponse(goal, contributions.filter((c) => c.goalId === goalId));
  },

  async create(body: CreateGoalRequest): Promise<GoalResponse> {
    const wallet = requireWallet();
    const parsed = createGoalSchema.safeParse(body);
    if (!parsed.success) throw fromZodError(parsed.error);
    const request = parsed.data;

    const now = new Date().toISOString();
    const goal: GuestGoal = {
      id: newLocalId(),
      walletId: wallet.id,
      name: request.name,
      description: request.description ?? null,
      targetAmount: request.targetAmount,
      currency: request.currency,
      targetDate: request.targetDate ?? null,
      status: GoalStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
    };

    await guestStore.mutate((current) => ({ ...current, goals: [...current.goals, goal] }));
    return toGoalResponse(goal, []);
  },

  /** `currency` is immutable (§13.4) — already true by construction, `updateGoalSchema` has no such field. */
  async update(goalId: string, body: UpdateGoalRequest): Promise<GoalResponse> {
    requireWallet();
    const parsed = updateGoalSchema.safeParse(body);
    if (!parsed.success) throw fromZodError(parsed.error);
    const patch = parsed.data;

    const { goals, contributions } = guestStore.current();
    const existing = findGoal(goals, goalId);

    const updated: GuestGoal = {
      ...existing,
      name: patch.name ?? existing.name,
      description: patch.description !== undefined ? patch.description : existing.description,
      targetAmount: patch.targetAmount ?? existing.targetAmount,
      targetDate: patch.targetDate !== undefined ? patch.targetDate : existing.targetDate,
      status: patch.status ?? existing.status,
      updatedAt: new Date().toISOString(),
    };

    await guestStore.mutate((current) => ({
      ...current,
      goals: current.goals.map((candidate) => (candidate.id === goalId ? updated : candidate)),
    }));

    return toGoalResponse(updated, contributions.filter((c) => c.goalId === goalId));
  },

  /** Cancels the goal; contributions are retained (§13.5) — they record money that really was set aside. */
  async cancel(goalId: string): Promise<void> {
    requireWallet();
    const { goals } = guestStore.current();
    const existing = findGoal(goals, goalId);
    if (existing.status === GoalStatus.CANCELLED) return;

    await guestStore.mutate((current) => ({
      ...current,
      goals: current.goals.map((candidate) =>
        candidate.id === goalId
          ? { ...candidate, status: GoalStatus.CANCELLED, updatedAt: new Date().toISOString() }
          : candidate,
      ),
    }));
  },

  async contributions(goalId: string): Promise<ContributionResponse[]> {
    requireWallet();
    const { goals, contributions, accounts } = guestStore.current();
    findGoal(goals, goalId);

    return contributions
      .filter((contribution) => contribution.goalId === goalId)
      .sort((a, b) => b.contributionDate.localeCompare(a.contributionDate))
      .map((contribution) => {
        const account = accounts.find((candidate) => candidate.id === contribution.accountId);
        return toContributionResponse(contribution, account?.name ?? '');
      });
  },

  async addContribution(goalId: string, body: CreateContributionRequest): Promise<ContributionResponse> {
    requireWallet();
    const parsed = createContributionSchema.safeParse(body);
    if (!parsed.success) throw fromZodError(parsed.error);
    const request = parsed.data;

    const { goals, accounts, categories } = guestStore.current();
    const goal = findGoal(goals, goalId);
    if (goal.status !== GoalStatus.ACTIVE) throw guestError('GOAL_NOT_ACTIVE');

    const account = accounts.find((candidate) => candidate.id === request.accountId);
    if (!account) throw guestError('ACCOUNT_NOT_FOUND');
    if (request.currency !== goal.currency || request.currency !== account.currency) {
      throw guestError('ACCOUNT_CURRENCY_MISMATCH');
    }

    if (request.recordAsTransaction) {
      if (!request.categoryId) {
        throw guestError('VALIDATION_FAILED', { categoryId: ['Required when recording as a transaction'] });
      }
      const category = categories.find((candidate) => candidate.id === request.categoryId);
      if (!category || category.walletId !== goal.walletId || category.type !== CategoryType.EXPENSE) {
        throw guestError('VALIDATION_FAILED', {
          categoryId: ['Must be an EXPENSE category belonging to this wallet'],
        });
      }
    }

    const now = new Date().toISOString();
    let transaction: GuestTransaction | null = null;

    if (request.recordAsTransaction) {
      transaction = {
        id: newLocalId(),
        type: TransactionType.EXPENSE,
        status: TransactionStatus.COMPLETED,
        amount: request.amount,
        currency: request.currency,
        description: `Contribution to ${goal.name}`,
        transactionDate: request.contributionDate,
        reference: null,
        fromAccountId: request.accountId,
        toAccountId: null,
        categoryId: request.categoryId!,
        createdAt: now,
        updatedAt: now,
      };
    }

    const contribution: GuestContribution = {
      id: newLocalId(),
      goalId,
      accountId: request.accountId,
      transactionId: transaction?.id ?? null,
      amount: request.amount,
      currency: request.currency,
      contributionDate: request.contributionDate,
      note: request.note ?? null,
      createdAt: now,
    };

    await guestStore.mutate((current) => ({
      ...current,
      transactions: transaction ? [...current.transactions, transaction] : current.transactions,
      contributions: [...current.contributions, contribution],
    }));

    return toContributionResponse(contribution, account.name);
  },

  /** Removes the contribution row outright; a transaction-backed one only flips its backing
   * transaction's status to deleted — the transaction row itself is never removed (§13.8). */
  async removeContribution(goalId: string, contributionId: string): Promise<void> {
    requireWallet();
    const { goals, contributions } = guestStore.current();
    findGoal(goals, goalId);

    const contribution = contributions.find(
      (candidate) => candidate.id === contributionId && candidate.goalId === goalId,
    );
    if (!contribution) throw guestError('CONTRIBUTION_NOT_FOUND');

    await guestStore.mutate((current) => ({
      ...current,
      contributions: current.contributions.filter((candidate) => candidate.id !== contributionId),
      transactions: contribution.transactionId
        ? current.transactions.map((candidate) =>
            candidate.id === contribution.transactionId
              ? { ...candidate, status: TransactionStatus.DELETED, updatedAt: new Date().toISOString() }
              : candidate,
          )
        : current.transactions,
    }));
  },
};
