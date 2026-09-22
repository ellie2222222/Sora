# Dashboard roadmap Tier A, Phases 0-6 implemented

**Date:** 2026-09-22T18:30:13Z
**Method:** ad hoc (implementation pass, verified with the repo's own typecheck/test/parity commands)
**Verdict:** PASS — with two scope exclusions and one limitation, all stated below rather than glossed
**Scope:** The "Implementation breakdown (Tier A, phased)" section of
[plans/architecture/dashboard-feature-roadmap.md](../plans/architecture/dashboard-feature-roadmap.md) —
Phases 0 through 6. Tier B (needs a migration) and Tier C (conflicts with an SRS §1.6 decision)
were **not** touched: each needs something this pass had no mandate to do.
**Files touched:** `packages/contracts/src/{calc,responses}.ts`, `packages/contracts/test/calc.test.ts`,
`server/src/dashboard/dashboard.service.ts`, `docs/API_SPECIFICATION.md`,
`mobile/src/services/guest/guestDashboard.ts`,
`mobile/src/utils/{date,dashboardAnalytics,dashboardPeriod,index}.ts` + three new test files,
`mobile/src/components/{TrendBarChart,WaterfallChart,index}.ts(x)`,
`mobile/src/features/dashboard/screens/DashboardScreen.tsx`,
`mobile/src/features/dashboard/components/` (6 new files),
`mobile/src/app/i18n/locales/*.ts` (all 10),
`plans/architecture/{dashboard-feature-roadmap,dashboard-current-state}.md`
**Related reports:** [2026-09-22-dashboard-reports-rename-double-check.md](2026-09-22-dashboard-reports-rename-double-check.md)
(the rename that made `DashboardScreen` the name it is), [2026-09-21-infra-audit.md](2026-09-21-infra-audit.md)
(source of the unbounded-scan finding this pass widens — see Follow-ups)

## Method

Built each phase in the order the roadmap lists, backend-first so the mobile work consumed the
finished contract rather than being rewritten around it. Verified with this repo's real commands:

```
npm run build -w @sora/contracts
npm run typecheck                      # all three workspaces
npm test -w @sora/contracts
npm test -w mobile
npm test -w @sora/server
node scripts/check-contract-parity.mjs
```

## Findings

1. **Phase 0 (budgets/goals) — built.** `activeBudgets`/`activeGoals` were already in the
   response and simply not rendered. `BudgetGoalSummary` renders both as capped previews
   (3 each, "+N more") reusing the existing shared `ProgressBar` rather than re-deriving a bar,
   tapping through to `BudgetDetail`/`GoalDetail`. Returns `null` when both arrays are empty,
   so an empty state is a clean absence rather than a blank gap (MB-07).
2. **Phase 1 (granularity) — built.** `startOfWeek`/`endOfWeek`/`startOfQuarter`/`endOfQuarter`/
   `startOfYear`/`endOfYear`/`addWeeks`/`addQuarters`/`quarterOf` added to `date.ts`; window
   arithmetic in a new `dashboardPeriod.ts`; the screen's `Period` went from
   `'monthly' | 'yearly'` to all five. The server needed no change — `dashboardQuerySchema`
   already took free-form dates, exactly as the roadmap predicted.
3. **Phase 2 (ranking/top-N/change) — built**, client-side from the two windows already fetched.
   `rankCategories` returns rank + change-vs-previous; a category absent from the comparison
   period is flagged `isNew` with `changePercent: null` rather than being reported as "+100%",
   which would be an invented figure.
4. **Phase 3 (hierarchy) — built.** `CategorySpendSlice.parentId` added to the contract, selected
   in `spendingByCategory`'s existing `categories` lookup (one more column, no migration), and
   mirrored in the guest dashboard. `groupByParent` rolls the breakdown up one level in the UI.
   The donut still draws from the flat slices — its arcs come from the server's own `percentage`,
   and re-deriving them from a rollup risks chart and legend disagreeing.
5. **Phase 4 (transfers) — built, and this is the BR-06-critical one.** `transferredIn`/
   `transferredOut` added to `DashboardResponse`, never folded into `income`/`expense`/`net`.
   **Design decision worth flagging:** a transfer between two of the wallet's *own* accounts
   counts in *neither* figure. Counting it as both would inflate each by the same amount for
   money that never crossed the wallet boundary — the same reasoning BR-06 applies to
   income/expense. Only cross-wallet transfers (BR-02) have a direction here. This is documented
   in the contract, in API spec §14.1, and asserted by a test named for it.
6. **Phase 5 (member split) — built.** `spendingByMember` groups the same rows by
   `created_by_user_id` via a `users` join `periodActivity` did not previously have. Access
   check, per the roadmap's own instruction to confirm rather than assume: a wallet `VIEWER` can
   already read every transaction *and its `createdBy`* through §11.1, so attribution exposes no
   information the role did not already carry. Noted in §14.1. The widget renders only for 2+
   members — "you: 100%" is noise on a solo wallet.
7. **Phase 6 (charts) — built except §35.** New `WaterfallChart` (plain Views, matching
   `TrendBarChart`'s no-chart-library approach) fed by `CashFlowCard`. Per the roadmap's
   "check whether the existing components can take a variant prop first", `TrendBarChart` gained
   `variant: 'paired' | 'stacked'` and `showLabels` rather than a second component.
   **§35 (financial calendar view) was not built** — it shares no data or component surface with
   the rest of the phase and is a whole new screen and route.
8. **Shared predicates instead of a third copy of BR-06.** `countsAsPeriodActivity` and
   `transferDirection` live in `@sora/contracts` and are used by both `dashboard.service.ts` and
   `guestDashboard.ts`. The guest mirror previously re-implemented the income/expense rule
   inline; it now shares the predicate, so the two cannot drift (rule 7).
9. **Cross-currency summing avoided twice.** Ordering members by spend needed a comparison key;
   summing each member's currencies would have produced exactly the meaningless figure BR-07
   forbids, so `peak()` takes the largest *single* currency as an ordering key only, never a
   reported value. `CashFlowCard` likewise scopes to one currency rather than stacking two.
10. **BR-05 held.** No figure added here is stored; every one is derived per request.

## Fixes Applied

Four self-caught errors during the pass, each re-verified by re-running the check that caught it:

- `memberSlices` first sorted on a `CurrencyLedger.total()` that does not exist *and* would have
  summed across currencies (BR-07). Replaced with `peak()` + an explicit comment on why it is a
  max and not a sum. Re-verified: `npm run typecheck -w @sora/server` clean.
- `transferDirection` was called with a snake_case DB row against a camelCase contract type —
  caught by the server typecheck, fixed by mapping the four fields at the call site.
- The screen grew a local `changeOf` duplicating the already-tested `changeAgainst`. Deleted and
  replaced with the shared helper before it could become a second implementation.
- `Money` does not accept `tone` (it colours by transaction type); four usages in
  `BudgetGoalSummary` passed it. Caught by typecheck, removed.

Two test assertions were wrong rather than the code, and were corrected once understood:
`parseDay`'s two distinct fallback paths (no-dash → today, dash-shaped → 1970 per part), and a
`changeAgainst` case that used a 16-digit amount `DECIMAL(19,4)` does not admit.

**Verification results:**

- `npm run typecheck` — clean, all three workspaces.
- `npm test -w @sora/contracts` — **73/73** (was 63; +10 for the two new predicates).
- `npm test -w mobile` — **212/212** (was 165; +47 across `date`, `dashboardPeriod`,
  `dashboardAnalytics`).
- `npm test -w @sora/server` — 11/11, which boots the DI graph and so proves the rewritten
  service is still constructible.
- `node scripts/check-contract-parity.mjs` — 31/31.

## Follow-ups

- **Not exercised against a real database or a running app.** No Postgres role and no device were
  available in this session, so the new SQL (the `users` join, the `parent_id` column, the
  widened row set) is verified by typecheck and by the DI boot only — *not* by observing a real
  `GET /dashboard` response. The member-split reconciliation the roadmap asked for ("the split
  adds up to the wallet-level totals") is enforced structurally, by both paths sharing
  `countsAsPeriodActivity`, but has **not** been observed on real rows. This is the largest gap
  in this report and the first thing to do with database access.
- **No component tests.** `mobile/package.json`'s test script is `node --test "src/**/*.test.ts"`
  — `.ts` only, no JSX transform, no React renderer — so the roadmap's "component test asserting
  the cards render" (Phase 0 step 4, Phase 6 step 4) is not possible as written. Every piece of
  logic worth testing was moved into plain `.ts` helpers and tested there instead; the `.tsx`
  files are wiring. Adding a real component-test setup is its own decision, not something to
  slip into this pass.
- **The unbounded-scan finding from [2026-09-21-infra-audit.md](2026-09-21-infra-audit.md) is now
  wider.** `periodActivity` used to exclude `TRANSFER` in SQL; it must now read those rows too.
  Same unbounded shape, larger row set. Still Tier 2 in that audit, still open, now slightly
  more expensive — recorded in
  [dashboard-current-state.md](../plans/architecture/dashboard-current-state.md)'s Known Issues.
- **§35 (financial calendar view)** remains unbuilt, as does everything under "Not phased here"
  (§5, §8, §9-partial, §10-11, §16-17, §32, §38, §40). Tier B and Tier C untouched.
- **No SRS user story was written.** The roadmap's own workflow line asks for one per phase.
  These phases add no new endpoint and no new business rule — they render and split figures the
  spec already defines — so `docs/API_SPECIFICATION.md` §14.1 was updated (the contract did
  change) and SRS.md was not. If that call is wrong, SRS §9's dashboard stories are where the
  five granularities and the member split would go.
