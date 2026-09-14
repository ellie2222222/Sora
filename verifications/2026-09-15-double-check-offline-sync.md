# Double-check pass on the offline-sync SQLite queue feature

**Date:** 2026-09-15T00:00:00Z
**Method:** double-check skill
**Verdict:** PASS
**Scope:** The offline-sync feature just implemented (see the report below) — Phase 1 codebase-health
sweep scoped to its new/changed files, plus re-run pre-completion verification after fixes.
**Files touched:** [mobile/src/app/store/api/transactionsApi.ts](../mobile/src/app/store/api/transactionsApi.ts),
[accountsApi.ts](../mobile/src/app/store/api/accountsApi.ts), [budgetsApi.ts](../mobile/src/app/store/api/budgetsApi.ts),
[goalsApi.ts](../mobile/src/app/store/api/goalsApi.ts), [categoriesApi.ts](../mobile/src/app/store/api/categoriesApi.ts),
[mobile/src/services/sync/cacheLookup.ts](../mobile/src/services/sync/cacheLookup.ts),
[mobile/src/components/TransactionRow.tsx](../mobile/src/components/TransactionRow.tsx),
[plans/mobile/offline-sync-plan.md](../plans/mobile/offline-sync-plan.md)
**Related reports:** [2026-09-15-offline-sync-sqlite-queue.md](2026-09-15-offline-sync-sqlite-queue.md)
(the feature this pass reviews)

## Method

Read `CLAUDE.md` fresh. Checked `ls -t verifications/ | head` and skimmed the most recent prior
mobile-dependency report (`2026-09-14-expo-dependency-version-fix.md`) for open follow-ups — its
lesson (a workspace-subfolder `npm install` can leave an invalid dependency edge) was re-checked
against this session's own `npm install` in `mobile/`, not just assumed clean.

