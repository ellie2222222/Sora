# Infrastructure audit: unbounded dashboard scans, duplicated RTK-fallback boilerplate, MB-02 fully diverged

**Date:** 2026-09-16T00:00:00Z
**Method:** infra-audit skill (Phase 2 delegated to one broad scan agent, findings verified against
cited `file:line` evidence rather than re-run from scratch)
**Verdict:** PASS (read-only pass; one item — MB-02 vs. Zustand/RTK Query — needs an explicit decision,
not a fix)
**Scope:** Broad — architecture/patterns, code-level infra concerns, and operational posture across
`packages/contracts`, `server/`, `mobile/`, `db/migrations`, `.github/workflows/ci.yml`,
`docker-compose.yml`. Re-verified every open item from the prior two audits rather than assuming they
still hold.
**Files touched:** none — read-only pass.
**Related reports:** [2026-09-12-infra-audit.md](2026-09-12-infra-audit.md),
[2026-09-03-infra-audit.md](2026-09-03-infra-audit.md)

## Method

One broad scan agent, told to cite `file:line` evidence and re-verify every prior report's open items
against current code rather than carry them forward unchecked. Categories covered: duplicated patterns,
inefficient data access, dead code, scattered config, missing observability, security hardening,
CI/CD, database schema, Docker posture, design-pattern consistency (specifically checking the new
`MoneyInput`/calculator rollout across its 6 call sites), and test-coverage claims vs. reality.

## Tier 1 — quick wins (<1hr each)

1. **Dead scratch harness still present** — `server/src/verify-boot.ts` (47 lines, self-documented as
   meant to be deleted). Open since the 09-03 audit, still zero external references. Delete it.
2. **Non-sargable date filter defeats an index** — `server/src/transactions/transactions.service.ts:256,259`
   casts the indexed `transaction_date` column (`::date >= ...::date`), blocking use of
   `idx_transactions_from_account`/`idx_transactions_to_account`. `server/src/audit/audit.service.ts:93-95`
   already shows the correct pattern (compare against `timestamptz` bounds, no cast). Still open since 09-03.
3. **Duplicate shim file** — `mobile/src/hooks/useNetworkStatus.ts` (40-byte re-export) next to the real
   `useNetworkStatus.tsx`. Still open since 09-12.
4. **7 empty leftover `hooks/` directories** from the earlier RTK Query migration:
   `mobile/src/features/{accounts,budgets,categories,dashboard,goals,transactions,wallets}/hooks`.
   Still open since 09-12 (was reported as 8; one has since been cleaned up).
5. **Stray root file** — `HANDOFF.md` (untracked, 7.6KB, machine-local path reference). Still open since
   09-12. (The two other stray files from that report — `ui-design-rules-of-thumb.md`,
   `mobile/src/check_hardcoded.js` — are confirmed gone; don't re-flag.)
6. **Stale test-count doc claim** — CLAUDE.md's Dev Commands table says contracts run "61 tests"; actual
   is 63 (`calc.test.ts` + `money.test.ts` + `schemas.test.ts`). Cosmetic, but this file otherwise
   claims mechanical accuracy.
7. **Dev-only compose credentials** — `docker-compose.yml:61` (`PGADMIN_DEFAULT_PASSWORD` defaults to
   `admin`) and the `adminer` service (lines 70-77) has no auth gate at all. Low severity — this compose
   file is documented-optional, dev-only (CLAUDE.md rule 10) — but worth requiring the env var with no
   default instead.

## Tier 2 — strategic (1-2 days each)

8. **Unbounded transaction-history scans on every dashboard/balance/budget read, still open** —
   BR-05 requires re-deriving on every read, but the SQL doesn't narrow first:
   - `server/src/dashboard/dashboard.service.ts:128-139` (`periodActivity`) — fetches every `COMPLETED`
     income/expense transaction for the wallet's accounts with no date filter in SQL; filters
     `dateFrom`/`dateTo` in a JS loop (lines 141-143).
   - `server/src/dashboard/dashboard.service.ts:343-348` (`activeBudgets`) — fetches every `EXPENSE`
     transaction for the relevant categories with no status filter, so the purpose-built partial index
     `idx_transactions_budget_scan` (`db/migrations/001_initial_wallet_schema.sql:258-260`) can't be
     proven satisfied and goes unused.
   - `server/src/accounts/balance.service.ts:138-146,185-190` — every transaction ever touching an
     account, summed in JS, on every balance/dashboard call.
   Grows unbounded with a wallet's history. Fix: push the date/status window (and aggregation where
   possible) into SQL; keep `calc.ts` as the authority for *what* counts, let Postgres do the filtering.
