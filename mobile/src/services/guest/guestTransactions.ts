/**
 * Guest-mode transactions repository — the local mirror of `transactionsApi`.
 *
 * Validation mirrors `transactions.service.ts`'s create/update/delete: same
 * error codes (via `guestError`/`fromZodError`), same currency and
 * archived-account rules, same BR-03 restriction on what update may touch.
 * BR-03 needs no runtime rawBody check here the way the server's controller
 * does — `updateTransactionSchema` has no `amount`/`type`/`fromAccountId`/
 * `toAccountId` field at all, so a caller conforming to `UpdateTransactionRequest`
 * cannot express one, and `.safeParse` strips anything else that tries to.
 *
 * There is no `WalletAccessService` equivalent because guest mode is
 * single-wallet and every account/category in `guestStore` already belongs
 * to the one wallet the guest owns — the cross-wallet and role checks that
 * service exists for have nothing to check here.
 */

import {
  DEFAULT_PAGE_SIZE,
  createTransactionSchema,
  parseMoney,
  updateTransactionSchema,
  TransactionType,
  TransactionStatus,
  AccountStatus,
  type BalanceRelevantTransaction,
  type CreateTransactionRequest,
  type PaginationMeta,
  type SpendRelevantTransaction,
  type TransactionQuery,
  type TransactionResponse,
  type UpdateTransactionRequest,
} from '@sora/contracts';

import { fromZodError, guestError } from './guestErrors.ts';
import { GUEST_USER, newLocalId } from './guestIds.ts';
import { guestStore } from './guestStorage.ts';
import {
  type GuestAccount,
  type GuestCategory,
  type GuestTransaction,
  type GuestWallet,
} from './guestStore.ts';

export interface TransactionPage {
  items: TransactionResponse[];
  pagination: PaginationMeta | undefined;
}

export function toBalanceRelevant(transaction: GuestTransaction): BalanceRelevantTransaction {
  return {
    type: transaction.type,
    status: transaction.status,
    amount: parseMoney(transaction.amount),
    fromAccountId: transaction.fromAccountId,
    toAccountId: transaction.toAccountId,
  };
}

/** `walletId` is the guest's one wallet, which every guest account belongs to. */
export function toSpendRelevant(transaction: GuestTransaction, walletId: string): SpendRelevantTransaction {
  return {
    type: transaction.type,
    status: transaction.status,
    amount: parseMoney(transaction.amount),
    currency: transaction.currency,
    categoryId: transaction.categoryId,
    goalId: transaction.goalId,
    walletId: transaction.fromAccountId === null ? null : walletId,
    transactionDate: transaction.transactionDate,
  };
}

/** API spec §11.2: only an expense carries a goal, and only one of the wallet's own goals. */
function assertGoalTag(type: TransactionType, goalId: string, walletId: string): void {
  if (type !== TransactionType.EXPENSE) {
    throw guestError('VALIDATION_FAILED', { goalId: ['Only an expense can be tagged with a goal'] });
  }
  const goal = guestStore.current().goals.find((candidate) => candidate.id === goalId);
  if (!goal || goal.walletId !== walletId) throw guestError('GOAL_NOT_FOUND');
}

function requireWallet(): GuestWallet {
  const wallet = guestStore.current().wallet;
  if (!wallet) throw guestError('WALLET_NOT_FOUND');
  return wallet;
}

function findAccount(accounts: readonly GuestAccount[], accountId: string): GuestAccount {
  const account = accounts.find((candidate) => candidate.id === accountId);
  if (!account) throw guestError('ACCOUNT_NOT_FOUND');
  return account;
}

function findCategory(categories: readonly GuestCategory[], categoryId: string): GuestCategory {
  const category = categories.find((candidate) => candidate.id === categoryId);
  if (!category) throw guestError('CATEGORY_NOT_FOUND');
  return category;
}

/** Mirrors `transactions.service.ts`'s free function of the same name. */
function accountIdsOf(request: CreateTransactionRequest): string[] {
  if (request.type === TransactionType.INCOME) return [request.toAccountId];
  if (request.type === TransactionType.EXPENSE) return [request.fromAccountId];
  return [request.fromAccountId, request.toAccountId];
}

function accountRef(account: GuestAccount, wallet: GuestWallet) {
  return {
    id: account.id,
    name: account.name,
    currency: account.currency,
    walletId: wallet.id,
    walletName: wallet.name,
  };
}

function categoryRef(category: GuestCategory) {
  return {
    id: category.id,
    name: category.name,
    type: category.type,
    icon: category.icon,
    color: category.color,
  };
}

