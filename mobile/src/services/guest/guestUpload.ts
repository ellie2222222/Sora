/**
 * The guest → real-account upload sequencer.
 *
 * Fixed order, FK-driven: categories → accounts → transactions → budgets →
 * goals (created ACTIVE) → goal contributions → goal status transition →
 * archive whatever was locally archived. The server never accepts a
 * client-supplied `id`, so every phase builds a local-id → server-id map as
 * it goes, persisted in `guestStore`'s `uploadProgress` — a retry after an
 * app kill re-reads those maps and skips whatever already has an entry,
 * rather than re-uploading it.
 *
 * A contribution's backing transaction (`GuestContribution.transactionId`
 * set) is uploaded exclusively through `goalsApi.addContribution({
 * recordAsTransaction: true, ... })` in the goal-contributions phase, never
 * through the general transactions phase — the server already creates both
 * rows together in one DB transaction for that call, and uploading the flat
 * transaction separately as well would record the same money twice.
 */

import {
  CategoryStatus,
  AccountStatus,
  BudgetStatus,
  GoalStatus,
  TransactionType,
  type CategoryResponse,
  type CategoryType,
  type CreateContributionRequest,
  type CreateTransactionRequest,
} from '@sora/contracts';

// Type-only, so this module stays importable without React Native in the
// graph: the real api modules reach axios, expo-secure-store and eventually
// react-native's own Flow-typed entry, which bare `node --test` cannot parse.
// The values are pulled in on demand by `defaultApis()` below.
import type { accountsApi, budgetsApi, categoriesApi, goalsApi, transactionsApi } from '@/services/api';
// Relative, not `@/utils`: same bare-`node --test` constraint as the type-only
// import above — no path-alias resolution at runtime outside the bundler.
import { isApiError } from '../../utils/errors.ts';
import { newLocalId } from './guestIds.ts';
import { guestStore } from './guestStorage.ts';
import {
  emptyUploadProgress,
  type GuestCategory,
  type GuestData,
  type GuestTransaction,
  type GuestUploadProgress,
} from './guestStore.ts';

type MapField = 'categoryMap' | 'accountMap' | 'transactionMap' | 'budgetMap' | 'goalMap' | 'contributionMap';
type KeyField = 'transactionKeys' | 'contributionKeys';

/**
 * Only the methods the sequencer calls, injected rather than imported at the
 * call sites so a test can drive the whole order — remapped ids, category
 * dedup, resume-after-failure, idempotency-key reuse — without HTTP. The
 * default is the real API, so no caller passes anything.
 */
export interface UploadApis {
  categories: Pick<typeof categoriesApi, 'list' | 'create' | 'archive'>;
  accounts: Pick<typeof accountsApi, 'create' | 'archive'>;
  transactions: Pick<typeof transactionsApi, 'create'>;
  budgets: Pick<typeof budgetsApi, 'create' | 'archive'>;
  goals: Pick<typeof goalsApi, 'create' | 'addContribution' | 'cancel' | 'update'>;
}

async function defaultApis(): Promise<UploadApis> {
  const [accounts, budgets, categories, goals, transactions] = await Promise.all([
    import('../api/accounts.ts'),
    import('../api/budgets.ts'),
    import('../api/categories.ts'),
    import('../api/goals.ts'),
    import('../api/transactions.ts'),
  ]);

  return {
    categories: categories.categoriesApi,
    accounts: accounts.accountsApi,
    transactions: transactions.transactionsApi,
    budgets: budgets.budgetsApi,
    goals: goals.goalsApi,
  };
}

function progressOf(data: GuestData): GuestUploadProgress {
  if (!data.uploadProgress) throw new Error('uploadGuestData: progress not initialized');
  return data.uploadProgress;
}

async function recordMap(field: MapField, localId: string, serverId: string): Promise<void> {
  await guestStore.mutate((current) => {
    if (!current.uploadProgress) return current;
    return {
      ...current,
      uploadProgress: { ...current.uploadProgress, [field]: { ...current.uploadProgress[field], [localId]: serverId } },
    };
  });
}

