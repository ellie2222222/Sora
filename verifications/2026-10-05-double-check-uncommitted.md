# Double-check of the full uncommitted tree before commit (design tokens, month totals, empty state, infra-audit fixes)

**Date:** 2026-10-05T03:17:39Z
**Method:** double-check skill (Phase 1 delegated to a read-only sweep agent over `git diff` + untracked files)
**Verdict:** PASS
**Scope:** every uncommitted change (≈160 files) — this session's work plus earlier sessions' uncommitted work; items already covered by the infra-audit and design-token reports excluded
**Files touched:** `mobile/src/features/transactions/components/{TransactionListScreen,TransactionListSkeleton}.tsx`, `mobile/src/app/i18n/locales/{en,vi}.ts`, `mobile/src/features/chat/components/ChatInputBar.tsx`, `mobile/src/components/TransactionListSection.tsx`, `mobile/src/utils/date.ts`, `server/src/audit/audit.service.ts`, `server/src/{accounts/balance.service,auth/token.service,goals/goal-access,transactions/transactions.service,wallets/members.service,wallets/wallet-access.service}.ts` (blank lines), `server/test/integration.access.test.ts`, `docs/{DESIGN_GUIDELINES,API_SPECIFICATION}.md`, `SDS.md`, `plans/mobile/transaction-ui-plan.md`
**Related reports:** [2026-10-03-double-check-uncommitted.md](2026-10-03-double-check-uncommitted.md) (its dead-file follow-up closed by 21257f8), [2026-10-05-infra-audit-fixes.md](2026-10-05-infra-audit-fixes.md), [2026-10-04-design-token-fixes.md](2026-10-04-design-token-fixes.md)

## Method

```bash
git status --short; git diff                       # scope
git grep -l -- "<each removed symbol>"              # ScaleIn, tabBarMetrics, QueryProvider, @tanstack/react-query, MIGRATIONS_DIR, withMessage, hashesMatch, WALLET_ACCESS_KEY, WalletIdSource, draftFromTransaction, WEEKDAY_INITIALS, useAppSelector, selectQueueRows, CategoryDeleteMode, prettier-plugin-tailwindcss, categories.detail
git grep -n -E "QueryProvider|react-query|MIGRATIONS_DIR|NestJS 11|Add your first transaction" -- '*.md'
# Disposable Postgres (user's sora-postgres untouched):
docker run -d --name scratch-int-efe4f266 -e POSTGRES_USER=scratch -e POSTGRES_PASSWORD=… -e POSTGRES_DB=sora_test -p 127.0.0.1:5544:5432 postgres:17
DATABASE_URL=postgresql://scratch:…@127.0.0.1:5544/sora_test node scripts/migrate.mjs   # twice
docker exec -i scratch-int-efe4f266 psql -v ON_ERROR_STOP=1 -U scratch -d sora_test < db/tests/00{1,2}_*.sql
DATABASE_URL=… npm run test -w @sora/server
npm run typecheck; npm run test -w @sora/mobile; npm test -w @sora/contracts
node scripts/check-contract-parity.mjs
(cd mobile && npx expo export --platform android --output-dir <scratchpad>/export-android)
```

## Findings

- **Removed-symbol sweep:** no remaining code reference to any removed symbol (the `MIGRATIONS_DIR` hits are the scripts' own local constant; `CategoryDeleteMode` hit is the server's own type). Docs consistent. PASS.
- **F1 (fixed)** Type filter was applied on the device over loaded pages: with >50 rows and none of the chosen type on page 1, the screen said "No income in …" and never paged. Now `type` is a query argument (server and guest both filter by it), the type is part of the scope key, and an empty list still fetching shows day-card skeletons instead of the empty state. Brand-new-wallet copy no longer implies other periods have data.
- **F2 (fixed)** `ChatInputBar` resting border `borderStrong` → `borderControl` (the 3:1-checked control edge).
- **F3 (fixed)** DESIGN_GUIDELINES day card `radius.lg` → `radius.md` (matches the code the user asked for).
- **F4 (fixed)** List skeleton drew the old divider layout; now `TransactionDaysSkeleton` mirrors `TransactionDayCard` and is reused for the filter-switch loading state.
- **F5 (fixed)** Guideline "create action is the Fab" narrowed to tab list screens (Home, Planning); Category and Wallet-detail inline adds are out of its scope.
- **F6 (fixed)** `TransactionListItem`/`TransactionListItemProps` no longer exported (only `TransactionDayCard` uses them).
- **F7/F8 (fixed)** Orphaned `dayAfter` doc comment on `toAuditLogResponse` removed; double blank lines left by the `Executor` move collapsed.
- **F9/F10/F11 (fixed)** SDS diagram TanStack lines removed; API spec §2.6 states that a non-UUID path id is `404 ROUTE_NOT_FOUND`; transaction-UI plan describes the day-card `FlatList` and links `TransactionItem.tsx` (was the deleted `TransactionRow.tsx`).
- **F13 (fixed)** Dead `MONTH_NAMES`/`WEEKDAY_NAMES` in `utils/date.ts` removed, comment reworded.
- **F12 (open)** Guest AI tab shows a disabled `ChatInputBar` whose placeholder repeats the guest title — reverses 202bda7's "no input bar"; test plan TC-AI-12 was updated to match, so likely intended. Needs a product call.
- **Checked clean (by the sweep agent, re-verified where fixed):** `PathIdGuard` ordering and coverage, `RequireWalletRoleGuard` param read, transaction update guard, `dayAfter` equivalence, rules 1/13/14/15/17, MB-08, en/vi parity of new keys, dashboard `currentData`, wallet invalidation tags, ThemeToggle math, toast bar, compact money.
- **Typecheck:** contracts, server, mobile clean.
- **Tests:** mobile 613/613 · contracts 129/129 · server **222/222 including all 18 integration suites** on the scratch Postgres 17 (new: malformed path id → 404 `ROUTE_NOT_FOUND` for `/wallets/not-a-uuid`, `/accounts/not-a-uuid`, `/wallets/{id}/members/not-a-uuid`) · migrations applied twice (second a no-op) · `db/tests` probes 0 failures.
- **Parity:** 58/58. **Bundle:** Android export 7.5 MB hbc, no resolution errors.

## Fixes Applied

As listed under F1–F11, F13; each re-verified by the full re-run above (typecheck, all three suites, parity, export).

## Follow-ups

- **E2E not run here** (needs the Android emulator): the transaction list moved from `SectionList` to day cards in a `FlatList`, and the filter now queries the server — the Maestro flows must pass in CI before TC-TXN-35, TC-SYNC-20, TC-GST-09, TC-GST-18 count as covered for this code.
- **Offline trade-off of F1:** each type filter is its own cached query, so a filter never opened while online has no saved copy offline (shows the offline/error state instead of a filtered copy of "All").
- **F12** guest AI input bar — product decision.
- **Not checked on a device:** day cards, month totals, the filter-switch skeleton, ChatInputBar border, ThemeToggle, toast bar.
- Scratch container `scratch-int-efe4f266` is removed after the remaining server work in this session.