export function toTransactionResponse(
  transaction: GuestTransaction,
  accounts: readonly GuestAccount[],
  categories: readonly GuestCategory[],
  wallet: GuestWallet,
): TransactionResponse {
  return {
    id: transaction.id,
    type: transaction.type,
    status: transaction.status,
    amount: transaction.amount,
    currency: transaction.currency,
    description: transaction.description,
    transactionDate: transaction.transactionDate,
    reference: transaction.reference,
    fromAccount: transaction.fromAccountId
      ? accountRef(findAccount(accounts, transaction.fromAccountId), wallet)
      : null,
    toAccount: transaction.toAccountId
      ? accountRef(findAccount(accounts, transaction.toAccountId), wallet)
      : null,
    category: transaction.categoryId ? categoryRef(findCategory(categories, transaction.categoryId)) : null,
    goalId: transaction.goalId,
    createdBy: GUEST_USER,
    // Guest mode is single-wallet by scope decision — a transaction here can
    // never name two different wallets the way a real transfer can (BR-02).
    isCrossWallet: false,
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt,
  };
}

function calendarDay(value: string): string {
  return value.slice(0, 10);
}

function matchesFilters(transaction: GuestTransaction, filters: Partial<TransactionQuery>): boolean {
  if (
    filters.accountId &&
    transaction.fromAccountId !== filters.accountId &&
    transaction.toAccountId !== filters.accountId
  ) {
    return false;
  }
  if (filters.categoryId && transaction.categoryId !== filters.categoryId) return false;
  if (filters.type && transaction.type !== filters.type) return false;
  if (filters.status && transaction.status !== filters.status) return false;
  if (filters.dateFrom && calendarDay(transaction.transactionDate) < filters.dateFrom) return false;
  if (filters.dateTo && calendarDay(transaction.transactionDate) > filters.dateTo) return false;
  if (filters.minAmount && parseMoney(transaction.amount) < parseMoney(filters.minAmount)) return false;
  if (filters.maxAmount && parseMoney(transaction.amount) > parseMoney(filters.maxAmount)) return false;
  if (filters.search) {
    const pattern = filters.search.toLowerCase();
    const haystack = `${transaction.description ?? ''} ${transaction.reference ?? ''}`.toLowerCase();
    if (!haystack.includes(pattern)) return false;
  }
  return true;
}

type SortField = 'transactionDate' | 'amount' | 'createdAt';

function sortValue(transaction: GuestTransaction, field: SortField): string | bigint {
  return field === 'amount' ? parseMoney(transaction.amount) : transaction[field];
}

/** Mirrors `pagination.ts`'s `parseSort` — leading `-` descending, comma-separated. */
function applySort(transactions: readonly GuestTransaction[], sortBy: string): GuestTransaction[] {
  const keys = sortBy
    .split(',')
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((raw) => ({
      desc: raw.startsWith('-'),
      field: (raw.startsWith('-') ? raw.slice(1) : raw) as SortField,
    }));

  return [...transactions].sort((a, b) => {
    for (const { desc, field } of keys) {
      const left = sortValue(a, field);
      const right = sortValue(b, field);
      const cmp = left < right ? -1 : left > right ? 1 : 0;
      if (cmp !== 0) return desc ? -cmp : cmp;
    }
    return 0;
  });
}

