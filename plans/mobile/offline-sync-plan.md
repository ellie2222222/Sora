# Offline-First Data Entry and Background Sync — Implementation Plan

Status: **superseded — implemented, with two deviations from this draft's own recommendations.**
Section 1's "do not introduce SQLite" was overridden (SQLite backs the offline write queue
specifically, not a general local read store — see the report below for the exact scope), and
Section 2's transactions-only pilot was widened to all five entities in one pass. See
`verifications/2026-09-15-offline-sync-sqlite-queue.md` for what was actually built and verified.

## 0. Where the spec's premise doesn't match this codebase

The spec assumes "the existing SQLite local database" as the local source of truth, to be reused
as-is. **There is no SQLite anywhere in `mobile/`** — no `expo-sqlite` dependency, no SQLite source
files. Verified by grepping `mobile/package.json` and all of `mobile/src`.

What *does* exist, and is directly relevant:

- **RTK Query + Redux** (`mobile/src/app/store/api/*Api.ts`) is the current server-state layer.
  Mutations (e.g. `transactionsApi.ts`) are plain `builder.mutation`s with no optimistic update —
  the UI waits for the server (or guest-mode) response, then `invalidatesTags` triggers a refetch.
  This is the "wait for server" shape the spec explicitly wants replaced.
- **A mature, tested local-first system already exists for guest mode**
  (`mobile/src/services/guest/`, ~4300 lines, `guestStore.test.ts` + `guestUpload.test.ts` alone are
  over 1100 lines of tests). It is the closest real analog to what this feature needs:
  - `guestStorage.ts` persists one JSON blob to `AsyncStorage` under a fixed key.
  - `guestStore.ts`'s `GuestStore.mutate(updater)` is the single write path: apply a pure update,
    serialize, save, notify subscribers — durable on every write, not just in memory.
  - `guestUpload.ts` uploads locally-created guest data to the server once a guest signs up, and
    is provably resumable-after-kill and duplicate-safe: it pins a **stable idempotency key per
    local id** (`ensureKey()`) and records a **local-id → server-id map** (`recordMap()`) after
    each success, so a resumed run either replays the same idempotency key (deduped server-side)
    or skips a step already recorded as done — never both.
  - The server already has generic support for this: `docs/API_SPECIFICATION.md` §2.10 and
    `server/src/common/idempotency.interceptor.ts` implement an `Idempotency-Key` header, honored
    on every mutating endpoint, specifically "for a mobile client retrying a transaction create
    over a flaky connection." This is exactly the "existing idempotency mechanism" the spec says
    to reuse — and it already works today, for guest uploads.
- **Network detection is currently broken on native.** `mobile/src/hooks/useNetworkStatus.tsx`
  listens for browser `window`/`navigator.onLine` events, guarded by `typeof window !== 'undefined'`
  checks, and **defaults `isOnline` to `true`** when that API isn't present — which is always, on
  iOS/Android. There is no `@react-native-community/netinfo` (or equivalent) in the dependency
  tree. This has to be fixed before anything else in this plan can work correctly on-device.