/** Pins one idempotency key per local id, reused on every retry. */
async function ensureKey(field: KeyField, localId: string): Promise<string> {
  const existing = progressOf(guestStore.current())[field][localId];
  if (existing) return existing;

  const key = newLocalId();
  await guestStore.mutate((current) => {
    if (!current.uploadProgress) return current;
    return { ...current, uploadProgress: { ...current.uploadProgress, [field]: { ...current.uploadProgress[field], [localId]: key } } };
  });
  return key;
}

function typeSuffix(type: CategoryType): string {
  return type.charAt(0) + type.slice(1).toLowerCase();
}

/**
 * Match-or-create against the target wallet's existing categories, so a
 * freshly seeded wallet, a customized login-target wallet, and a
 * renamed-starter-category guest are all handled by one rule.
 */
async function uploadCategories(walletId: string, apis: UploadApis): Promise<void> {
  const progress = progressOf(guestStore.current());
  const { categories } = guestStore.current();
  const pending = categories.filter((category) => !(category.id in progress.categoryMap));
  if (pending.length === 0) return;

  const serverCategories = await apis.categories.list({ walletId });

  // Arbitrary-depth parent chains: repeat until a pass maps nothing further —
  // categories are acyclic (assertNoCycle), so this always terminates.
  let remaining = pending;
  while (remaining.length > 0) {
    const stillPending: GuestCategory[] = [];

    for (const category of remaining) {
      const mappedParentId = category.parentId ? progressOf(guestStore.current()).categoryMap[category.parentId] : null;
      if (category.parentId && !mappedParentId) {
        stillPending.push(category);
        continue;
      }

      const siblingNamed = (candidate: CategoryResponse, name: string) =>
        (candidate.parentId ?? null) === (mappedParentId ?? null) &&
        candidate.name.toLowerCase() === name.toLowerCase();

      let name = category.name;
      let match = serverCategories.find((candidate) => candidate.type === category.type && siblingNamed(candidate, name));
      // uq_category_name_per_parent ignores type, so a same-named category of another type would make create 409.
      if (!match && serverCategories.some((candidate) => siblingNamed(candidate, name))) {
        name = `${category.name} (${typeSuffix(category.type)})`;
        match = serverCategories.find((candidate) => candidate.type === category.type && siblingNamed(candidate, name));
      }

      const serverId = match
        ? match.id
        : (
            await apis.categories.create({
              walletId,
              parentId: mappedParentId ?? undefined,
              name,
              type: category.type,
              icon: category.icon ?? undefined,
              color: category.color ?? undefined,
            })
          ).id;

      if (!match) {
        serverCategories.push({
          id: serverId,
          walletId,
          parentId: mappedParentId ?? null,
          name,
          type: category.type,
          icon: category.icon,
          color: category.color,
          status: CategoryStatus.ACTIVE,
          transactionCount: 0,
        });
      }

      await recordMap('categoryMap', category.id, serverId);
    }

    if (stillPending.length === remaining.length) {
      throw new Error('uploadGuestData: category parent chain never resolved');
    }
    remaining = stillPending;
  }
}

async function uploadAccounts(walletId: string, apis: UploadApis): Promise<void> {
  const { accounts } = guestStore.current();

  for (const account of accounts) {
    if (account.id in progressOf(guestStore.current()).accountMap) continue;

    const response = await apis.accounts.create({
      walletId,
      name: account.name,
      type: account.type,
      currency: account.currency,
      initialBalance: account.initialBalance,
    });
    await recordMap('accountMap', account.id, response.id);
  }
}