9. **Missing composite index on the hottest guarded-request query** —
   `server/src/wallets/wallet-access.service.ts:55-60` runs
   `SELECT role FROM wallet_members WHERE wallet_id=? AND user_id=? AND status=?` on every guarded
   request to any wallet resource. Only single-column indexes exist
   (`idx_wallet_members_wallet`, `idx_wallet_members_user` — `001_initial_wallet_schema.sql:96-97`).
   Add a migration with a composite `(wallet_id, user_id, status)` index.
10. **RTK-Query guest/offline-fallback boilerplate duplicated verbatim across ~7 api slices** — the
    identical shape (check `selectIsGuest` → check `isCurrentlyOnline()` → try HTTP → catch
    `isNetworkError` → fall back to guest impl) is independently reimplemented in
    `mobile/src/app/store/api/{accountsApi.ts:24-33, categoriesApi.ts:19-28, goalsApi.ts:22-31,
    transactionsApi.ts:20-29, walletsApi.ts:22-31, budgetsApi.ts:19-36, membersApi.ts}`. Extract to a
    shared `withGuestFallback(queryFn, guestFn)` helper in the already-shared `apiSlice.ts`.
11. **Duplicated "add account" form across a modal and a full screen** —
    `mobile/src/features/accounts/components/AddAccountModal.tsx` (opened from `AccountsScreen.tsx:174,200`
    via `ModalProvider`) and `mobile/src/features/accounts/screens/AddAccountScreen.tsx` (a full-screen
    route from `WalletDetailScreen.tsx:142,160`) are near-byte-identical — same fields, same validation,
    same new `MoneyInput` usage — differing only in `onClose()` vs. `navigation.goBack()`. Both are live,
    not dead. Consolidate into one form component parameterized by a `close` callback. **This is the one
    genuine inconsistency found in this session's `MoneyInput`/calculator rollout** — every other call
    site (`AddBudgetModal`, `AddGoalModal`, `AddContributionModal`, `AddTransactionModal`) is consistent,
    no half-migrated site found.
12. **Transaction audit rows written outside the financial transaction, and serially** —
    `server/src/transactions/transactions.service.ts:212-231` (`auditTransaction`) loops
    `for (const walletId of walletIds) { await this.audit.record({...}) }` with no `trx` passed — a
    crash between the financial write and the audit insert loses the record, and a cross-wallet
    transfer's two audit inserts run serially instead of via `Promise.all`. Every other domain (wallets,
    invitations, categories) passes `trx` correctly; transactions is the outlier despite being the
    highest-value trail (LA-02).
13. **`RateLimitService` state never expires** — `server/src/common/rate-limit.service.ts:32-33`; the
    `windows`/`failures` Maps only clear a key lazily when that same key is hit again. A wide spread of
    distinct IPs/emails grows both maps unboundedly for the process lifetime. No sweep/TTL eviction.
14. **MB-02 has now fully diverged from CLAUDE.md, further than the 09-12 audit found — needs your
    decision, not a silent fix.** CLAUDE.md Part 6/MB-02 still states "Server state is TanStack Query;
    UI state is Zustand." Current reality: `@tanstack/react-query` has exactly 2 remaining call sites in
    all of `mobile/src` (`AuthProvider.tsx`, `QueryProvider.tsx`); all ~12 domain api slices are RTK
    Query. **Zustand is not a dependency anymore at all** (`grep zustand mobile/package.json` → no
    match). This isn't "in flight" as the 09-12 report characterized it — RTK Query adoption is
    essentially complete and Zustand was removed outright, not migrated away from gradually. CLAUDE.md's
    own rule ("code does not lead, specs do") means this needs an explicit update to MB-02 to describe
    reality, since reverting is no longer realistic with Zustand gone entirely.

