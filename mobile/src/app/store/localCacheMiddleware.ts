import type { Middleware } from '@reduxjs/toolkit';

import { localCache, savesForCacheEntry } from '@/services/sync';
import { apiSlice } from './api/apiSlice.ts';

/**
 * Reads save themselves; this covers the other way a cached list changes — an
 * offline write patching it in place — so a queued row is still listed after a
 * restart.
 */
export const localCacheMiddleware: Middleware = (store) => (next) => (action) => {
  const result = next(action);
  if (apiSlice.internalActions.queryResultPatched.match(action)) {
    const queries = (store.getState() as Record<string, { queries: Record<string, unknown> }>)[apiSlice.reducerPath]?.queries;
    for (const { key, value } of savesForCacheEntry(queries?.[action.payload.queryCacheKey] as never)) {
      void localCache.save(key, value).catch(() => undefined);
    }
  }
  return result;
};
