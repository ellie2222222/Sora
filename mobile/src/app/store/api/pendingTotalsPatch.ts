import type { AccountResponse, DashboardResponse, TransactionResponse } from '@sora/contracts';

import { session, userIdFromAccessToken } from '@/services/auth';
import {
  contributionPatches,
  forEachCachedQueryArgs,
  newAccountPatches,
  transactionPatches,
  type CachePatch,
  type LedgerChange,
} from '@/services/sync';
import { apiSlice } from './apiSlice.ts';

type Dispatch = (action: never) => unknown;
// The endpoints are injected by each resource's own file, so the base slice's typed
// `updateQueryData` knows none of their names.
type UntypedUpdateQueryData = (endpoint: string, args: unknown, recipe: (draft: unknown) => void) => never;
const updateQueryData = apiSlice.util.updateQueryData as unknown as UntypedUpdateQueryData;

function dispatchPatches(dispatch: Dispatch, rootState: unknown, patches: readonly CachePatch[]): void {
  for (const { endpoint, recipe, include } of patches) {
    forEachCachedQueryArgs(rootState, endpoint, (args) => {
      if (!include || include(args)) dispatch(updateQueryData(endpoint, args, recipe));
    });
  }
}

/** The signed-in user, for the dashboard's per-member split of their own offline write. */
export function currentUserId(): string | undefined {
  const current = session.current();
  return (current && userIdFromAccessToken(current.accessToken)) ?? undefined;
}

/** Every cached figure a queued transaction moves (`pendingTotals.ts`), before it syncs. */
export function patchTotalsForTransaction(dispatch: Dispatch, rootState: unknown, change: LedgerChange): void {
  dispatchPatches(dispatch, rootState, transactionPatches(change));
}

export function patchTotalsForNewAccount(dispatch: Dispatch, rootState: unknown, account: AccountResponse): void {
  dispatchPatches(dispatch, rootState, newAccountPatches(account));
}

export function patchTotalsForContribution(dispatch: Dispatch, rootState: unknown, goalId: string, amount: string): void {
  dispatchPatches(dispatch, rootState, contributionPatches(goalId, amount));
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
