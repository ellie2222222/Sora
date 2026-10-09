# Double-check of the Dashboard tabs change and its follow-up fixes

**Date:** 2026-10-09T04:26:50Z
**Method:** double-check skill
**Verdict:** PASS
**Scope:** the uncommitted tree. It splits the Dashboard into Overview / Spending / Accounts tabs, keys ActionSheet rows by position, and corrects SDS wording.

- Code: `DashboardScreen.tsx`, `PeriodReport.tsx`, `DashboardEmpty.tsx`, `ActionSheet.tsx`
- Locales: 10 catalogs
- Docs: `SDS.md`, `docs/DESIGN_GUIDELINES.md`, `plans/architecture/dashboard-current-state.md`

**Files touched:** mobile/src/app/i18n/locales/{vi,de,ru}.ts (Finding 12); mobile/src/features/accounts/components/AccountsOverview.tsx, mobile/src/features/dashboard/components/PeriodReport.tsx, mobile/src/features/dashboard/screens/DashboardScreen.tsx (skeleton dedupe)
**Related reports:** 2026-10-09-dashboard-tabs.md (same change, with emulator evidence; not re-driven here), 2026-10-09-dashboard-redesign-double-check.md

## Method

- `git status --short`
- `git log -1 -- CLAUDE.md aif-sdlc-checklist.md docs/DESIGN_GUIDELINES.md` → `9545744`. The rules are unchanged since that commit.
- `grep` for ID and symbol references (exact patterns under Findings 1–2).
- `node scratchpad/unused-imports.mjs` over the four changed files.
- Read `components/swipe/openSwipeRow.ts` and `services/guest/guestDashboard.ts:55-62`.
- Read `docs/test-plans/dashboard.md`.
- `npm run typecheck -w @sora/mobile`
- `npm run test -w @sora/mobile`

## Findings

1. **Moved or removed test IDs and symbols.** Searched `mobile/e2e`, `mobile/src`, `docs` and `plans` for:
   - `section-accounts`, `accounts-net-worth`, `btn-add-account`
   - `picker-dashboard-account`, `btn-manage-account`
   - `dashboard-empty`, `dashboard-no-spending`, `dashboard-period-error`
   - `screen-dashboard`, `PeriodReportSkeleton`

   There are no matches outside `features/dashboard` and `features/accounts`. PASS.
2. **`DashboardEmpty` callers.** Its only caller is `DashboardEmptyForWallet`, which is used by `PeriodReport` and `YearlyReport`. Both now render inside the tab pane. The new comment "Always shown inside a Dashboard tab pane" is accurate. PASS.
3. **Unused imports.** Mobile has no lint script, and its tsconfig sets no `noUnused*` flag, so this was checked mechanically. All four files report "unused: none": DashboardScreen (35 imported), PeriodReport (23), ActionSheet (6), DashboardEmpty (9). PASS.
4. **Swipe rows across tab switches.** The Accounts pane unmounts on every tab switch. `SwipeableRow` releases the open-row slot on unmount (`useEffect(() => () => releaseOpenSwipeRow(handle))`), so `closeOpenSwipeRow` never calls a dead row. PASS.
5. **Guest mode with the yearly window.** `resolvePeriod` (`guestDashboard.ts:56-62`) honours any `dateFrom`/`dateTo`. A year window works offline, as the quarter window already did. PASS.
6. **CLAUDE.md Part 7 / MB rules on the diff:**
   - **Rule 15:** `grep 'style={('` over the changed files finds nothing.
   - **MB-06:** `tokens-usage.test.ts` passes.
   - **MB-09:** locale parity and plural tests pass.
   - **MB-10:** the feature-internal import is relative (`../components/PeriodReport`).
   - **Rule 11:** the four new comments are why-only, one line each.
   - **NC-04:** the `dashboard-segment-*` IDs follow Planning's `planning-segment-*`.

   PASS.
7. **Doc drift.**
   - `docs/test-plans/dashboard.md` makes no layout claims.
   - Roadmap §41 is an untriaged suggestion.
   - `SDS.md` and `dashboard-current-state.md` match the code.

   PASS.
8. **Typecheck:** `tsc --noEmit` exits 0.
9. **Mobile tests:** 689/689 pass, 0 fail.
10. **Formatting of the earlier report.** Line 1 of `2026-10-09-dashboard-tabs.md` was reported as indented by about 87 spaces. Rechecked with `head -c 200 | cat -A`: as committed in `5a72fb6` it starts `# Dashboard split…` at column 0, so it renders as a heading. Nothing to fix.

11. **Tab-label widths in German, Russian and Vietnamese, checked on the device without writing to the database.**
    - **Why offline:** `setLocale` (`LocaleProvider.tsx:57-66`) sends `authApi.updatePreferences` once, ignores failures and never retries. So the language was switched in airplane mode (`adb shell cmd connectivity airplane-mode enable`; `ping 10.0.2.2` unreachable).
    - **Widths:** each segment is 334 px wide (`[40,218][374,307]`). The widest labels are Überblick ≈160 px, Расходы 150 px and Tài khoản 162 px. PASS.
    - **No writes:** the API access log has 0 `PATCH`/`preferences` lines after baseline line 1794, across both offline rounds and the reconnects.
    - **App state:** the app ended in English with airplane mode off.
12. **Same word for the screen and its first tab.** The device check showed the bottom-bar Dashboard label (`nav.dashboard`) equal to the new `dashboard.overviewTab` in three languages:
    - vi: Tổng quan
    - de: Übersicht
    - ru: Обзор

    The screen and its first tab had the same name. FAIL, fixed below.

## Fixes Applied

- **`overviewTab` labels changed:**
  - vi: Tổng quan → Tóm tắt
  - de: Übersicht → Überblick
  - ru: Обзор → Сводка

  The other seven already differ from `nav.dashboard` (checked by script).
- **Re-verified:**
  - On the device: the labels are Сводка, Расходы, Счета under the Обзор bottom tab, and Tóm tắt, Chi tiêu, Tài khoản under Tổng quan.
  - `npm run test -w @sora/mobile` passes 689/689.

- **Duplicated loading skeletons** (the earlier follow-up). `DashboardScreen` drew its own inline skeletons while the wallet list loaded, and they didn't match the real layout.
  - It now renders `AccountsOverviewSkeleton`, extracted from `AccountsOverview.tsx` and exported through the accounts barrel's `export *`, or `PeriodReportSkeleton({ section })`, exported from `PeriodReport.tsx`.
  - Its unused `Skeleton` import was removed.
  - **Re-verified:**
    - The unused-import scan reports none in all three files.
    - `npm run typecheck -w @sora/mobile` exits 0.
    - `npm run test -w @sora/mobile` passes 689/689.
    - The bundle Metro serves contains 8 `AccountsOverviewSkeleton` and 7 `PeriodReportSkeleton` references.
    - After a reload, the device's Accounts tab shows `section-accounts` and `accounts-net-worth`.

## Follow-ups

- **Not seen on the device:** the wallet-list loading state on the Dashboard. This is an assumption, not traced: the bottom tabs mount on first visit, which normally comes after the wallets have loaded, so the state is hard to reach by hand.
- **Carried from 2026-10-09-dashboard-tabs.md:** the cause of the Metro stall is unknown. The German/Russian width check is closed by Finding 11.