## Tier 3 — debt (2+ days), unchanged from prior audits, re-verified still true

No mobile error boundary/crash reporting anywhere (`grep -i "errorboundary|sentry|bugsnag|crashlytics"
mobile/src` → zero matches); BR-07 currency-consistency `CHECK` constraints still unprobed in
`db/tests/`; server test suite still covers only route-mounting (`server/test/routes.test.ts`), no
role-matrix/404-vs-403/audit-row assertions; no lint tooling anywhere (`"lint"` script is a no-op, no
eslint config in the tree); `main.ts` CORS has no origin allowlist, no helmet, no body-size limit
(confirmed via direct read); connection pool has no `idleTimeoutMillis`/`connectionTimeoutMillis`/
`statement_timeout` (confirmed via direct read of `database.service.ts:14-24`).

## Checked and confirmed clean — no action needed

- `docker-compose.yml`/`server/Dockerfile`: non-root user, multi-stage build, no hardcoded prod secrets.
  Missing a `HEALTHCHECK` on the `server` container and a restart policy on any service, but this is the
  documented-optional compose file (CLAUDE.md rule 10), not the primary workflow.
- `.github/workflows/ci.yml`: no job-level `hashFiles()` footgun (rule 8 not reintroduced), sensible job
  ordering, `cache: npm` on every job.
- Schema constraints — `uq_wallet_single_owner`, `excl_budget_overlap`, `uq_wallet_invitation_open` all
  present exactly as CLAUDE.md claims.
- **NativeWind color drift, previously flagged (09-12) — now resolved, not drift.**
  `mobile/tailwind.config.js:1-14`'s own comment explains color is deliberately absent from the Tailwind
  config because theme color is picked at runtime (5 palettes × 2 modes); only layout tokens
  (spacing/radius/fontSize) go through Tailwind. NativeWind adoption is also no longer zero: 60 `.tsx`
  files now use `className=`.
- `webpage/` uncommitted-work finding (09-12) no longer applies — `git status --porcelain webpage/` is
  clean.
- `mobile/src/utils/derive.ts` (flagged 09-03 as a dead duplicate) — confirmed deleted.
- Every `MoneyInput` call site (`AddAccountScreen`, `AddAccountModal`, `AddBudgetModal`, `AddGoalModal`,
  `AddContributionModal`, `AddTransactionModal`) correctly uses the new component — the only issue found
  is the pre-existing screen/modal duplication in Finding 11, not inconsistent adoption of the new one.
- LA-01/LA-03/LA-04, parameterized SQL, rate-limit *presence* (not its unbounded-memory shape, Finding
  13) — all re-confirmed clean per the 09-03 audit's own findings, nothing in touched areas regressed.

## Fixes Applied

None — read-only pass per the infra-audit skill's own framing. Finding 14 (MB-02) is explicitly a
decision for you, not something to resolve unilaterally.

## Follow-ups

**Tier 1** — items 1-7 above; all cheap, no architectural risk.

**Tier 2 — needs your decision or scheduling**
- **Finding 14 (MB-02 vs. reality)** is the highest-priority item: update CLAUDE.md's MB-02/Part 6 to
  say RTK Query + Redux Toolkit, since Zustand is gone as a dependency, not just underused.
- Finding 11 (duplicated add-account form) is worth folding into any future accounts-feature touch,
  since it's the one drift point from an otherwise consistent `MoneyInput` rollout.
- Findings 8, 9, 10, 12, 13 — schedule independently; none block each other.

**Tier 3** — unchanged debt list above, still the current record for those areas.
