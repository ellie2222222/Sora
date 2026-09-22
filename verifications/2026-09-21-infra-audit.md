# Infrastructure audit: re-verification of 09-16's findings + two new duplication findings from this session's rename/redesign

**Date:** 2026-09-21T00:00:00Z
**Method:** infra-audit skill (Phase 2 delegated to one broad scan agent: re-verify every numbered
finding from the prior audit against live code, plus scan this session's new work for new issues)
**Verdict:** PASS (read-only pass). 1 of 14 prior findings closed since 09-16 (Finding 14, MB-02),
1 more (`HANDOFF.md`) already resolved; 12 still open, re-confirmed live; 2 new Tier-2 duplication
findings from this session's own changes.
**Scope:** Broad — whole repo, per the user's explicit choice. Weighted toward re-verifying
[2026-09-16-infra-audit.md](2026-09-16-infra-audit.md)'s open items against current code (five days
and a large rename/redesign session have passed since) rather than re-discovering the whole repo
from scratch, plus a targeted scan of what this session's cancelled→deleted rename and
`AddTransactionModal` redesign introduced.
**Files touched:** none — read-only pass.
**Related reports:** [2026-09-16-infra-audit.md](2026-09-16-infra-audit.md),
[2026-09-12-infra-audit.md](2026-09-12-infra-audit.md),
[2026-09-03-infra-audit.md](2026-09-03-infra-audit.md),
[2026-09-21-add-transaction-redesign-double-check.md](2026-09-21-add-transaction-redesign-double-check.md)
(already covers correctness of the new files; this pass covers their architectural shape instead)

## Method

Read `CLAUDE.md` fresh. One scan agent re-verified all 14 numbered findings plus the Tier-3 debt
list from the 09-16 report against live code (not trusted from the old report), then scanned this
session's new/changed files (migration 004, the transaction status rename across
server/contracts/mobile, `AddTransactionModal.tsx`'s redesign, `CategoryGrid.tsx`) for new
infra-shaped issues. I re-checked its two new findings' cited line ranges myself before writing
them up.

## Closed since 2026-09-16

- **Finding 14 — MB-02 vs. reality.** `CLAUDE.md`'s MB-02 now reads "Server state is Redux
  Toolkit's RTK Query... `zustand` is not a dependency of this app" — matches
  `grep zustand mobile/package.json` (no match). This was flagged as needing an explicit decision;
  it's since been made and the doc updated (likely the `07816d4` "Reconcile SRS, SDS, the API spec
  and CLAUDE.md..." commit). Nothing further to do.
- **`HANDOFF.md`** (Tier 1, finding 5) — confirmed gone.

## Still open — re-verified live, unchanged since 2026-09-16

**Tier 1 (quick wins, <1hr each):**
1. `server/src/verify-boot.ts` — still present, self-documented as meant to be deleted.
2. `server/src/transactions/transactions.service.ts:256,259` — still casts
   `transaction_date::date`, defeating the account-scoped indexes.
3. `mobile/src/hooks/useNetworkStatus.ts` — still a duplicate shim next to `.tsx`.
4. 7 empty `mobile/src/features/*/hooks` directories — still present.
6. `CLAUDE.md`'s Dev Commands table still says contracts run "61 tests"; actual is 63.
7. `docker-compose.yml:61`'s `PGADMIN_DEFAULT_PASSWORD:-admin` default and the unauthenticated
   `adminer` service — unchanged.

**Tier 2 (strategic, 1-2 days each):**
8. Unbounded transaction-history scans on every dashboard/balance/budget read
   (`dashboard.service.ts` `periodActivity`/`activeBudgets`, `balance.service.ts`) — unchanged,
   not touched by this session's rename.
9. No composite `(wallet_id, user_id, status)` index on `wallet_members` for the hottest
   guarded-request query — still only single-column indexes.
10. RTK-Query guest/offline-fallback boilerplate still duplicated verbatim across ~7 api slices
    (94 matching call sites now, per a fresh grep) — no shared `withGuestFallback` helper yet.
11. `AddAccountModal.tsx`/`AddAccountScreen.tsx` still near-byte-identical duplicate forms —
    neither touched this session.
