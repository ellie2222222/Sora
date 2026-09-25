# A dropped refresh no longer signs the user out; contributions and permanent category deletes queue offline

**Date:** 2026-09-24T09:30:00Z
**Method:** ad hoc
**Verdict:** PASS (typecheck plus unit tests; not driven on a device or against a server)
**Scope:** the two items approved from the "leftover tasks" review: accidental logout during a token refresh, and gap 4 (offline queueing).

**Files touched:**
- **Refresh:** `mobile/src/services/auth/{session,session.test,index,refreshRejection,refreshRejection.test}.ts`, `mobile/src/services/api/client.ts`
- **Queue:** `mobile/src/services/sync/{offlineQueueTypes,entityAdapters,syncEngine,syncEngineRuntime,optimisticRecords,syncEngine.test}.ts`
- **API slices and HTTP:** `mobile/src/services/api/categories.ts`, `mobile/src/app/store/api/{goalsApi,categoriesApi}.ts`
- **Docs:** `SDS.md` §4.4

**Related reports:** `2026-09-24-offline-reads-and-compose.md`

## Findings

1. **Refresh logout: FIXED.**
   - Before: `performRefresh` cleared the session on any failure, so a dropped connection or a 5xx during a refresh signed the user out.
   - Now `SessionManager` takes `isRefreshRejected`, and only a 4xx other than 429 counts as a rejection (`isRefreshRejection`, which checks the real axios response). Anything else keeps the session.
   - The 401 interceptor then reports "no connection" (a network error) instead of the original 401 whenever the session survived. Without that, `AuthProvider`'s `/me` check would still clear the session on startup.
   - A genuine rejection still clears the session and returns the 401.
   - Tests: the session is kept on a transient failure; `isRefreshRejection` returns true for 401 and 422, and false for no response, 429, 503 and a non-axios error.
2. **Goal contributions queue offline: FIXED.**
   - New queue entity `contribution`. Its payload is `{ ...body, goalId }`, so `REFERENCE_FIELDS` can remap `goalId`, `accountId` and `categoryId` from queued local ids.
   - The optimistic record goes to the top of the goal's first loaded contributions page. After a successful sync, it invalidates the same tags as an online contribution.
   - Test: a contribution to a goal created offline is sent with that goal's server id.
3. **Permanent category delete queues offline: FIXED.**
   - New queue op `delete`, dispatched to `adapter.deletePermanently`. `categoriesApi.deletePermanently` now sends an Idempotency-Key.
   - The category is removed from the cached category lists straight away.
   - A server refusal (`409 CATEGORY_HAS_TRANSACTIONS`) is kept as `failed` and follows the existing backoff-then-conflict path, rather than being dropped.
   - Tests: the delete routes to `deletePermanently` and not to archive; the refusal is kept.

**Verification:**
- `npx tsc --noEmit`: exit 0.
- `npm run test` in `mobile/`: 359/359.

## Follow-ups

- Not exercised against a live server; the offline flows are unit-tested only.
- A contribution queued with `recordAsTransaction: true` doesn't show its backing transaction in the transaction list until it syncs. This is the same "totals don't move offline" gap as before.
