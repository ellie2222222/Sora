import type {
  AccountDetailResponse,
  AccountResponse,
  BudgetResponse,
  DashboardResponse,
  GoalResponse,
  TransactionResponse,
  WalletResponse,
} from '@sora/contracts';

import { session, userIdFromAccessToken } from '@/services/auth';
import {
  applyContributionToGoal,
  applyNewAccountToDashboard,
  applyNewAccountToWallet,
  applyToAccount,
  applyToBudget,
  applyToDashboard,
  applyToWallet,
  forEachCachedQueryArgs,
  type LedgerChange,
} from '@/services/sync';
import { apiSlice } from './apiSlice.ts';

type Dispatch = (action: never) => unknown;
// The endpoints are injected by each resource's own file, so the base slice's typed
// `updateQueryData` knows none of their names.
type UntypedUpdateQueryData = (endpoint: string, args: unknown, recipe: (draft: unknown) => void) => never;
const updateQueryData = apiSlice.util.updateQueryData as unknown as UntypedUpdateQueryData;

function patchEach<T>(dispatch: Dispatch, rootState: unknown, endpoint: string, recipe: (draft: T) => void): void {
  forEachCachedQueryArgs(rootState, endpoint, (args) => {
    dispatch(updateQueryData(endpoint, args, recipe as (draft: unknown) => void));
  });
}

function eachItem<T>(apply: (item: T) => void): (draft: T[]) => void {
  return (draft) => draft.forEach(apply);
}

/** The signed-in user, for the dashboard's per-member split of their own offline write. */
export function currentUserId(): string | undefined {
  const current = session.current();
  return (current && userIdFromAccessToken(current.accessToken)) ?? undefined;
}

/** Every cached figure a queued transaction moves (`pendingTotals.ts`), before it syncs. */
export function patchTotalsForTransaction(dispatch: Dispatch, rootState: unknown, change: LedgerChange): void {
  patchEach<AccountResponse[]>(dispatch, rootState, 'listAccounts', eachItem((account) => applyToAccount(account, change)));
  patchEach<AccountDetailResponse>(dispatch, rootState, 'getAccount', (account) => applyToAccount(account, change));
  patchEach<WalletResponse[]>(dispatch, rootState, 'listWallets', eachItem((wallet) => applyToWallet(wallet, change)));
  patchEach<WalletResponse>(dispatch, rootState, 'getWallet', (wallet) => applyToWallet(wallet, change));
  patchEach<BudgetResponse[]>(dispatch, rootState, 'listBudgets', eachItem((budget) => applyToBudget(budget, change)));
  patchEach<BudgetResponse>(dispatch, rootState, 'getBudget', (budget) => applyToBudget(budget, change));
  patchEach<DashboardResponse>(dispatch, rootState, 'getDashboardSummary', (dashboard) => applyToDashboard(dashboard, change));
}

export function patchTotalsForNewAccount(dispatch: Dispatch, rootState: unknown, account: AccountResponse): void {
  patchEach<WalletResponse[]>(dispatch, rootState, 'listWallets', eachItem((wallet) => applyNewAccountToWallet(wallet, account)));
  patchEach<WalletResponse>(dispatch, rootState, 'getWallet', (wallet) => applyNewAccountToWallet(wallet, account));
  patchEach<DashboardResponse>(dispatch, rootState, 'getDashboardSummary', (dashboard) =>
    applyNewAccountToDashboard(dashboard, account),
  );
}

export function patchTotalsForContribution(dispatch: Dispatch, rootState: unknown, goalId: string, amount: string): void {
  const apply = (goal: GoalResponse) => applyContributionToGoal(goal, goalId, amount);
  patchEach<GoalResponse[]>(dispatch, rootState, 'listGoals', eachItem(apply));
  patchEach<GoalResponse>(dispatch, rootState, 'getGoal', apply);
  patchEach<DashboardResponse>(dispatch, rootState, 'getDashboardSummary', (dashboard) => dashboard.activeGoals.forEach(apply));
}

interface CachedEntry {
  endpointName?: string;
  data?: unknown;
}

/** The transaction as currently cached — a delete needs its amount and accounts to reverse it. */
export function findCachedTransaction(rootState: unknown, transactionId: string): TransactionResponse | null {
  const queries = (rootState as Record<string, { queries?: Record<string, CachedEntry> } | undefined>)[apiSlice.reducerPath]
    ?.queries;
  for (const entry of Object.values(queries ?? {})) {
    const candidates =
      entry?.endpointName === 'getTransaction'
        ? [entry.data as TransactionResponse | undefined]
        : entry?.endpointName === 'listTransactions'
          ? ((entry.data as { pages?: { items: TransactionResponse[] }[] } | undefined)?.pages ?? []).flatMap((page) => page.items)
          : entry?.endpointName === 'getDashboardSummary'
            ? ((entry.data as DashboardResponse | undefined)?.recentTransactions ?? [])
            : [];
    const match = candidates.find((candidate) => candidate?.id === transactionId);
    if (match) return match;
  }
  return null;
}