- **Role-based write permission (`permissions.canWrite`) is already a real, server-authoritative,
  widely-used pattern** (10+ screens gate on it: `AccountsScreen`, `BudgetsScreen`, `GoalsScreen`,
  `CategoryListScreen`, transaction add/detail, etc.), backed by AC-01/wallet roles. This must be
  **preserved** for genuine `VIEWER`s — the spec's "don't block on view-only" is about not
  conflating *stale/unknown* permission state (because we're offline) with a *confirmed* role, not
  about removing role enforcement itself.

## 1. Architecture decision — needs sign-off

**Recommendation: do not introduce SQLite. Extend the existing RTK Query/Redux/AsyncStorage stack**,
following the pattern already proven in `guestUpload.ts`, rather than building a second, parallel
persistence engine.

Reasoning:
- Introducing SQLite from scratch means a brand-new dependency, a hand-rolled schema mirroring
  every entity, and a query layer — essentially rebuilding what RTK Query's normalized cache
  already gives for free, which is itself "introducing a second local persistence system" in
  spirit, just with SQL instead of JSON.
- The guest-mode system already solves the hard part (durable-across-kill, idempotent, resumable,
  no duplicate server records) with real, tested code. Reusing its *pattern* — not its guest-only
  code, a genuinely different one is needed for continuous bidirectional sync against an
  already-populated dataset — honors "reuse existing architecture" far more than SQLite would.
- RTK Query already has the hooks this needs: `onQueryStarted` for optimistic cache updates,
  tag invalidation for refetch-on-reconnect, and a serializable store `redux-persist` (or a
  hand-rolled AsyncStorage boot-hydrate, matching `guestStore`'s own approach) can make durable.
- Honest tradeoff: no relational query engine, no indices, no joins. Not needed today — every
  existing "query" (filter/sort a transaction list) is already plain JS over arrays, in both guest
  mode and the RTK Query cache. If a future need for real local querying at much larger data
  volumes appears, that's a later, separate decision — not a reason to build it now.

**If this recommendation is rejected and SQLite is a hard requirement, this entire plan changes**:
a new dependency (`expo-sqlite`), a real schema + migrations, and a data-access layer replacing
RTK Query's cache as the read path (RTK Query would only orchestrate sync, not serve reads). That
is a materially larger effort and a different plan — flag before implementation starts if that's
actually wanted instead.

## 2. Scope and phasing

This is large regardless of the section-1 decision. Building all of transactions + accounts +
budgets + goals + categories offline-capable, with conflict handling and full UI status
treatment, in one pass is how this kind of feature quietly regresses everything at once.

**Pilot entity: transactions.** Highest-value (money entry is the core "don't block me" case in
the spec's own examples), and `guestTransactions.ts`/`guestUpload.ts`'s transaction path is the
most complete existing analog to copy the pattern from. Everything below is written against
transactions first; extending to accounts/budgets/goals/categories is a repeat of the same shape
once the pilot is verified (Phase 5).

## 3. Local write model

New Redux slice, `offlineQueueSlice` (`mobile/src/app/store/offlineQueueSlice.ts`), persisted to
`AsyncStorage` via a `guestStore`-style single-blob `mutate()` (or `redux-persist` restricted to
this one slice — decide during implementation; either satisfies "durable on every write").

Per queued mutation:

```ts
interface QueuedMutation {
  queueId: string;        // newLocalId(), stable identity for this queue entry
  entity: 'transaction';  // widened per Phase 5
  op: 'create' | 'update' | 'cancel';
  localId: string;        // the record's id as the UI already knows it
  serverId: string | null; // filled in once a create round-trips
  idempotencyKey: string; // minted once via ensureKey()-equivalent, stable across retries
  payload: unknown;        // the validated request body (already Zod-parsed client-side, VL-01)
  status: 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict';
  errorCode: string | null; // an @sora/contracts ERROR_CODE, for i18n mapping — never raw text
  createdAt: string;
  attempts: number;
  ownerUserId: string | null; // the signed-in user who queued it (access token `sub`)
}
```

**Ownership (added 2026-09-24).** The queue only shows and syncs rows whose `ownerUserId`
matches the current session. Another user's pending writes wait, untouched, until that user signs
back in, instead of replaying under the wrong bearer token. `OfflineQueue.setOwner()` is driven by
`AuthProvider` from the stored session, so it works on an offline start too. Rows from before the
column existed go only to the session restored on the first launch after the upgrade. That choice
is recorded so later launches reuse it; with no restored session they are orphaned and never synced
(`OfflineQueue.resolvePreOwnershipRows`, SDS §4.4).

RTK Query's own cache remains the read path (`useListTransactionsInfiniteQuery` etc.) — this queue is
*write*-side bookkeeping only, not a duplicate read store. A queued create's record must still be
visible in the list immediately (spec §1's core requirement), which Phase 4 covers.

## 4. Local write path (transactions, create)

```
User submits TransactionFormModal
        ↓
Validate against createTransactionSchema (already happens today — unchanged)
        ↓
Enqueue: append a QueuedMutation (status: pending) to offlineQueueSlice, AsyncStorage-flushed
        ↓
Optimistically update the transactionsApi RTK Query cache via updateQueryData
   (an `onQueryStarted` on a new `createTransactionOffline` mutation, or a plain dispatch
   into the cache — the record appears with `localId`, no `serverId` yet)
        ↓
UI shows the transaction immediately, with a small pending-sync indicator (§10)
        ↓
Background sync engine (§6) picks it up when online
```

Edit/cancel follow the same shape: enqueue, optimistically patch the cache, let the sync engine
reconcile. An edit that moves money (BR-03 now allows amount, type and accounts) reverses the old
figures and applies the new ones in the cache, as one in-place change; the server checks it as a create when it syncs.

## 5. Background sync engine

New module, `mobile/src/services/sync/syncEngine.ts`. Trigger conditions:
- Network transitions offline→online (from the fixed `useNetworkStatus`, §7).
- App returns to foreground (`AppState` listener).
- Manual pull-to-refresh (§11).
- Optionally a light interval while foregrounded (e.g. every 30–60s) as a safety net.

```
Trigger fires
        ↓
Read all `pending`/`failed` QueuedMutations in FIFO order (mirrors guestUpload.ts's
  fixed-order-by-dependency approach, but here order is mostly creation-time since
  transactions don't depend on each other the way categories→accounts→transactions do)
        ↓
For each: mark `syncing`, POST/PATCH with `Idempotency-Key: idempotencyKey`
        ↓
2xx  → record serverId, mark `synced`, patch the RTK Query cache to replace the
       optimistic record with the server's canonical response
403/404 (permission) → mark `conflict`, map ERROR_CODE → i18n (§9), do NOT delete
409 (BR-03/other)    → mark `failed`, same i18n mapping, do NOT delete
5xx                   → mark `failed` with backoff, keep draining the rest; never parked as `conflict`
network error         → leave `pending`, stop this pass, retry next trigger — never delete
```

Concurrency: one in-flight sync pass at a time (a simple in-memory lock in `syncEngine.ts`),
so a reconnect firing while a foreground-interval pass is running doesn't double-send the same
queue entry — the idempotency key makes a double-send safe either way, this just avoids the
wasted request.

## 6. Fix network detection first (blocking dependency for everything above)

Replace `useNetworkStatus.tsx`'s `window`/`navigator.onLine` check with
`@react-native-community/netinfo` (the standard Expo-compatible library; `expo-network` is a
lighter alternative but netinfo's `addEventListener` push model fits the "trigger sync on
reconnect" shape better than polling). New dependency — flagging per "ask before a new
dependency," bundled into the section-1 sign-off rather than a separate ask.

## 7. Sync status UI

- Per-row: a small dot/indicator on a transaction row when its `QueuedMutation.status` is
  anything but `synced` (already-established indicator pattern to follow, not invented fresh —
  check `TransactionRow.tsx` for the least intrusive slot to add it).
- Global: extend the existing `OfflineBanner.tsx` (already renders conditionally on
  `isOnline`/`hasSyncError` from `useNetworkStatus`) rather than building a second banner
  component — add a "Waiting to sync (n)" state alongside its current offline/sync-error states.
- Never a full-screen error for any of `pending`/`syncing`/`failed`/`conflict` — only the existing
  per-row/banner treatment.

## 8. Permission rejection and conflict handling

- A queue entry that comes back `403`/`404` from the server is marked `conflict`, never silently
  dropped and never re-interpreted as "go view-only" for the whole wallet — it's one record's
  status, surfaced via §7's per-row indicator with a "Review"/"Retry" action (exact copy from
  `ERROR_CODES` → the existing i18n locale files, matching how errors are already surfaced
  elsewhere — no new error-presentation mechanism).
- **Conflict strategy (concurrent edit by another wallet member) is explicitly out of scope for
  the transactions pilot**: a same-record double-edit race between two members is narrow, and the
  last write wins (every field is now editable in place, BR-03). Revisit once budgets/goals (which *do*
  have contested mutable fields) are in scope (Phase 5) rather than design a general
  last-write-wins/merge strategy now for a case the pilot barely has.

## 9. Pull-to-refresh, auth, deletion, startup

- **Pull-to-refresh**: unchanged trigger, but online path now also runs the sync engine before
  refetching (so a refresh doesn't show stale "pending" rows it could've just synced); offline
  path re-reads the RTK Query cache + queue state as today, with `OfflineBanner`'s existing
  "can't refresh right now" treatment for the server call specifically, not the whole screen.
- **Auth while offline**: unaffected by this plan — session/token handling in
  `services/auth/index.ts` already survives offline via existing refresh-token logic; this plan
  doesn't touch it. Queued mutations don't require a fresh token to be *queued*, only to *sync*.
- **Deletion**: no entity in this pilot scope is hard-deleted server-side already (BR conventions:
  cancel for transactions, archive elsewhere) — offline deletion is just another queued `op` using
  the same archive/cancel endpoints, no new soft-delete concept needed.
- **Startup**: already local-first in shape (RTK Query cache from before restart isn't persisted
  today, but the queue slice will be) — add "flush any `pending` queue entries" after store
  rehydration, before the first network call, so a restart with pending offline work doesn't wait
  on the network to show local state.

## 10. Non-goals (this pass)

- No SQLite (pending section 1 sign-off).
- No general conflict-resolution/merge engine — see §8.
- No offline queueing for accounts/budgets/goals/categories yet — Phase 5, after the transactions
  pilot is verified end-to-end.
- No changes to guest mode's own upload system — it already does its job; this plan is for
  already-authenticated wallet members.
- No change to any business rule. (BR-03 later made every transaction field editable; offline edits
  follow it.)

## 11. Verification plan

Mirrors the spec's own §19 checklist, scoped to the transactions pilot:
- Offline: create/edit/cancel a transaction, force-kill the app, reopen, confirm the queued
  mutation and optimistic record both survive.
- Reconnect: confirm the queued mutation syncs, the optimistic record is replaced by the server's
  canonical one (no duplicate row), and status flips to `synced`.
- Server rejection: simulate a `403` (e.g. revoke `EDITOR` mid-queue) — confirm the record stays
  visible, marked `conflict`, with a working retry after role is restored.
- Network drop mid-sync: confirm the retried request reuses the same idempotency key and the
  server does not create a duplicate transaction (this is directly testable against the existing
  `IdempotencyInterceptor`).
- Pull-to-refresh online and offline, per §9.

## 12. Rollout order

1. Add `@react-native-community/netinfo`, fix `useNetworkStatus.tsx` (§6). Independently valuable
   and low-risk even before the rest lands. **Done, as planned.**
2. `offlineQueueSlice` + AsyncStorage persistence (§3). **Done, differently:** the queue itself is
   persisted to `expo-sqlite` (a real table), not AsyncStorage — see the status line above.
   `offlineQueueSlice` still exists, but as a thin in-memory Redux mirror of the SQLite queue for
   `useSelector` reactivity, not the persistence layer itself.
3. Transaction create wired through the queue + optimistic cache update (§4). **Done.**
4. `syncEngine.ts` (§5), wired to the fixed network hook + `AppState`. **Done**, plus cross-entity
   local-id → server-id FK resolution not in this draft's original single-entity design — required
   once accounts/budgets/goals/categories were in scope alongside transactions.
5. Sync status UI (§7). **Done.**
6. Transaction edit/cancel through the same path. **Done.**
7. Verification pass (§11) before calling the pilot done. **Done** —
   [verifications/2026-09-15-offline-sync-sqlite-queue.md](../../verifications/2026-09-15-offline-sync-sqlite-queue.md),
   followed by a double-check pass:
   [verifications/2026-09-15-double-check-offline-sync.md](../../verifications/2026-09-15-double-check-offline-sync.md).
8. Only then: extend to accounts → budgets → goals → categories, repeating steps 2-6 per entity.
   **Done, differently:** built in the same pass as transactions rather than as a follow-on after a
   separate pilot gate, per the phasing override below. On-device verification (SQLite survives an
   app restart, NetInfo reconnect firing sync, a live 403→conflict→retry) is still outstanding — no
   device/emulator was available in this environment.

---

**Open questions before implementation starts — all resolved by explicit user decision:**
1. Confirm or reject the section-1 recommendation (no SQLite). **Resolved: rejected.** SQLite
   (`expo-sqlite`) was adopted, scoped to the write queue only — RTK Query's cache remains the sole
   read path, so this draft's "don't introduce a second local read store" concern still holds.
2. Confirm the transactions-first phasing (§2) rather than a wider first slice. **Resolved:
   rejected.** All five entities (transactions, accounts, budgets, goals, categories) were built
   and shipped in one pass.
3. `@react-native-community/netinfo` as a new dependency (§6) — confirm. **Resolved: confirmed,
   added** (`mobile/package.json`).
