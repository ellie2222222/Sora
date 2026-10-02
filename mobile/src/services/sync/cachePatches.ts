/**
 * Which cached reads show a figure an offline write moves, and how each is patched.
 *
 * `pendingTotals.ts` holds the arithmetic; this holds the routing, as plain data, so a cached
 * read that is missed (a budget list never updated, an account dashboard patched with wallet
 * figures) is caught by a test. `app/store/api/pendingTotalsPatch.ts` dispatches the patches.
 */

import type {
  AccountDetailResponse,
  AccountResponse,
  BudgetResponse,
  DashboardQuery,
  DashboardResponse,
  GoalResponse,
  WalletResponse,
} from '@sora/contracts';

import {
  applyContributionToGoal,
  applyNewAccountToDashboard,
  applyNewAccountToWallet,
  applyToAccount,
  applyToBudget,
  applyToDashboard,
  applyToWallet,
  type LedgerChange,
} from './pendingTotals.ts';

export interface CachePatch {
  /** RTK Query endpoint name, as each `app/store/api/*Api.ts` file injects it. */
  endpoint: string;
  recipe: (draft: unknown) => void;
  /** Which cached arguments of that endpoint to patch; every one when absent. */
  include?: (args: unknown) => boolean;
}

/**
 * The patches reason at wallet level (a sibling transfer is internal, a new account adds to the
 * total), which is wrong for a one-account view; those entries wait for the sync's refetch instead.
 */
export const isWalletWideDashboard = (args: unknown): boolean => (args as DashboardQuery).accountId === undefined;

function patch<T>(endpoint: string, recipe: (draft: T) => void, include?: (args: unknown) => boolean): CachePatch {
  return { endpoint, recipe: recipe as (draft: unknown) => void, ...(include ? { include } : {}) };
}

function eachItem<T>(apply: (item: T) => void): (draft: T[]) => void {
  return (draft) => draft.forEach(apply);
}

export function transactionPatches(change: LedgerChange): CachePatch[] {
  return [
    patch<AccountResponse[]>('listAccounts', eachItem((account) => applyToAccount(account, change))),
    patch<AccountDetailResponse>('getAccount', (account) => applyToAccount(account, change)),
    patch<WalletResponse[]>('listWallets', eachItem((wallet) => applyToWallet(wallet, change))),
    patch<WalletResponse>('getWallet', (wallet) => applyToWallet(wallet, change)),
    patch<BudgetResponse[]>('listBudgets', eachItem((budget) => applyToBudget(budget, change))),
    patch<BudgetResponse>('getBudget', (budget) => applyToBudget(budget, change)),
    patch<DashboardResponse>('getDashboardSummary', (dashboard) => applyToDashboard(dashboard, change), isWalletWideDashboard),
  ];
}

export function newAccountPatches(account: AccountResponse): CachePatch[] {
  return [
    patch<WalletResponse[]>('listWallets', eachItem((wallet) => applyNewAccountToWallet(wallet, account))),
    patch<WalletResponse>('getWallet', (wallet) => applyNewAccountToWallet(wallet, account)),
    patch<DashboardResponse>('getDashboardSummary', (dashboard) => applyNewAccountToDashboard(dashboard, account), isWalletWideDashboard),
  ];
}

export function contributionPatches(goalId: string, amount: string): CachePatch[] {
  const apply = (goal: GoalResponse) => applyContributionToGoal(goal, goalId, amount);
  return [
    patch<GoalResponse[]>('listGoals', eachItem(apply)),
    patch<GoalResponse>('getGoal', apply),
    patch<DashboardResponse>('getDashboardSummary', (dashboard) => dashboard.activeGoals.forEach(apply)),
  ];
}
