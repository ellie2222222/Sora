# Offline-first sync via an expo-sqlite write queue, all 5 entities

**Date:** 2026-09-15T00:00:00Z
**Method:** ad hoc (feature implementation against `plans/mobile/offline-sync-plan.md`, with
user-approved deviations: SQLite backs the write queue only, all 5 entities in one pass)
**Verdict:** PASS (automated checks) / BLOCKED (on-device checks — no Expo Go device/emulator in
this environment)
**Scope:** New offline write-queue infrastructure (SQLite-backed), a background sync engine,
optimistic RTK Query cache updates, and offline enqueue wiring for transactions, accounts,
budgets, goals and categories create/update/archive/cancel mutations that already exist as RTK
Query hooks. `mobile/` only — no server, contracts, or schema changes.
**Files touched:** see plan file `plans/mobile/offline-sync-plan.md` §"New files" and the commit
diff; summarized below.
**Related reports:** none — first pass at this feature.

## Method

- `npx tsc --noEmit` in `mobile/` after each rollout step, and `npm run typecheck` (all
  workspaces) at the end.
- `node --test "src/services/sync/*.test.ts"` for the new sync-layer unit suite, then
  `npm test -w @sora/mobile` for the full mobile suite (guest-mode, form-logic, calc.ts, etc.) to
  check for regressions.
- `node scripts/check-contract-parity.mjs` and `npm test -w @sora/contracts` — this feature makes
  no schema/enum/route changes, run anyway since `@sora/contracts` types are used throughout.
- `npx expo install --check` to confirm the two new dependencies
  (`@react-native-community/netinfo@12.0.1`, `expo-sqlite@57.0.3`) are the versions Expo SDK 57
  expects, not just whatever `npm install` resolved.

## Findings

1. **`useNetworkStatus.tsx` was dead on native** (`isOnline` hardcoded to `true`, listening for
   browser `window`/`navigator.onLine` events that never fire on iOS/Android) — confirmed by
   reading the file before changing it. Replaced with `NetInfo.addEventListener`, keeping the
   exported context shape unchanged so `OfflineBanner.tsx` and other consumers needed no changes
   beyond the new "waiting to sync" state. **Fixed.**

2. **expo-sqlite's actual API surface** — confirmed via
   `node_modules/expo-sqlite/build/SQLiteDatabase.d.ts` before writing `offlineQueueDb.ts`:
   `openDatabaseSync`, `execAsync`, `runAsync(source, params)`, `getAllAsync<T>`,
   `getFirstAsync<T>` are all present in the installed `57.0.3`. No API-shape risk materialized.

3. **Idempotency headers were missing on nearly every mutation the sync engine can retry** —
   confirmed by reading every `services/api/*.ts` file: only `transactions.create()` and
   `goals.addContribution()` sent `Idempotency-Key` before this change. Extended
   `patchOne`/`deleteVoid` in `client.ts` to accept a config, and threaded an optional
   `idempotencyKey` parameter through every create/update/archive/cancel function across all 5
   entity API modules. Verified via `runSyncPass`'s "reuses the same idempotency key across a
   retry" test, which fails loudly if a retry ever mints a fresh key.

4. **Cross-entity FK ordering** (an offline-created transaction referencing an offline-created
   account's local id) — implemented `resolveReferences`/`resolveOwnId` in `syncEngine.ts`,
   re-checking the queue's live state on every row so a same-pass dependency (account synced
   earlier in FIFO order) resolves within one pass, and a genuinely-unresolved reference defers
   the row (stays `pending`) rather than sending a local id the server has never seen. Verified
   by two dedicated tests — one same-pass resolution, one true deferral.

5. **Concurrency lock test initially exposed a real bug in the test itself, not the engine** — a
   first version of the "second concurrent pass is a no-op" test called a mock's resolver before
   the in-flight pass had actually reached it, threw synchronously, and left the module-level
   `syncing` lock permanently `true` for the rest of the test process, which cascaded into two
   unrelated FK-resolution tests failing with empty results. Root-caused by noticing the failures
   were all-empty-results rather than wrong-value assertions, and confirmed by fixing the race
   (a `started`-signal `Promise` gates the second call) and re-running — all 16 tests pass. No
   production code was at fault; recorded here because it is exactly the kind of shared-module-state
   trap this codebase's own `guestUpload.ts` avoids via constructor injection, and worth remembering
   if `runSyncPass`'s lock is ever touched again.

