# Comment audit of the Dashboard redesign, Home period card and Metro config

**Date:** 2026-10-09T03:13:58Z
**Method:** ad hoc (comment-audit skill)
**Verdict:** PASS
**Scope:** every comment in the 20 files `2026-10-09-dashboard-redesign-double-check.md` covers:

- `mobile/src/components/{SectionLabel,PeriodBar,ActionSheet,OtherCurrencies,PeriodSummaryCard,TrendBarChart}.tsx`
- `mobile/src/design-system/sizes.ts`
- `mobile/src/features/accounts/components/{AccountScopePicker,AccountsOverview}.tsx`
- `mobile/src/features/dashboard/components/{IncomeExpenseSummary,MemberSplit,YearlyReport,PeriodReport,PeriodInsights,CategoryBreakdown,BudgetGoalSummary}.tsx`
- `mobile/src/features/dashboard/screens/DashboardScreen.tsx`
- `mobile/src/app/navigation/MainTabNavigator.tsx`
- `mobile/src/features/settings/screens/SettingsScreen.tsx`
- `mobile/metro.config.js`
- `amountInCurrency` in `packages/contracts/src/calc.ts`

**Files touched:**

- `mobile/src/components/PeriodSummaryCard.tsx`
- `mobile/src/features/dashboard/components/MemberSplit.tsx`
- `mobile/metro.config.js`

**Related reports:**

- `2026-10-09-dashboard-redesign-double-check.md`
- `2026-10-08-comment-audit-home-filters.md`

## Method

- **Policy:** CLAUDE.md Part 7 rule 11: why not what, 1–2 lines, no debug journal, `TODO` only with a reference.
- **Comments listed:** `grep -nE '^[[:space:]]*(//|/\*|\*)|\{/\*'` over each file. Every hit was read in context.
- **Comment-only check:** each edit's old and new text differ only in comment lines. Then `npm run typecheck -w @sora/mobile` (exit 0), `npm run test -w @sora/mobile` (689/689), and `cache-limit-check.cjs` re-loaded `metro.config.js` (store wrapped, peak 512).

## Findings

1. **`metro.config.js:28-29`: stale and wrong.**
   - The comment said the `tsc --watch` churn through the watched root "exhausted Metro's file handles (EMFILE)".
   - The double-check showed the EMFILE came from Metro's unbounded cache reads. Watch handles don't count toward the C runtime's 8,192 open-file limit.
   - Rewritten to keep the real reason for the blockList (Metro would otherwise re-index `server/dist` on every save).
2. **`metro.config.js:38-39`: count claim and symptom history** (patterns 7 and 4).
   - It said "a bundle of ~3,000 modules crossed it … and crashed the server".
   - Rewritten as the constraint: "a cold bundle can cross it (EMFILE) and crash the server".
3. **`PeriodSummaryCard.tsx:30-35`: five lines condensed to two** (pattern 6). Kept the headline-currency layout and why Expenses leads. Dropped the trailing clause about competing totals, which restated the layout.
4. **`MemberSplit.tsx:14-21`: two paragraphs condensed to two lines** (pattern 6). Both reasons kept: noise on a solo wallet, and no extra request.
5. **`MemberSplit.tsx:34`: missing comment, added.**
   - The `?? largestCurrencyTotal(member.expense)` fallback, combined with `relative = 0` when the currency differs, looks like a bug without its reason.
   - Added: a member who spent only in another currency still shows that figure, but no bar, since it shares no scale.
   - Source: the double-check's BR-07 fix in this same session (report finding 7).
6. **Kept, each a real why:**
   - `PeriodBar.tsx:33` (rule 15 reference), `:36` (why next stops at the current window);
   - `TrendBarChart.tsx:21`;
   - `sizes.ts:39`;
   - `AccountScopePicker.tsx:45,72`;
   - `AccountsOverview.tsx:78,124,161,193,267`;
   - `IncomeExpenseSummary.tsx:22,56,177`;
   - `YearlyReport.tsx:56,76,84`;
   - `PeriodReport.tsx:47,75`;
   - `CategoryBreakdown.tsx:23,43,127`;
   - `BudgetGoalSummary.tsx:17`;
   - `DashboardScreen.tsx:32,61,122`;
   - `MainTabNavigator.tsx:29,63,168`;
   - `metro.config.js:1,13,26,45`.
7. **Kept, structural labels:**
   - `PeriodReport.tsx` `{/* IncomeExpenseSummary */}` and `{/* CategoryBreakdown */}` mark which section each skeleton block stands in for.
   - This is the same convention as `DashboardScreen.tsx:77,100`.
8. **Kept, low value but harmless:** `ActionSheet.tsx:25` "Shared bottom-sheet action list." is close to the name but is the component's only doc. Leaning to keep, per the skill.

## Fixes Applied

- `metro.config.js:28-29` and `:38-39`: rewritten.
- `PeriodSummaryCard.tsx:30-33`: condensed.
- `MemberSplit.tsx:14-17`: condensed.
- `MemberSplit.tsx:34`: added.

Re-verified with the typecheck, tests and config reload under Method.

## Follow-ups

- **Flagged, not fixed: `MainTabNavigator.tsx:82-83`** says "the same horizontal-motion treatment as `SlideSwap`". It still resolves (`SlideSwap` decelerates with `Easing.out(Easing.cubic)`), but nothing keeps the two in sync. Carried from `2026-10-08-comment-audit-home-filters.md`.
- **Flagged, not fixed: `PeriodBar.tsx:33`** points at "CLAUDE.md Part 7 rule 15". It resolves today, but would orphan if the rules are renumbered.
- **Code finding, outside a comment-only pass, fixed straight after it under the double-check:** `DashboardScreen.tsx:77`'s loading skeleton drew the scope chips above the account rows, while the redesigned screen puts them below. The chips now come after the rows, and the label reads `AccountsOverview + AccountScopePicker Mock`. Recorded in `2026-10-09-dashboard-redesign-double-check.md` finding 17.