function buildTransactionRequest(
  transaction: GuestTransaction,
  progress: GuestUploadProgress,
): CreateTransactionRequest {
  const common = {
    amount: transaction.amount,
    currency: transaction.currency,
    description: transaction.description ?? undefined,
    transactionDate: transaction.transactionDate,
    status: transaction.status,
    reference: transaction.reference ?? undefined,
  };

  if (transaction.type === TransactionType.INCOME) {
    return {
      ...common,
      type: TransactionType.INCOME,
      toAccountId: progress.accountMap[transaction.toAccountId!]!,
      categoryId: progress.categoryMap[transaction.categoryId!]!,
    };
  }
  if (transaction.type === TransactionType.EXPENSE) {
    return {
      ...common,
      type: TransactionType.EXPENSE,
      fromAccountId: progress.accountMap[transaction.fromAccountId!]!,
      categoryId: progress.categoryMap[transaction.categoryId!]!,
    };
  }
  return {
    ...common,
    type: TransactionType.TRANSFER,
    fromAccountId: progress.accountMap[transaction.fromAccountId!]!,
    toAccountId: progress.accountMap[transaction.toAccountId!]!,
    categoryId: transaction.categoryId ? progress.categoryMap[transaction.categoryId]! : null,
  };
}

async function uploadTransactions(apis: UploadApis): Promise<void> {
  const { transactions, contributions } = guestStore.current();
  // Uploaded exclusively via the goal-contributions phase (see file header).
  const contributionBackedIds = new Set(
    contributions.map((contribution) => contribution.transactionId).filter((id): id is string => id !== null),
  );

  for (const transaction of transactions) {
    if (contributionBackedIds.has(transaction.id)) continue;
    if (transaction.id in progressOf(guestStore.current()).transactionMap) continue;

    const progress = progressOf(guestStore.current());
    const key = await ensureKey('transactionKeys', transaction.id);
    const response = await apis.transactions.create(buildTransactionRequest(transaction, progress), key);
    await recordMap('transactionMap', transaction.id, response.id);
  }
}

async function uploadBudgets(walletId: string, apis: UploadApis): Promise<void> {
  const { budgets } = guestStore.current();

  for (const budget of budgets) {
    if (budget.id in progressOf(guestStore.current()).budgetMap) continue;

    const progress = progressOf(guestStore.current());
    const response = await apis.budgets.create({
      walletId,
      categoryId: progress.categoryMap[budget.categoryId]!,
      name: budget.name,
      amount: budget.amount,
      currency: budget.currency,
      periodType: budget.periodType,
      startDate: budget.startDate,
      endDate: budget.endDate,
    });
    await recordMap('budgetMap', budget.id, response.id);
  }
}

async function uploadGoals(walletId: string, apis: UploadApis): Promise<void> {
  const { goals } = guestStore.current();

  // Phase 1: create every goal ACTIVE — contributions need GOAL_NOT_ACTIVE
  // to not have fired yet, so status transitions wait until phase 3.
  for (const goal of goals) {
    if (goal.id in progressOf(guestStore.current()).goalMap) continue;

    const response = await apis.goals.create({
      walletId,
      name: goal.name,
      description: goal.description ?? undefined,
      targetAmount: goal.targetAmount,
      currency: goal.currency,
      targetDate: goal.targetDate ?? undefined,
    });
    await recordMap('goalMap', goal.id, response.id);
  }

  // Phase 2: every contribution.
  const { contributions, transactions } = guestStore.current();
  for (const contribution of contributions) {
    if (contribution.id in progressOf(guestStore.current()).contributionMap) continue;

    const progress = progressOf(guestStore.current());
    const mappedGoalId = progress.goalMap[contribution.goalId]!;
    const mappedAccountId = progress.accountMap[contribution.accountId]!;
    const key = await ensureKey('contributionKeys', contribution.id);

    const backingTransaction = contribution.transactionId
      ? transactions.find((candidate) => candidate.id === contribution.transactionId)
      : undefined;

    const body: CreateContributionRequest = backingTransaction
      ? {
          accountId: mappedAccountId,
          amount: contribution.amount,
          currency: contribution.currency,
          contributionDate: contribution.contributionDate,
          note: contribution.note ?? undefined,
          recordAsTransaction: true,
          categoryId: progress.categoryMap[backingTransaction.categoryId!]!,
        }
      : {
          accountId: mappedAccountId,
          amount: contribution.amount,
          currency: contribution.currency,
          contributionDate: contribution.contributionDate,
          note: contribution.note ?? undefined,
          recordAsTransaction: false,
        };

    const response = await apis.goals.addContribution(mappedGoalId, body, key);
    await recordMap('contributionMap', contribution.id, response.id);
    if (backingTransaction && response.transactionId) {
      await recordMap('transactionMap', backingTransaction.id, response.transactionId);
    }
  }

  // Phase 3: status transitions, now that every contribution has landed.
  for (const goal of goals) {
    if (goal.status === GoalStatus.ACTIVE) continue;
    const mappedGoalId = progressOf(guestStore.current()).goalMap[goal.id]!;

    if (goal.status === GoalStatus.CANCELLED) await apis.goals.cancel(mappedGoalId);
    else await apis.goals.update(mappedGoalId, { status: GoalStatus.COMPLETED });
  }
}

