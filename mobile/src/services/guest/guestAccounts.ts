/**
 * Guest-mode accounts repository — the local mirror of `accountsApi`.
 *
 * Balance and the detail-view totals are derived exactly the way
 * `balance.service.ts` derives them — `calculateAccountBalance` and the same
 * income/expense/transfer split as `activityForAccount`, over the local
 * transaction list via `toBalanceRelevant`. Never stored, per BR-05.
 *
 * `createAccountSchema`/`updateAccountSchema` are re-run here the same way
 * `guestTransactions.ts` re-runs its own schemas: the real `zodPipe` sits in
 * front of the NestJS service, and this file plays both roles at once since
 * guest mode has no separate pipe layer.
 */

import {
  add,
  calculateAccountBalance,
  createAccountSchema,
  formatMoney,
  parseMoney,
  updateAccountSchema,
  ZERO,
  AccountStatus,
  TransactionStatus,
  TransactionType,
  type AccountDetailResponse,
  type AccountResponse,
  type AccountType,
  type CreateAccountRequest,
  type UpdateAccountRequest,
} from '@sora/contracts';

import { fromZodError, guestError } from './guestErrors.ts';
import { newLocalId } from './guestIds.ts';
import { guestStore } from './guestStorage.ts';
import { type GuestAccount, type GuestTransaction, type GuestWallet } from './guestStore.ts';
import { toBalanceRelevant } from './guestTransactions.ts';

export interface AccountListQuery {
  walletId?: string | undefined;
  status?: AccountStatus | undefined;
  type?: AccountType | undefined;
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

function balanceOf(account: GuestAccount, transactions: readonly GuestTransaction[]): bigint {
  return calculateAccountBalance(parseMoney(account.initialBalance), transactions.map(toBalanceRelevant), account.id);
}

function toAccountResponse(account: GuestAccount, balance: bigint): AccountResponse {
  return {
    id: account.id,
    walletId: account.walletId,
    name: account.name,
    type: account.type,
    currency: account.currency,
    initialBalance: account.initialBalance,
    balance: formatMoney(balance),
    status: account.status,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

/** Mirrors `accounts.service.ts`'s `assertNotLastActiveAccount`. */
function assertNotLastActiveAccount(accounts: readonly GuestAccount[], excludingAccountId: string): void {
  const remaining = accounts.filter((account) => account.status === AccountStatus.ACTIVE && account.id !== excludingAccountId);
  if (remaining.length === 0) throw guestError('ACCOUNT_LAST_ACTIVE');
}

export const guestAccountsApi = {
  async list(query: AccountListQuery = {}): Promise<AccountResponse[]> {
    requireWallet();
    const { accounts, transactions } = guestStore.current();

    return accounts
      .filter((account) => !query.status || account.status === query.status)
      .filter((account) => !query.type || account.type === query.type)
      .map((account) => toAccountResponse(account, balanceOf(account, transactions)));
  },

  async detail(accountId: string): Promise<AccountDetailResponse> {
    requireWallet();
    const { accounts, transactions } = guestStore.current();
    const account = findAccount(accounts, accountId);

    const touching = transactions.filter(
      (transaction) => transaction.fromAccountId === accountId || transaction.toAccountId === accountId,
    );

    let totalIncome = ZERO;
    let totalExpense = ZERO;
    let transferredIn = ZERO;
    let transferredOut = ZERO;

    for (const transaction of touching) {
      if (transaction.status !== TransactionStatus.COMPLETED) continue;
      const amount = parseMoney(transaction.amount);
      if (transaction.type === TransactionType.INCOME && transaction.toAccountId === accountId) {
        totalIncome = add(totalIncome, amount);
      } else if (transaction.type === TransactionType.EXPENSE && transaction.fromAccountId === accountId) {
        totalExpense = add(totalExpense, amount);
      } else if (transaction.type === TransactionType.TRANSFER) {
        if (transaction.toAccountId === accountId) transferredIn = add(transferredIn, amount);
        if (transaction.fromAccountId === accountId) transferredOut = add(transferredOut, amount);
      }
    }

    return {
      ...toAccountResponse(account, balanceOf(account, transactions)),
      totalIncome: formatMoney(totalIncome),
      totalExpense: formatMoney(totalExpense),
      transferredIn: formatMoney(transferredIn),
      transferredOut: formatMoney(transferredOut),
      // Counts every row touching the account, deleted included — a deleted
      // entry is still a visible record of what happened (§16.3).
      transactionCount: touching.length,
    };
  },

  async create(body: CreateAccountRequest): Promise<AccountResponse> {
    const wallet = requireWallet();
    const parsed = createAccountSchema.safeParse(body);
    if (!parsed.success) throw fromZodError(parsed.error);
    const request = parsed.data;

    const now = new Date().toISOString();
    const account: GuestAccount = {
      id: newLocalId(),
      walletId: wallet.id,
      name: request.name,
      type: request.type,
      currency: request.currency,
      initialBalance: request.initialBalance,
      status: AccountStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
    };

    await guestStore.mutate((current) => ({ ...current, accounts: [...current.accounts, account] }));
    // A brand-new account has no transactions, so its balance is its opening one.
    return toAccountResponse(account, parseMoney(account.initialBalance));
  },

  async update(accountId: string, body: UpdateAccountRequest): Promise<AccountResponse> {
    requireWallet();
    const parsed = updateAccountSchema.safeParse(body);
    if (!parsed.success) throw fromZodError(parsed.error);
    const patch = parsed.data;

    const { accounts, transactions, contributions } = guestStore.current();
    const existing = findAccount(accounts, accountId);

    if (patch.status === AccountStatus.ARCHIVED && existing.status === AccountStatus.ACTIVE) {
      assertNotLastActiveAccount(accounts, accountId);
    }
    // Mirrors accounts.service.ts: currency moves only while nothing is recorded in it (§9.4).
    if (patch.currency !== undefined && patch.currency !== existing.currency) {
      const named =
        transactions.some((transaction) => transaction.fromAccountId === accountId || transaction.toAccountId === accountId) ||
        contributions.some((contribution) => contribution.accountId === accountId);
      if (named) throw guestError('ACCOUNT_CURRENCY_MISMATCH');
    }

    const updated: GuestAccount = {
      ...existing,
      name: patch.name ?? existing.name,
      currency: patch.currency ?? existing.currency,
      status: patch.status ?? existing.status,
      updatedAt: new Date().toISOString(),
    };

    const data = await guestStore.mutate((current) => ({
      ...current,
      accounts: current.accounts.map((candidate) => (candidate.id === accountId ? updated : candidate)),
    }));

    return toAccountResponse(updated, balanceOf(updated, data.transactions));
  },

  /** Archives; hard delete is not exposed, mirroring accounts.service.ts's `archive()`. */
  async archive(accountId: string): Promise<void> {
    requireWallet();
    const { accounts } = guestStore.current();
    const existing = findAccount(accounts, accountId);
    if (existing.status === AccountStatus.ARCHIVED) return;

    assertNotLastActiveAccount(accounts, accountId);

    await guestStore.mutate((current) => ({
      ...current,
      accounts: current.accounts.map((candidate) =>
        candidate.id === accountId
          ? { ...candidate, status: AccountStatus.ARCHIVED, updatedAt: new Date().toISOString() }
          : candidate,
      ),
    }));
  },
};
