/**
 * Every server-state cache key, written once.
 *
 * Invalidation is the part that rots: a mutation that forgets one key leaves the
 * app showing a figure the server no longer agrees with, and nothing fails. The
 * factory plus the invalidation bundles below mean a call site names an
 * *operation*, never a list of key literals it has to keep in sync by hand.
 */

import type {
  AccountStatus,
  AccountType,
  BudgetStatus,
  CategoryStatus,
  CategoryType,
  GoalStatus,
  MemberStatus,
  TransactionQuery,
  WalletStatus,
} from '@sora/contracts';

export type QueryKey = readonly unknown[];

// Each shape matches its API service's *ListQuery interface exactly (contract
// enums, not bare strings) so a cache key and the request it was built from can
// never type-check against different value sets.
export interface AccountListParams {
  walletId?: string | undefined;
  status?: AccountStatus | undefined;
  type?: AccountType | undefined;
}

export interface CategoryListParams {
  walletId: string;
  type?: CategoryType | undefined;
  status?: CategoryStatus | undefined;
  tree?: boolean | undefined;
}

export interface BudgetListParams {
  walletId: string;
  status?: BudgetStatus | undefined;
  activeOn?: string | undefined;
}

export interface GoalListParams {
  walletId: string;
  status?: GoalStatus | undefined;
}

export interface DashboardParams {
  walletId: string;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
}

export interface WalletListParams {
  status?: WalletStatus | undefined;
}

export interface AuditLogListParams {
  event?: string | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
}

export const queryKeys = {
  auth: {
    root: () => ['auth'] as const,
    me: () => ['auth', 'me'] as const,
  },
  wallets: {
    root: () => ['wallets'] as const,
    list: (params: WalletListParams = {}) => ['wallets', 'list', params] as const,
    detail: (walletId: string) => ['wallets', 'detail', walletId] as const,
    members: (walletId: string, status: MemberStatus = 'ACTIVE') =>
      ['wallets', 'members', walletId, status] as const,
    invitations: (walletId: string, state = 'open') =>
      ['wallets', 'invitations', walletId, state] as const,
    auditLogs: (walletId: string, params: AuditLogListParams = {}) =>
      ['wallets', 'auditLogs', walletId, params] as const,
  },
  accounts: {
    root: () => ['accounts'] as const,
    list: (params: AccountListParams = {}) => ['accounts', 'list', params] as const,
    detail: (accountId: string) => ['accounts', 'detail', accountId] as const,
  },
  categories: {
    root: () => ['categories'] as const,
    list: (params: CategoryListParams) => ['categories', 'list', params] as const,
  },
  transactions: {
    root: () => ['transactions'] as const,
    list: (filters: Partial<TransactionQuery>) => ['transactions', 'list', filters] as const,
    detail: (transactionId: string) => ['transactions', 'detail', transactionId] as const,
  },
  budgets: {
    root: () => ['budgets'] as const,
    list: (params: BudgetListParams) => ['budgets', 'list', params] as const,
    detail: (budgetId: string) => ['budgets', 'detail', budgetId] as const,
  },
  goals: {
    root: () => ['goals'] as const,
    list: (params: GoalListParams) => ['goals', 'list', params] as const,
    detail: (goalId: string) => ['goals', 'detail', goalId] as const,
    contributions: (goalId: string) => ['goals', 'contributions', goalId] as const,
  },
  dashboard: {
    root: () => ['dashboard'] as const,
    summary: (params: DashboardParams) => ['dashboard', 'summary', params] as const,
  },
} as const;

/**
 * Caches a recorded money movement can change (plan §19).
 *
 * Balances live on accounts and are totalled on wallets; the dashboard's income,
 * expense and category split all derive from transactions; a budget's `spent` is
 * a sum over them; and a contribution recorded as a transaction advances a goal.
 * All six are listed here so a mutation cannot invalidate four of them.
 */
export const TRANSACTION_INVALIDATION_KEYS: readonly QueryKey[] = [
  queryKeys.transactions.root(),
  queryKeys.accounts.root(),
  queryKeys.dashboard.root(),
  queryKeys.budgets.root(),
  queryKeys.wallets.root(),
  queryKeys.goals.root(),
];

/** A contribution moves goal progress and, when transaction-backed, real money. */
export const CONTRIBUTION_INVALIDATION_KEYS: readonly QueryKey[] = TRANSACTION_INVALIDATION_KEYS;

/** Membership changes alter which wallets and rows the caller can see at all. */
export const MEMBERSHIP_INVALIDATION_KEYS: readonly QueryKey[] = [
  queryKeys.wallets.root(),
  queryKeys.accounts.root(),
  queryKeys.transactions.root(),
  queryKeys.dashboard.root(),
];

/** Structural changes to where money sits: balances and every wallet total move. */
export const ACCOUNT_INVALIDATION_KEYS: readonly QueryKey[] = [
  queryKeys.accounts.root(),
  queryKeys.wallets.root(),
  queryKeys.dashboard.root(),
];

/** A category rename or archive changes budget labels and dashboard slices. */
export const CATEGORY_INVALIDATION_KEYS: readonly QueryKey[] = [
  queryKeys.categories.root(),
  queryKeys.budgets.root(),
  queryKeys.dashboard.root(),
  queryKeys.transactions.root(),
];
