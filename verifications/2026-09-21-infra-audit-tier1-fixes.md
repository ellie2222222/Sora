# Infra-audit Tier 1 quick wins applied

**Date:** 2026-09-21T00:00:00Z
**Method:** ad hoc — applying the 6 still-open Tier-1 items from
[2026-09-21-infra-audit.md](2026-09-21-infra-audit.md), user-confirmed scope ("Tier 1 quick wins
only") after "fix all" was ambiguous against a report spanning cheap one-liners through multi-day
architectural work.
**Verdict:** PASS
**Scope:** The 6 still-open Tier-1 findings only — no Tier 2/3 items touched (several were
explicitly flagged as needing a decision, not a unilateral fix).
**Files touched:** see Fixes Applied below.
**Related reports:** [2026-09-21-infra-audit.md](2026-09-21-infra-audit.md) (the audit these fixes
close out), [2026-09-16-infra-audit.md](2026-09-16-infra-audit.md), [2026-09-12-infra-audit.md](2026-09-12-infra-audit.md)

## Method

Read each finding's cited file:line fresh before fixing (not trusted from the report alone).
Re-ran the relevant typecheck/test suite after each language boundary's changes.

## Fixes Applied

1. **Dead scratch harness deleted** — `server/src/verify-boot.ts` removed. Confirmed zero
   references anywhere outside `server/dist/` (stale build output, regenerates on next build) via
   a repo-wide grep for `verify-boot` across `.ts`/`.json`/`.md`/`.yml`.
2. **Non-sargable date filter fixed** — `server/src/transactions/transactions.service.ts:255-260`.
   Was `transactions.transaction_date::date >= ${filters.dateFrom}::date` (casts the indexed
   `timestamptz` column, defeating index use). Now compares the column directly against
   `timestamptz` bounds — `>= ${dateFrom}T00:00:00.000Z` and `< dayAfter(dateTo)` (exclusive upper
   bound) — mirroring the already-correct pattern in `audit.service.ts`. Added a local `dayAfter`
   helper (same implementation as `audit.service.ts`'s, not extracted to shared code — that's a
   separate, smaller-scoped decision than this quick win). Removed the now-unused `sql` import.
3. **Duplicate shim deleted** — `mobile/src/hooks/useNetworkStatus.ts` (a 1-line `export *`
   re-export of `.tsx`) removed. `App.tsx`'s import, which explicitly named the `.ts` shim, updated
   to import `./hooks/useNetworkStatus.tsx` directly. The other two call sites
   (`ConnectionSyncStatus.tsx`, `SyncSection.tsx`) already used extension-less imports and now
   resolve unambiguously to the one remaining file.
4. **7 empty `hooks/` directories deleted** — `mobile/src/features/{accounts,budgets,categories,
   dashboard,goals,transactions,wallets}/hooks`. Confirmed each was genuinely empty (0 entries)
   before removing; `features/auth/hooks` (1 entry) was correctly left alone — not one of the
   flagged directories.
5. **Stale doc claim fixed** — `CLAUDE.md`'s Dev Commands table: "money/derivation math, 61 tests"
   → "63 tests", matching `packages/contracts/test/`'s actual 3 files (`calc`, `money`, `schemas`).
6. **Dev-compose default credential removed** — `docker-compose.yml:61`:
   `PGADMIN_DEFAULT_PASSWORD: ${PGADMIN_DEFAULT_PASSWORD:-admin}` →
   `${PGADMIN_DEFAULT_PASSWORD:?set PGADMIN_DEFAULT_PASSWORD in .env}` — `docker compose up` now
   refuses to start pgadmin without the var set, rather than silently defaulting to `admin`.
   `.env.example:66` updated to match: `PGADMIN_DEFAULT_PASSWORD=admin` → blank, following the same
   documented pattern already used for `JWT_SECRET` a few lines above (a real secret never gets a
   committed example value, even a throwaway one). The `adminer` service's own lack of an auth gate
   (flagged alongside this in the original finding) was left as-is: that's inherent to the adminer
   tool itself (per-connection DB credentials, no separate login), not a compose misconfiguration,
   and this compose file is documented-optional/dev-only (CLAUDE.md rule 10).

## Verified

- `npm run typecheck -w @sora/server` — clean.
- `npm test -w @sora/server` — 11/11 (route-mounting suite; doesn't exercise the date-filter query
  against a real database — no `DATABASE_URL` configured this session, consistent with the
  standing Tier-3 gap that the server test suite has no role-matrix/query-level coverage). The
  fix's correctness rests on typecheck + matching `audit.service.ts`'s already-proven-correct
  pattern, not a live query run.
- `npx tsc --noEmit` (mobile) — clean.
- `npm test` (mobile) — 159/159.
- Dangling-reference sweep — `grep -rn "verify-boot"` (excluding `dist/`) and
  `grep -rn "useNetworkStatus.ts'"` across the repo — both empty.

## Follow-ups

- The date-filter fix (item 2) should be exercised against a real Postgres with `EXPLAIN ANALYZE`
  to confirm the account-scoped indexes are now actually used — not done this pass, no database
  access available.
- Tier 2/3 items from [2026-09-21-infra-audit.md](2026-09-21-infra-audit.md) remain open, by
  explicit choice — not in this pass's scope.