/**
 * Archives are last and in this order — budgets before categories, so a
 * category's active-budget check (CATEGORY_IN_USE) never fires against a
 * budget this same run is about to archive anyway.
 */
async function archiveLocallyArchived(apis: UploadApis): Promise<void> {
  const { budgets, categories, accounts, uploadProgress } = guestStore.current();
  const progress = uploadProgress!;

  for (const budget of budgets) {
    if (budget.status !== BudgetStatus.ARCHIVED) continue;
    await apis.budgets.archive(progress.budgetMap[budget.id]!);
  }

  for (const category of categories) {
    if (category.status !== CategoryStatus.ARCHIVED) continue;
    try {
      await apis.categories.archive(progress.categoryMap[category.id]!);
    } catch (error) {
      if (!isApiError(error) || error.code !== 'CATEGORY_IN_USE') throw error;
    }
  }

  for (const account of accounts) {
    if (account.status !== AccountStatus.ARCHIVED) continue;
    try {
      await apis.accounts.archive(progress.accountMap[account.id]!);
    } catch (error) {
      if (!isApiError(error) || error.code !== 'ACCOUNT_LAST_ACTIVE') throw error;
    }
  }
}

export type UploadPhase = 'categories' | 'accounts' | 'transactions' | 'budgets' | 'goals' | 'contributions' | 'archives';
export type UploadProgressCallback = (phase: UploadPhase, completed: boolean) => void;

/**
 * Uploads every locally-tracked record into `walletId`. Safe to call again
 * after a partial failure or an app kill — each phase skips whatever its
 * `uploadProgress` map already covers.
 */
export async function uploadGuestData(
  walletId: string,
  injectedApis?: UploadApis,
  onProgress?: UploadProgressCallback,
): Promise<void> {
  const data = guestStore.current();
  if (!data.wallet) return;

  const apis = injectedApis ?? (await defaultApis());

  if (!data.uploadProgress || data.uploadProgress.walletId !== walletId) {
    await guestStore.mutate((current) => ({ ...current, uploadProgress: emptyUploadProgress(walletId) }));
  }

  onProgress?.('categories', false);
  await uploadCategories(walletId, apis);
  onProgress?.('categories', true);

  onProgress?.('accounts', false);
  await uploadAccounts(walletId, apis);
  onProgress?.('accounts', true);

  onProgress?.('transactions', false);
  await uploadTransactions(apis);
  onProgress?.('transactions', true);

  onProgress?.('budgets', false);
  await uploadBudgets(walletId, apis);
  onProgress?.('budgets', true);

  onProgress?.('goals', false);
  await uploadGoals(walletId, apis);
  onProgress?.('goals', true);

  onProgress?.('archives', false);
  await archiveLocallyArchived(apis);
  onProgress?.('archives', true);
}

