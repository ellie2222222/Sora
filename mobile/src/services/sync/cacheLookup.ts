/**
 * Best-effort lookup of an already-cached record by id, scanning every RTK
 * Query cache entry for a given endpoint rather than requiring the exact
 * query args a list was fetched with. Used only to enrich an optimistic
 * offline record (an account/category name to show immediately) — a miss
 * here just means a plainer placeholder until the sync engine's tag
 * invalidation replaces the optimistic record with the server's real one.
 */

import { apiSlice } from '../../app/store/api/apiSlice.ts';

interface CachedQueryEntry {
  endpointName?: string;
  data?: unknown;
}

/**
 * Calls `fn` with the `originalArgs` of every currently-cached query for
 * `endpointName` — how an optimistic patch reaches every mounted list
 * variant (different filters/pages) without knowing which ones exist.
 *
 * Delegates to RTK Query's own `selectCachedArgsForQuery` (which also skips
 * a query that's been registered but never fetched) rather than hand-parsing
 * `state[api.reducerPath].queries` — that shape is `apiSlice`'s internals,
 * `selectCachedArgsForQuery` is the stable public seam for reading it. `rootState`
 * is the whole app state (it does the `state[reducerPath]` lookup itself),
 * not `state[apiSlice.reducerPath]` — the same value every `getState()` call
 * already returns.
 */
export function forEachCachedQueryArgs(rootState: unknown, endpointName: string, fn: (originalArgs: unknown) => void): void {
  const selectCachedArgsForQuery = apiSlice.util.selectCachedArgsForQuery as (
    state: unknown,
    name: string,
  ) => unknown[];
  for (const args of selectCachedArgsForQuery(rootState, endpointName)) fn(args);
}

export function findCachedById<T extends { id: string }>(
  apiState: unknown,
  endpointName: string,
  id: string,
): T | null {
  return cachedItems<T>(apiState, endpointName).find((item) => item.id === id) ?? null;
}

/** Every record cached under `endpointName`, across all its query variants, one per id. */
export function cachedItems<T extends { id: string }>(apiState: unknown, endpointName: string): T[] {
  const queries = (apiState as { queries?: Record<string, CachedQueryEntry> } | undefined)?.queries;
  if (!queries) return [];

  const byId = new Map<string, T>();
  for (const entry of Object.values(queries)) {
    if (entry?.endpointName !== endpointName) continue;
    const data = entry.data;
    const list = Array.isArray(data) ? data : (data as { items?: unknown[] } | undefined)?.items;
    if (!Array.isArray(list)) continue;
    for (const item of list as T[]) {
      if (item && !byId.has(item.id)) byId.set(item.id, item);
    }
  }
  return [...byId.values()];
}