Delegated a Phase 1 sweep to a general-purpose agent, scoped to every new/changed file from the
offline-sync pass, checking: unused imports/dead exports, duplication across the 5 entity API
files, whether the new cache-introspection helpers duplicate an existing RTK Query utility,
whether `plans/mobile/offline-sync-plan.md` needed updating given the delivered code deviates from
its own recommendations, comment quality, remaining raw-string-literal-instead-of-enum cases,
i18n key parity, and dangling references to the services/api/*.ts functions' now-extended
signatures.

Independently verified two of its findings myself before fixing (per the skill's "verify against
the live repo before fixing" instruction): `npm ls --all` for dependency-graph health, and
`node_modules/@reduxjs/toolkit`'s own type declarations for the `selectCachedArgsForQuery` claim.

Re-ran after every fix: `npx tsc --noEmit` (mobile), `npm test -w @sora/mobile`.

## Findings

1. **Raw string literals instead of enum constants — confirmed, real, already partly known.**
   Before this pass started, `transactionsApi.ts`/`accountsApi.ts`/`budgetsApi.ts`/`categoriesApi.ts`
   used `'CANCELLED'`/`'ARCHIVED'` string literals for a transaction/account/budget/category status
   instead of the `TransactionStatus.CANCELLED`/`AccountStatus.ARCHIVED`/`BudgetStatus.ARCHIVED`/
   `CategoryStatus.ARCHIVED` constants the rest of the codebase uses everywhere else (e.g.
   `services/guest/guestUpload.ts`). The sweep additionally found `TransactionRow.tsx:28,30`'s
   `transaction.type === 'TRANSFER'`/`'EXPENSE'` checks (pre-existing in the working tree before
   this session, per `git diff HEAD` — not introduced by the offline-sync work, but in a file this
   pass already touches) using the same anti-pattern, with `TransactionType` not even imported.

2. **`cacheLookup.ts`'s `forEachCachedQueryArgs` reimplemented an RTK Query built-in.**
   Confirmed via `node_modules/@reduxjs/toolkit/dist/query/rtk-query.legacy-esm.js:1925-1927` —
   `apiSlice.util.selectCachedArgsForQuery(rootState, queryName)` does exactly what the hand-rolled
   version did (scan `state[reducerPath].queries` for a matching `endpointName`, return
   `originalArgs`), plus filters out a query that's registered but never actually fetched
   (`entry.status !== STATUS_UNINITIALIZED`), which the hand-rolled version did not. `findCachedById`
   (the other helper in the same file) was left as-is — it reads cached *data*, not args, and RTK
   Query has no built-in "search cached data across every arg variant by predicate" utility to
   delegate to; it's also lower-stakes (an accepted-approximation optimistic-record enrichment,
   not the invalidation-skip decision).

3. **`plans/mobile/offline-sync-plan.md` was left saying "draft, not yet approved" after being
   implemented with two deviations from its own §1/§2 recommendations.** No in-repo precedent either
   way (`git log` on that file and its sibling `mobile-development-plan.md` shows no history — both
   are new in this working tree), but CLAUDE.md's Definition-of-Done gate 7 ("the plan's phase
   checkboxes reflect what was actually built") argues for updating it rather than leaving it
   silently contradicted by the delivered code.

4. **Everything else checked came back clean**: no unused imports or dead exports in any new/changed
   file; the 5-entity-file duplication is at the same level of repetition this codebase's api-slice
   files already had before this feature (confirmed via `git show HEAD~1:.../accountsApi.ts`) and
   the genuinely-shared parts are already factored into `optimisticMutation.ts`/`cacheLookup.ts`;
   comments in every new `services/sync/` file explain a real constraint or cross-file seam, never
   "what"; the 7 new i18n keys match exactly between `en.ts` and `vi.ts`; no caller of the
   `services/api/*.ts` functions passes a stray positional argument that collides with the newly
   added trailing `idempotencyKey?` parameter; `npm ls --all` shows no invalid dependency edges from
   adding `@react-native-community/netinfo`/`expo-sqlite` (unlike the prior session's NativeWind
   churn), and `npx expo install --check` confirms both are the SDK-57-expected versions.

## Fixes Applied

1. [transactionsApi.ts](../mobile/src/app/store/api/transactionsApi.ts) — `TransactionStatus.CANCELLED`
   instead of `'CANCELLED'` (3 sites); imported `TransactionStatus` as a value.
2. [accountsApi.ts](../mobile/src/app/store/api/accountsApi.ts) — `AccountStatus.ARCHIVED`.
3. [budgetsApi.ts](../mobile/src/app/store/api/budgetsApi.ts) — `BudgetStatus.ARCHIVED`.
4. [categoriesApi.ts](../mobile/src/app/store/api/categoriesApi.ts) — `CategoryStatus.ARCHIVED`.
5. [TransactionRow.tsx:28,30](../mobile/src/components/TransactionRow.tsx#L28-L30) —
   `TransactionType.TRANSFER`/`TransactionType.EXPENSE`, imported `TransactionType` as a value.
6. [goalsApi.ts](../mobile/src/app/store/api/goalsApi.ts) — extracted a named `GOAL_TAGS` const for
   `invalidatesTags`, matching every sibling file's `X_TAGS` convention instead of an inline
   `['Goal']` literal.
7. [cacheLookup.ts](../mobile/src/services/sync/cacheLookup.ts) — `forEachCachedQueryArgs` now
   delegates to `apiSlice.util.selectCachedArgsForQuery`; updated all 12 call sites across the 5
   entity API files to pass the full root state (`getState()`) instead of manually indexing
   `[apiSlice.reducerPath]` first.
8. [plans/mobile/offline-sync-plan.md:3-7](../plans/mobile/offline-sync-plan.md#L3-L7) — status line
   updated from "draft, not yet approved" to "superseded — implemented," pointing at the
   verification report.

Re-verified: `npx tsc --noEmit` clean after every fix; `npm test -w @sora/mobile` 136/136 after the
`cacheLookup.ts` refactor (the highest-risk fix, since it touched all 5 entity files' `onQueryStarted`
call sites).

## Follow-ups

None beyond what the original feature report (`2026-09-15-offline-sync-sqlite-queue.md`) already
lists — on-device verification is still the open item, unaffected by this pass's fixes (all
type-level/logic-level, no behavior change to the sync engine or queue itself).