6. **RTK Query `onQueryStarted` had zero prior usage in this codebase** — confirmed by grep before
   writing any code. Implemented as a small, entity-repeated pattern (enqueue → await the
   queryFn's own resolved value → patch every currently-cached `listX`/`getX` query via
   `forEachCachedQueryArgs`, a generic cache-introspection helper, since the exact mounted query
   args aren't known statically) rather than a single generic abstraction, because each entity's
   cache shape differs (`TransactionPage.items` vs. a bare array). `invalidatesTags` is a function
   per mutation that checks `isStillQueued(id)` (a queue lookup keyed by the record's id) and
   returns `[]` while a row is still unsynced — this is deliberate: invalidating tags while
   offline would trigger a refetch that can only fail, clobbering the just-applied optimistic
   patch with a network error.

7. **Scope decision, recorded rather than silently made**: `goalsApiSlice`/`accountsApiSlice` have
   no `updateGoal`/`updateAccount` RTK Query mutation wired to any screen today (confirmed by grep
   — no caller exists). The offline queue's `EntityAdapter.update` for `goal` is a stub that
   throws if ever called, since nothing calls it; `account`'s adapter methods are implemented
   (via `services/api/accounts.ts`, which already had `update`) even though no offline `update`
   enqueue path exists yet, so adding that RTK Query mutation later is a small, isolated addition
   rather than new adapter work.

8. **Optimistic records approximate server-computed fields** (`AccountResponse.balance`,
   `BudgetResponse.usagePercentage`, `GoalResponse.progressPercentage`/`currentAmount`) — filled
   with the request's own values (e.g. balance = initialBalance) or zero, per the plan's accepted
   approximation. `TransactionResponse.fromAccount`/`toAccount`/`category` are looked up from
   whatever's already RTK-Query-cached (`findCachedById`, scanning cache entries by endpoint name
   rather than requiring exact query args) and fall back to `null` on a cache miss — not exercised
   against a real device's live cache in this pass (see Follow-ups).

## Fixes Applied

- `mobile/src/hooks/useNetworkStatus.tsx` — replaced the dead browser-event effect with
  `NetInfo.addEventListener`; re-verified by the typecheck and by the (unit-testable) rest of the
  suite continuing to pass — the NetInfo wiring itself is only exercisable on-device (Follow-ups).
- `mobile/src/services/api/client.ts`, and `accounts.ts`/`budgets.ts`/`goals.ts`/`categories.ts`/
  `transactions.ts` — idempotency-key threading; re-verified via the sync-engine's
  idempotency-reuse test and a full `npm run typecheck` pass.
- `mobile/src/services/sync/syncEngine.test.ts` — fixed the concurrency-test race described in
  Finding 5; re-verified by re-running the full `src/services/sync/*.test.ts` suite (16/16 pass).

## Follow-ups

- **Not run — no Expo Go device/emulator available in this environment.** Everything in
  `plans/mobile/offline-sync-plan.md`'s on-device verification list is still open: SQLite
  round-trip survival across an app kill/restart, NetInfo actually firing the sync engine on a
  real airplane-mode toggle, the full offline→create→reconnect→synced flow per entity, and a
  live 403-mid-queue→conflict→retry-after-role-restored check. These need a physical device or
  simulator session before this feature is called done end-to-end, not just type-safe and
  unit-tested.
- The goal `update` op has no caller and no offline path (Finding 7) — intentionally left as a
  throwing stub rather than speculative work; revisit only if/when an edit-goal screen is built.
- Optimistic account/category refs on a transaction fall back to `null` on a cache miss (e.g. the
  Home screen's cross-wallet timeline before its own account list has ever been fetched) — shows
  a plainer row for the few seconds until sync reconciles it, not a crash; not covered by an
  automated test since it depends on RTK Query's live cache state, which needs a rendered
  component tree to observe meaningfully.
