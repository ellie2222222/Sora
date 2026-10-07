/**
 * Builds the record an offline `create` shows immediately, before the sync
 * engine ever reaches the server. Fields the server would normally compute
 * (account balance, budget usage, goal progress, a transaction's resolved
 * account/category refs) are filled from whatever's already cached or with a
 * neutral placeholder — an accepted approximation, not a bug: the pending
 * indicator marks the record as provisional, and the real value
 * lands within one sync pass. RTK Query's cache stays the read path; this
 * never writes anywhere but the optimistic patch itself.
 */

import {
  AccountStatus,
  budgetWindow,
  categorySubtreeIds,
  CategoryStatus,
  createTransactionSchema,
  GoalStatus,
  mergeTransactionUpdate,
  todayIn,
  TransactionType,
  type UpdateTransactionRequest,
  type AccountResponse,
  type BudgetResponse,
  type CategoryResponse,
  type ContributionResponse,
  type CreateContributionRequest,
  type CreateAccountRequest,
  type CreateBudgetRequest,
  type CreateCategoryRequest,
  type CreateGoalRequest,
  type CreateTransactionRequest,
  type GoalResponse,
  type TransactionAccountRef,
  type TransactionResponse,
  type WalletResponse,
} from '@sora/contracts';

import { deviceTimeZone } from '../../utils/date.ts';
import { cachedItems, findCachedById } from './cacheLookup.ts';

const ZERO = '0.0000';

/** A placeholder attribution until the real response names the actual creator. */
const PENDING_CREATED_BY = { id: 'pending', displayName: '' };

function accountRefOf(apiState: unknown, accountId: string): TransactionAccountRef | null {
  const account = findCachedById<AccountResponse & { walletId: string }>(apiState, 'listAccounts', accountId);
  if (!account) return null;
  return {
    id: account.id,
    name: account.name,
    currency: account.currency,
    walletId: account.walletId,
    walletName: '',
  };
}

function categoryRefOf(apiState: unknown, categoryId: string): TransactionResponse['category'] {
  const category = findCachedById<CategoryResponse>(apiState, 'listCategories', categoryId);
  if (!category) return null;
  return { id: category.id, name: category.name, type: category.type, icon: category.icon, color: category.color };
}

/** `transactionId` stays null until sync: the backing transaction, if any, is created server-side. */
export function buildOptimisticContribution(
  goalId: string,
  body: CreateContributionRequest,
  localId: string,
  apiState: unknown,
): ContributionResponse {
  return {
    id: localId,
    goalId,
    accountId: body.accountId,
    accountName: accountRefOf(apiState, body.accountId)?.name ?? '',
    transactionId: null,
    amount: body.amount,
    currency: body.currency,
    contributionDate: body.contributionDate,
    note: body.note ?? null,
    createdAt: new Date().toISOString(),
  };
}