export const guestTransactionsApi = {
  async list(query: Partial<TransactionQuery> = {}): Promise<TransactionPage> {
    const wallet = requireWallet();
    const { accounts, categories, transactions } = guestStore.current();

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const sortBy = query.sortBy ?? '-transactionDate';

    const filtered = applySort(
      transactions.filter((transaction) => matchesFilters(transaction, query)),
      sortBy,
    );
    const total = filtered.length;
    const items = filtered
      .slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize)
      .map((transaction) => toTransactionResponse(transaction, accounts, categories, wallet));

    return { items, pagination: { page, pageSize, total, hasMore: page * pageSize < total } };
  },

  async detail(transactionId: string): Promise<TransactionResponse> {
    const wallet = requireWallet();
    const { accounts, categories, transactions } = guestStore.current();
    const transaction = transactions.find((candidate) => candidate.id === transactionId);
    if (!transaction) throw guestError('TRANSACTION_NOT_FOUND');
    return toTransactionResponse(transaction, accounts, categories, wallet);
  },

  async create(body: CreateTransactionRequest): Promise<TransactionResponse> {
    const wallet = requireWallet();
    const parsed = createTransactionSchema.safeParse(body);
    if (!parsed.success) throw fromZodError(parsed.error);
    const request = parsed.data;

    if (request.type === TransactionType.TRANSFER && request.fromAccountId === request.toAccountId) {
      throw guestError('TRANSFER_SAME_ACCOUNT');
    }

    const { accounts, categories } = guestStore.current();
    const touchedAccounts = accountIdsOf(request).map((accountId) => findAccount(accounts, accountId));

    for (const account of touchedAccounts) {
      if (account.status === AccountStatus.ARCHIVED) throw guestError('ACCOUNT_ARCHIVED');
    }

    const fromAccount = request.type !== TransactionType.INCOME ? findAccount(accounts, request.fromAccountId) : undefined;
    const toAccount = request.type !== TransactionType.EXPENSE ? findAccount(accounts, request.toAccountId) : undefined;

    // Before the per-account check: a cross-currency transfer always mismatches one side, and this names why.
    if (request.type === TransactionType.TRANSFER && fromAccount!.currency !== toAccount!.currency) {
      throw guestError('TRANSFER_CURRENCY_MISMATCH');
    }
    for (const account of touchedAccounts) {
      if (account.currency !== request.currency) throw guestError('ACCOUNT_CURRENCY_MISMATCH');
    }

    const categoryId = request.categoryId ?? null;
    if (categoryId !== null) {
      const category = findCategory(categories, categoryId);
      if (category.type !== request.type) throw guestError('CATEGORY_WRONG_TYPE');
      if (category.walletId !== wallet.id) throw guestError('CATEGORY_WRONG_WALLET');
    }
    const goalId = request.goalId ?? null;
    if (goalId !== null) assertGoalTag(request.type, goalId, wallet.id);

    const now = new Date().toISOString();
    const transaction: GuestTransaction = {
      id: newLocalId(),
      type: request.type,
      status: request.status,
      amount: request.amount,
      currency: request.currency,
      description: request.description ?? null,
      transactionDate: request.transactionDate,
      reference: request.reference ?? null,
      fromAccountId: request.type === TransactionType.INCOME ? null : request.fromAccountId,
      toAccountId: request.type === TransactionType.EXPENSE ? null : request.toAccountId,
      categoryId,
      goalId,
      createdAt: now,
      updatedAt: now,
    };

    const data = await guestStore.mutate((current) => ({
      ...current,
      transactions: [...current.transactions, transaction],
    }));

    return toTransactionResponse(transaction, data.accounts, data.categories, wallet);
  },

  async update(transactionId: string, body: UpdateTransactionRequest): Promise<TransactionResponse> {
    const wallet = requireWallet();
    const parsed = updateTransactionSchema.safeParse(body);
    if (!parsed.success) throw fromZodError(parsed.error);
    const patch = parsed.data;

    const { categories, transactions } = guestStore.current();
    const existing = transactions.find((candidate) => candidate.id === transactionId);
    if (!existing) throw guestError('TRANSACTION_NOT_FOUND');
    if (existing.status === TransactionStatus.DELETED) throw guestError('TRANSACTION_ALREADY_DELETED');

    if (patch.categoryId === null) {
      if (existing.type !== TransactionType.TRANSFER) throw guestError('CATEGORY_WRONG_TYPE');
    } else if (patch.categoryId !== undefined) {
      const category = findCategory(categories, patch.categoryId);
      if (category.type !== existing.type) throw guestError('CATEGORY_WRONG_TYPE');
      if (category.walletId !== wallet.id) throw guestError('CATEGORY_WRONG_WALLET');
    }
    if (patch.goalId != null) assertGoalTag(existing.type, patch.goalId, wallet.id);

    const updated: GuestTransaction = {
      ...existing,
      description: patch.description !== undefined ? patch.description : existing.description,
      transactionDate: patch.transactionDate !== undefined ? patch.transactionDate : existing.transactionDate,
      categoryId: patch.categoryId !== undefined ? patch.categoryId : existing.categoryId,
      goalId: patch.goalId !== undefined ? patch.goalId : existing.goalId,
      reference: patch.reference !== undefined ? patch.reference : existing.reference,
      updatedAt: new Date().toISOString(),
    };

    const data = await guestStore.mutate((current) => ({
      ...current,
      transactions: current.transactions.map((candidate) =>
        candidate.id === transactionId ? updated : candidate,
      ),
    }));

    return toTransactionResponse(updated, data.accounts, data.categories, wallet);
  },

  async delete(transactionId: string): Promise<TransactionResponse> {
    const wallet = requireWallet();
    const { transactions } = guestStore.current();
    const existing = transactions.find((candidate) => candidate.id === transactionId);
    if (!existing) throw guestError('TRANSACTION_NOT_FOUND');
    if (existing.status === TransactionStatus.DELETED) throw guestError('TRANSACTION_ALREADY_DELETED');

    const deleted: GuestTransaction = { ...existing, status: TransactionStatus.DELETED, updatedAt: new Date().toISOString() };

    const data = await guestStore.mutate((current) => ({
      ...current,
      transactions: current.transactions.map((candidate) =>
        candidate.id === transactionId ? deleted : candidate,
      ),
      // A deleted payment stops crediting whatever goal it was backing
      // (§11.5) — mirrors transactions.service.ts's `delete()` deleting the
      // linked `goal_contributions` row.
      contributions: current.contributions.filter((contribution) => contribution.transactionId !== transactionId),
    }));

    return toTransactionResponse(deleted, data.accounts, data.categories, wallet);
  },
};