12. `transactions.service.ts:212-231` `auditTransaction` — still loops writes with no `trx`,
    serially. See "New findings" below: the new `TRANSACTION_DELETED` event now also exercises
    this same pre-existing gap.
13. `rate-limit.service.ts:32-33` — `windows`/`failures` Maps still only clear lazily, no TTL sweep.

**Tier 3 (debt), re-verified still open:** no mobile error boundary/crash reporting; no lint
tooling (root `lint` script delegates to workspaces, but `mobile/package.json` has no `lint` script
and no eslint config exists anywhere in the tree); server test suite still only covers route
mounting + exchange-rate service, no role-matrix/404-vs-403 assertions; `main.ts` CORS still has no
origin allowlist, no helmet, no body-size limit; connection pool still has no
`idleTimeoutMillis`/`connectionTimeoutMillis`/`statement_timeout`. **One correction to the 09-16
report's phrasing**: BR-07 currency constraints are *partially* probed — `db/tests/001_constraints.sql`
has a lowercase-currency-code test — but nothing asserts the transaction/transfer
currency-*mismatch* `CHECK` constraints actually reject a mismatch, so the debt item stands, just
narrower than "entirely unprobed."

## New findings from this session's changes

**Tier 2 — 15. `CategoryGrid.tsx` and `CategoryPicker.tsx` duplicate more than a comment.**
`mobile/src/features/categories/components/CategoryGrid.tsx:30-39` and
`CategoryPicker.tsx:24-37` both call `useListCategoriesQuery({walletId, type, status: 'ACTIVE'})`
and independently reimplement an identical "default to first category" `useEffect` (same guard,
same `onChange(first.id)`) — this is real duplicated *logic*, not just the duplicated comment
already flagged in [2026-09-21-comment-audit-repo-wide.md](2026-09-21-comment-audit-repo-wide.md).
A shared `useCategoryDefaulting`/`useCategorySelection` hook would remove the duplication and the
risk of the two copies drifting if the default-selection rule ever changes. Related to Finding 10's
shape (a repeated data-fetch-plus-behavior pattern with no shared hook yet).

**Tier 2/3 — 16. `AddTransactionModal.tsx` reimplements `MoneyInput.tsx`'s whole expression-state
engine standalone.** `AddTransactionModal.tsx:41-139` duplicates the same `HAS_OPERATOR` regex, the
same `expressionRef` pattern, the same `useMemo(() => tryEvaluate(expression))`, and the same
two-stage commit rule as `MoneyInput.tsx` (the code's own comment at line 70 says "Mirrors
MoneyInput's own rule"). This was a deliberate choice made during the redesign (`MoneyInput` is
focus-gated/docked; this screen's keypad is always-visible, a genuinely different interaction
shape — see the double-check report's Finding on this), but it's ~60 lines of parallel logic that
can now drift from `MoneyInput`'s commit rule independently. Worth a `useCalculatorExpression`
extraction if a third call site with this shape ever appears; not urgent with just two.

**Checked, no new issue:** migration 004 only relabels the `CHECK` constraint value — no query
filters on `status = 'DELETED'`, so no new index gap; the delete path's audit write
(`transactions.service.ts:444-462`, `AUDIT_EVENTS.TRANSACTION_DELETED`) goes through the exact
same pre-existing untrusted-loop gap as Finding 12, not a new or worse instance of it.

## Checked and confirmed clean (from 09-16, still true)

Not re-litigated in detail — nothing in this session's changes touched: Docker posture, CI job
ordering, schema exclusion/unique constraints, NativeWind color handling. See
[2026-09-16-infra-audit.md](2026-09-16-infra-audit.md)'s own "Checked and confirmed clean" section.

## Fixes Applied

None — read-only pass per the skill's own framing.

## Follow-ups

**Tier 1** — items 1, 2, 3, 4, 6, 7 above (finding 5 and 14 now closed, drop from future carry-forward).

**Tier 2** — items 8, 9, 10, 11, 12, 13 (unchanged), plus the two new findings (15, 16) from this
session. None block each other; 15 and 10 could reasonably be tackled together (both are "extract
a shared RTK-Query-adjacent hook" shaped work).

**Tier 3** — unchanged debt list, still the current record for those areas.
