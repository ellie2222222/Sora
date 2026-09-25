# Comment audit of the uncommitted tree since ee24fe1

**Date:** 2026-09-25T02:15:00Z
**Method:** comment-audit skill
**Verdict:** PASS
**Scope:**
- every comment line added or changed in the uncommitted diff of tracked code files (115 lines), plus every comment in the 30 new source files;
- locale files excluded.

The last whole-repo pass was `2026-09-21-comment-audit-repo-wide.md`, and `2026-09-24-comment-audit.md` covered up to `22297af`.

**Files touched:**
- comments: `mobile/src/app/store/localCacheMiddleware.ts`, `mobile/src/components/{ListLoadMoreFooter,ConnectionSyncStatus,TransactionTotals,TransactionListSection}.tsx`, `mobile/src/design-system/colors.test.ts`, `mobile/src/services/sync/{localCache,pendingTotals}.ts`, `mobile/src/app/providers/AuthProvider.tsx`;
- code, flagged separately below: `mobile/src/services/sync/syncEngineRuntime.ts`, the import in `localCacheMiddleware.ts`, and the `localCache.test.ts` fixture;
- docs: `verifications/2026-09-24-per-account-local-cache.md`, `CLAUDE.md` Part 6.

**Related reports:** `2026-09-24-comment-audit.md` (its follow-up on the shared overscroll props is still open)

## Method

- Tracked files: `git diff -U3 -- '*.ts' '*.tsx' '*.mjs' '*.js' '*.yml' '*.sql' ':!**/locales/**'`, reading each added comment in the live file.
- New files: each read in full.
- The search ran in two read-only agents. Every finding below was re-checked against the live file before it was changed.

## Findings

Comments removed or rewritten:

1. `localCacheMiddleware.ts:10` said "Deep paths into services/sync for the same reason as the api slices (rule 14)". **Stale (4).**
   - The api slices import the `@/services/sync` barrel, and no barrel module imports `app/store`'s index at runtime. `syncEngineRuntime.ts` imports only `apiSlice.ts` and `offlineQueueSlice.ts` directly; its `@/app/store` import is type-only.
   - Deleted the sentence, and switched the import to the barrel (MB-10).
2. `ListLoadMoreFooter.tsx:9` said "Shown only while more pages exist". **Stale (4):** the spinner ignores `hasNextPage`. Rewritten as "The retry shows only while more pages exist…".
3. `localCache.ts:43` used the user's real address as the example. Replaced with `alice@example.invalid` → `a•••@example.invalid`.
   - The matching fixture at `localCache.test.ts:139` was changed too; that is a test-data change.
   - The masked address in `2026-09-24-per-account-local-cache.md` was changed too.
4. `colors.test.ts:231-234` ended "(the `surfaceMuted` fill it replaced measured 1.01:1 in dark mode)". **Journal (J).** Condensed to one line that keeps the WCAG rationale.
5. `ConnectionSyncStatus.tsx:25` said "…now that its box is wider than the glyph". **Journal (J).** Rewritten as "…since its 44pt box is wider than the glyph".
6. `TransactionTotals.tsx:14` ended "Used for a day's heading in `TransactionDayHeader`". **Caller reference (3).** Sentence deleted.
7. `TransactionListSection.tsx:14` was one very long line. **Condense (6):** now "Animates only freshly created rows, not every remount of existing data (tab switch, scroll-back, reopen)."
8. `syncEngineRuntime.ts:21` said "The same sets the online mutations invalidate". **Stale (4)** for two entries:
   - `budget` was `['Budget']`, but `BUDGET_TAGS` is `['Budget','Dashboard']`;
   - `category` was `['Category']`, but `CATEGORY_TAGS` is `['Category','Budget','Dashboard','Transaction']`.

   The comment was right and the code was wrong: a synced offline budget or category write never refreshed the dashboard. **Code fix:** lines 25 and 27 now match the online sets.

Comments added:

- `pendingTotals.ts:219`: "Sorted first so a tie picks the same currency `DashboardService.spendingByCategory` does." Source: the server's `reduce` over the sorted `currencies()`, with `>` (`dashboard.service.ts`).
- `AuthProvider.tsx:120`: "Advisory, as in signIn: a local storage failure must not fail a restore that succeeded." Source: the sibling convention in `signIn`'s catch in the same file.

Flagged, not fixed:

- **F2:** the two-line "Ref pattern (see `CalculatorKeypadProps.onConfirmRef`)… Declared before the early returns…" comment is identical in `AddAccountModal.tsx:58`, `AddBudgetModal.tsx:107`, `AddContributionModal.tsx:78` and `AddGoalModal.tsx:51`. Its target still exists (`CalculatorKeypad.tsx:22`). A shared hook would remove all four copies; that is a code change.
- **F2, acceptable:** the offset-paging tiebreak note is near-verbatim in `audit.service.ts:110`, `goal-contributions.service.ts:71` and `transactions.service.ts:292`, each on its own tiebreak line.
- **F1, all resolve:** `SDS §4.4`, CLAUDE.md rules 1, 14 and 17, `BalanceService`/`DashboardService`, `activityForAccount` (counts cancelled rows), `RECENT_TRANSACTIONS_LIMIT` (10 on both sides), MB-04, API-05, migration 006's 33 colours, `offlineQueueDb.ts`'s `syncDatabase.ts`/`guestStorage.ts`.

Gap left open, reason not recoverable:

- `offlineQueue.ts:49-53`: `setOwner` → `claimUnowned` gives pre-ownership rows to whoever signs in first. No report or commit says why that is safe; `2026-09-24-follow-ups-pass.md` records only what it does. No rationale was invented.

Everything else reviewed (the files named in both agent reports) had no findings.

## Fixes Applied

- **Comment-only edits:** items 1–7 and the two added comments. Each edit's old and new text is comment text only.
- The `git diff` of those files against HEAD also shows code lines, but they come from this session's earlier uncommitted work.
- **Code changes, outside the comment-only rule:** item 8's tag sets, item 1's import, and item 3's test fixture.
- **Re-verified in `mobile/`:**
  - `npx tsc --noEmit` → 0;
  - `npm run test` → 410/410;
  - `npx expo export --platform android` → bundled (3768 modules).
- **Also this pass:** `CLAUDE.md:688` "TypeScript 5.7" → "TypeScript 6.0" (all three packages pin `~6.0.3`; Zod 3.25.76 still matches "Zod 3").

## Follow-ups

- The four-way ref-pattern comment (F2): extract a hook if the pattern gets a fifth copy.
- The `claimUnowned` rationale: closed. The user chose the session-restore model (`2026-09-25-pre-ownership-queue-rows.md`).
- Carried forward: extract the three Refreshable* lists' shared overscroll props (`2026-09-24-comment-audit.md`).
