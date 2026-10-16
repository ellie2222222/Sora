# Year Overview gets the income/expense/net card; reads stop waiting on the offline cache

**Date:** 2026-10-16T08:02:19Z
**Method:** ad hoc
**Verdict:** PASS
**Scope:**
- the yearly Overview (it had no income/expense/net card);
- lag and repeat fetching across reads: what the RTK cache holds, how long, and what each read waits on;
- Metro's `country-flag-icons` export warnings.

**Files touched:**
- `mobile/src/app/store/api/{signedInRead.ts, signedInRead.test.ts, apiSlice.ts}`, `mobile/src/app/store/index.ts`
- `mobile/src/features/dashboard/{components/PeriodReport.tsx, components/YearlyTrend.tsx (new), components/YearlyReport.tsx (removed), screens/DashboardScreen.tsx, utils.ts}`
- all ten `mobile/src/app/i18n/locales/*.ts` (`dashboard.monthByMonth`)
- `mobile/metro.config.js`, `plans/architecture/dashboard-current-state.md`

**Related reports:** `2026-10-16-double-check-ai-chat-net-worth.md`

## Method

```
npm run typecheck -w @sora/mobile
npm run test -w @sora/mobile
cd mobile && npx expo export --platform android --output-dir <scratchpad>/expo-export   # log grepped for country-flag-icons
```

## Findings

1. **The yearly Overview rendered `YearlyReport`** (chart and budgets only), not `PeriodReport`, so it had no `IncomeExpenseSummary` or `PeriodInsights`.
   - Fix: the yearly view now goes through `PeriodReport`. It makes one query for the year and one for the year before, and shows the card and insights.
   - `YearlyTrend`, the month-by-month chart, loads behind them.
   - Budgets now come from the year's response, which the server evaluates at `dayInPeriod(today, …)`. They used to come from December's response, which picks a future month's day for the current year.
2. **Every signed-in read awaited the offline-copy write** (`JSON.stringify`, then `put`, then `prune` in SQLite) before the screen got its data.
   - Fix: the save runs in the background.
   - Test: `signedInRead.test.ts` "answers without waiting for the save" (the save never resolves before the read returns).
3. **No `keepUnusedDataFor` was set,** so RTK's 60 s default dropped any read left for a minute.
   - Fix: raised to 300 s. Freshness is unchanged: writes invalidate their tags, and the sync engine refreshes everything on foreground and reconnect.
4. **`refetchOnFocus`/`refetchOnReconnect` and `setupListeners` did nothing.** RTK attaches them only when `window.addEventListener` exists, and React Native has none. `syncEngineRuntime.ts` already does both through AppState and NetInfo. → removed
5. **Stepping to the next period always started cold.** The previous window was already read for the comparison; the next one wasn't.
   - Fix: `PeriodReport` prefetches the next window when it isn't in the future.
   - I chose this over keeping the old figures on screen while loading: that would show last period's money under the new period's label.
6. **Metro warned once per flag import.** `country-flag-icons/string/3x2/package.json` is a nested package whose `exports` lists only `.`. Metro treats it as the package root, although the root package exports every flag.
   - Fix: `metro.config.js` resolves `country-flag-icons/string/3x2/<CODE>` straight to the file.
   - The barrel import would have bundled all flags (562 KB).
7. `yearOf` (`features/dashboard/utils.ts`) was left without a caller → removed.

## Fixes Applied

| Check | Result |
|---|---|
| `npm run typecheck -w @sora/mobile` | 0 errors |
| `npm run test -w @sora/mobile` | 749 pass, 0 fail (+1 new test; locale parity included) |
| `expo export --platform android` | exit 0, 3831 modules, 7.9 MB; 0 `country-flag-icons` lines in the log (previously one WARN per flag) |

## Follow-ups

- **On-device check not run** (no emulator in this session):
  - the year card above the chart;
  - the chart skeleton while the 12 months load;
  - stepping a period back and forward with no skeleton.
- **No lag timing measured.** The two causes fixed here were found by reading the code, not by profiling.
