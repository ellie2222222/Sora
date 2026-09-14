/**
 * Shared control flow for an offline-capable RTK Query mutation's optimistic
 * cache update — the first use of `onQueryStarted` in this codebase.
 *
 * Each entity's cache shape differs (a paginated list, a bare array, a
 * single-record cache), so the cache-patch recipes stay per entity; this is
 * only the apply → await → reconcile-or-undo shape, written once instead of
 * five times.
 */

export interface OptimisticHandle {
  undo: () => void;
}

/**
 * `queryFulfilled` resolves with the `queryFn`'s own result — for the
 * offline branch that's the locally-enqueued optimistic record itself, not a
 * server response, so `applyServerResult` runs against whatever the enqueue
 * path returned. The real reconciliation (replacing the optimistic record
 * with the server's canonical one) happens later, when the sync engine
 * actually syncs the row and invalidates the entity's tags.
 */
export async function runOptimisticMutation<TResult>(
  queryFulfilled: PromiseLike<{ data: TResult }>,
  applyOptimistic: () => OptimisticHandle,
  applyResult: (data: TResult) => void,
): Promise<void> {
  const { undo } = applyOptimistic();
  try {
    const { data } = await queryFulfilled;
    applyResult(data);
  } catch {
    undo();
  }
}