export function buildOptimisticTransaction(
  body: CreateTransactionRequest,
  localId: string,
  apiState: unknown,
): TransactionResponse {
  const fromAccount = 'fromAccountId' in body ? accountRefOf(apiState, body.fromAccountId) : null;
  const toAccount = 'toAccountId' in body ? accountRefOf(apiState, body.toAccountId) : null;
  const category = body.categoryId ? categoryRefOf(apiState, body.categoryId) : null;
  const now = new Date().toISOString();

  return {
    id: localId,
    type: body.type,
    status: body.status,
    amount: body.amount,
    currency: body.currency,
    description: body.description ?? null,
    transactionDate: body.transactionDate,
    reference: body.reference ?? null,
    fromAccount,
    toAccount,
    category,
    goalId: body.goalId ?? null,
    createdBy: PENDING_CREATED_BY,
    isCrossWallet:
      body.type === TransactionType.TRANSFER && !!fromAccount && !!toAccount
        ? fromAccount.walletId !== toAccount.walletId
        : false,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * An offline money edit's record: the edit merged over the cached record exactly as the server merges it,
 * keeping its identity and creator. Null when the merge isn't a valid transaction; the server will say why.
 */
export function buildOptimisticEdit(
  previous: TransactionResponse,
  body: UpdateTransactionRequest,
  apiState: unknown,
): TransactionResponse | null {
  const parsed = createTransactionSchema.safeParse(
    mergeTransactionUpdate(
      {
        type: previous.type,
        amount: previous.amount,
        currency: previous.currency,
        fromAccountId: previous.fromAccount?.id ?? null,
        toAccountId: previous.toAccount?.id ?? null,
        categoryId: previous.category?.id ?? null,
        goalId: previous.goalId,
        description: previous.description,
        transactionDate: previous.transactionDate,
        status: previous.status,
        reference: previous.reference,
      },
      body,
    ),
  );
  if (!parsed.success) return null;
  const next = parsed.data;
  const built = buildOptimisticTransaction(next, previous.id, apiState);
  const sameRef = (accountId: string | undefined, ref: TransactionAccountRef | null) => (ref?.id === accountId ? ref : null);
  const fromAccount = built.fromAccount ?? sameRef('fromAccountId' in next ? next.fromAccountId : undefined, previous.fromAccount ?? previous.toAccount);
  const toAccount = built.toAccount ?? sameRef('toAccountId' in next ? next.toAccountId : undefined, previous.toAccount ?? previous.fromAccount);
  return {
    ...built,
    fromAccount,
    toAccount,
    category: built.category ?? (previous.category?.id === next.categoryId ? previous.category : null),
    createdBy: previous.createdBy,
    createdAt: previous.createdAt,
  };
}

export function buildOptimisticAccount(body: CreateAccountRequest, localId: string): AccountResponse {
  const now = new Date().toISOString();
  return {
    id: localId,
    walletId: body.walletId,
    name: body.name,
    type: body.type,
    currency: body.currency,
    initialBalance: body.initialBalance,
    balance: body.initialBalance,
    status: AccountStatus.ACTIVE,
    createdAt: now,
    updatedAt: now,
  };
}

export function buildOptimisticBudget(
  body: CreateBudgetRequest,
  localId: string,
  apiState: unknown,
): BudgetResponse {
  const category = body.categoryId ? findCachedById<CategoryResponse>(apiState, 'listCategories', body.categoryId) : null;
  const now = new Date().toISOString();
  const endDate = body.endDate ?? null;
  const timeZone = findCachedById<WalletResponse>(apiState, 'listWallets', body.walletId)?.timeZone ?? deviceTimeZone();
  const window = budgetWindow({ periodType: body.periodType, startDate: body.startDate, endDate }, todayIn(timeZone));
  return {
    id: localId,
    walletId: body.walletId,
    name: body.name,
    amount: body.amount,
    currency: body.currency,
    periodType: body.periodType,
    startDate: body.startDate,
    endDate,
    periodStart: window.startDate,
    periodEnd: window.endDate,
    timeZone,
    categoryId: body.categoryId ?? null,
    categoryIds: body.categoryId ? categorySubtreeIds(body.categoryId, cachedItems<CategoryResponse>(apiState, 'listCategories')) : [],
    goalId: body.goalId ?? null,
    category: category
      ? { id: category.id, name: category.name, icon: category.icon, color: category.color }
      : body.categoryId 
        ? { id: body.categoryId, name: '', icon: null, color: null }
        : null,
    spent: ZERO,
    remaining: body.amount,
    usagePercentage: 0,
    isOverBudget: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function buildOptimisticGoal(body: CreateGoalRequest, localId: string): GoalResponse {
  const now = new Date().toISOString();
  return {
    id: localId,
    walletId: body.walletId,
    name: body.name,
    description: body.description ?? null,
    targetAmount: body.targetAmount,
    currency: body.currency,
    targetDate: body.targetDate ?? null,
    status: GoalStatus.ACTIVE,
    currentAmount: ZERO,
    remaining: body.targetAmount,
    progressPercentage: 0,
    contributionCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function buildOptimisticCategory(body: CreateCategoryRequest, localId: string): CategoryResponse {
  return {
    id: localId,
    walletId: body.walletId,
    parentId: body.parentId ?? null,
    systemKey: null,
    name: body.name,
    type: body.type,
    icon: body.icon ?? null,
    color: body.color ?? null,
    status: CategoryStatus.ACTIVE,
    transactionCount: 0,
  };
}
