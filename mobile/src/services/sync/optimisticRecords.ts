/**
 * Builds the record an offline `create` shows immediately, before the sync
 * engine ever reaches the server. Fields the server would normally compute
 * (account balance, budget usage, goal progress, a transaction's resolved
 * account/category refs) are filled from whatever's already cached or with a
 * neutral placeholder — an accepted approximation, not a bug: the pending
 * indicator (§ UI) marks the record as provisional, and the real value
 * lands within one sync pass. RTK Query's cache stays the read path; this
 * never writes anywhere but the optimistic patch itself.
 */

import {
  AccountStatus,
  BudgetStatus,
  CategoryStatus,
  GoalStatus,
  TransactionType,
  type AccountResponse,
  type BudgetResponse,
  type CategoryResponse,
  type CreateAccountRequest,
  type CreateBudgetRequest,
  type CreateCategoryRequest,
  type CreateGoalRequest,
  type CreateTransactionRequest,
  type GoalResponse,
  type TransactionAccountRef,
  type TransactionResponse,
} from '@sora/contracts';

import { findCachedById } from './cacheLookup.ts';

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
    createdBy: PENDING_CREATED_BY,
    isCrossWallet:
      body.type === TransactionType.TRANSFER && !!fromAccount && !!toAccount
        ? fromAccount.walletId !== toAccount.walletId
        : false,
    createdAt: now,
    updatedAt: now,
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
  const category = findCachedById<CategoryResponse>(apiState, 'listCategories', body.categoryId);
  const now = new Date().toISOString();
  return {
    id: localId,
    walletId: body.walletId,
    name: body.name,
    amount: body.amount,
    currency: body.currency,
    periodType: body.periodType,
    startDate: body.startDate,
    endDate: body.endDate,
    status: BudgetStatus.ACTIVE,
    category: category
      ? { id: category.id, name: category.name, icon: category.icon, color: category.color }
      : { id: body.categoryId, name: '', icon: null, color: null },
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
    name: body.name,
    type: body.type,
    icon: body.icon ?? null,
    color: body.color ?? null,
    status: CategoryStatus.ACTIVE,
    transactionCount: 0,
  };
}
