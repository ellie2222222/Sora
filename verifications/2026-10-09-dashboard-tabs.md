# Dashboard split into Overview / Spending / Accounts tabs

**Date:** 2026-10-09T04:17:24Z
**Method:** ad hoc
**Verdict:** PASS
**Scope:** Splitting the single-scroll Dashboard into three tabs on Planning's `SegmentedControl` + `SlideSwap`: `DashboardScreen.tsx`, `PeriodReport.tsx` (new `section` prop), `DashboardEmpty.tsx`, three new locale keys ×10, and three docs
**Files touched:** mobile/src/components/ActionSheet.tsx, mobile/src/features/dashboard/screens/DashboardScreen.tsx, mobile/src/features/dashboard/components/PeriodReport.tsx, mobile/src/features/dashboard/components/DashboardEmpty.tsx, mobile/src/app/i18n/locales/{en,vi,de,es,fr,hi,ja,ko,ru,zh}.ts, plans/architecture/dashboard-current-state.md, SDS.md, docs/DESIGN_GUIDELINES.md
**Related reports:** 2026-10-09-dashboard-redesign-double-check.md (its open follow-ups are unchanged by this pass)

## Method

- `npm run typecheck -w @sora/mobile`
- `npm run test -w @sora/mobile` (includes `localeParity.test.ts`, `plurals.test.ts`, `tokens-usage.test.ts`)
- Emulator (Medium_Phone, Expo Go on `exp://10.0.2.2:8081`), wallet "Ví của An": tapped each segment, switched View by to Year and to Day, took a screenshot per state. Dashboard request windows were read from the Metro `[api]` log.

## Findings

1. **Spec review before building.** The first draft dropped `BudgetGoalSummary`, stubbed yearly Spending with an empty state, and reset the tab on wallet switch. All three changed:
   - **Budgets and goals:** removing them was a feature removal the request didn't ask for, so they stay on Overview.
   - **Yearly Spending:** `windowFor('yearly')` already exists and `dashboardQuerySchema` (`packages/contracts/src/schemas.ts:484`) has no length cap, so yearly Spending is one full-year query instead of a stub.
   - **Tab on wallet switch:** a tab isn't wallet-owned the way the account scope is, so it no longer resets.
2. **Typecheck:** `tsc --noEmit` exited 0.
3. **Mobile tests:** 689/689 passed, 0 failed, including locale parity for the three new keys.
4. **Overview (Oct 2026, Month):** shows income vs expenses, then active budgets. The switcher is pinned under the wallet bar, with the period bar and account chips below it. PASS.
5. **Spending (Oct 2026, Month):** shows the donut and category rows, then top categories. PASS.
6. **Accounts:** shows net worth, then the 7 accounts with Add account. The period bar is hidden, since balances are as of now. PASS.
7. **Spending (2026, Year):** the log shows `dateFrom 2026-01-01 → dateTo 2026-12-31` plus `2025-01-01 → 2025-12-31` for the comparison. The breakdown renders 263.86M spent across categories. PASS.
8. **Overview (2026, Year):** shows the 12-month trend chart, then budgets and goals, as before. PASS.
9. **Empty period (Oct 9 2026, Day):**
   - Spending shows only `dashboard-empty-empty-period`.
   - Overview shows the same empty state, then active budgets, as before.

   Neither has an entrance bounce inside the slide, because `DashboardEmpty` and the `PeriodReport` errors now pass `entrance="none"`. PASS.
10. **Metro:** the long-running Metro (pid 37936, up since 09:48) stopped serving bundles. `/status` answered "running", but a direct `index.bundle` request timed out after 180 s while the process burned CPU at ~11.4k handles. A restarted Metro bundled in 4 s from the warm cache. The `withOpenFileLimit` code (`mobile/metro.config.js:41-62`) always releases or hands off its slot in `finally`, so a leak would need a store call that never settles. The cause was not established; see Follow-ups.

11. **ActionSheet row key.** Carried over from 2026-10-09-dashboard-redesign-double-check.md. Rows were keyed by `action.label`, which is translated text. No current caller collides: the five period names, and the member actions at `WalletMembersPanel.tsx:80-97`. Nothing guarantees they stay unique.
12. **SDS wording.** `SDS.md:391` and `:414` said "monthly/yearly"; `DASHBOARD_PERIODS` has five granularities.

## Fixes Applied

- **ActionSheet** (`mobile/src/components/ActionSheet.tsx:34-35`): rows are now keyed by position, with a why-comment.
  - The rows hold no state and the list never reorders while the sheet is open.
  - Re-verified: `npm run typecheck -w @sora/mobile` exits 0, and `npm run test -w @sora/mobile` passes 689/689.
  - On the emulator, View by lists `dashboard-period-{daily..yearly}` with only `daily` selected. Picking Month changes the bar to "Oct 2026 · Month". `metro4.log` has 0 ERROR lines.
- **SDS** (`SDS.md:391` and `:414`): now says day-to-year and lists the five granularities.

## Follow-ups

- **Not checked on the emulator:** German and Russian tab-label widths. `setLocale` calls `authApi.updatePreferences` (`app/providers/LocaleProvider.tsx:64`), which writes the signed-in user's locale to the dev database, so this needs the user's go-ahead. The labels are ≤ 9 characters ("Übersicht", "Ausgaben", "Расходы").
- **Metro stall:** after ~80 min of uptime Metro stopped serving bundles (Finding 10). Cause unknown. If it recurs, take a CPU profile before restarting, to rule the cache limiter in or out.
