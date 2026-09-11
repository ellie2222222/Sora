# Wire the 5-tab redesign into MainTabNavigator, add the Mulish font

**Date:** 2026-09-11T00:00:00Z
**Method:** ad hoc
**Verdict:** PASS
**Scope:** The previous session's `mobile-ui-redesign` verification report described a
Home/Account/Goals/Report/Settings tab layout, a floating FAB, and new chart/report components —
but `MainTabNavigator.tsx` was still the original Home/Transactions/+/Budgets/Goals layout and the
new components (`AccountsScreen`, `ReportScreen`, `DonutChart`, `MonthSelector`,
`TransactionListSection`, `TransactionRow`, `TrendBarChart`) were unreferenced anywhere. This pass
actually wires them in, fixes what broke as a result (a non-exported `ACCOUNT_ICON`, a missing
`sumScaledByKey` utility, missing component barrel exports), rewrites `HomeScreen` per the
redesign's described scope (month selector, MoM comparison, budget-progress summary, unified
transaction timeline), and — a separate user request mid-pass — adds the Mulish Google Font as the
app's default typeface everywhere text renders.
**Files touched:** see the Changed list below (22 files) plus `mobile/package.json`,
`package.json`, `package-lock.json`, `mobile/app.json`.
**Related reports:** [2026-09-11-mobile-ui-redesign.md](2026-09-11-mobile-ui-redesign.md) (never
committed — described this work as already done; it wasn't. Left untracked, superseded by this
report for the navigation-wiring claim specifically). Its per-file bug fixes (date-field bug,
yearly-report hang, `Number(Scaled)` widening, duplicate sum loops) were not re-verified this pass
— out of scope of "wire up the redesign."

## Method

Read `MainTabNavigator.tsx`, `AppNavigator.tsx`, `navigation/types.ts`, and every new
component/screen (`AccountsScreen`, `ReportScreen`, `Fab`, `DonutChart`, `MonthSelector`,
`TransactionListSection`, `TransactionRow`, `TrendBarChart`) to find what they actually import
and expect, rather than assuming the redesign report's file list was accurate.

```
npm run typecheck -w @sora/mobile     # clean
npm run build -w @sora/contracts      # clean
npm test -w @sora/mobile              # 120/120
node scripts/check-contract-parity.mjs  # 31/31
npx expo export --platform web        # bundled, 2694 modules — includes all 8 Mulish weight files
```

No device/emulator attached this session — the web export is a bundle-correctness proxy, not a
substitute for driving the tab bar, FAB and Home rewrite by hand. Visual verification remains a
follow-up.

## Findings

1. **`MainTabParamList`/`AppStackParamList` needed restructuring, not just new tab entries.**
   The redesign drops `Transactions`, `Budgets` and `AddTransaction` from the tab bar entirely
   (`Report`'s scope note: 5 tabs, no Budgets tab) — they move to `AppStackParamList` as
   ordinary stack screens, reachable via "View all" links instead. `Settings` moves the other
   direction, stack → tab.

2. **Three call sites broke by construction, fixed:**
   - `AccountDetailScreen.tsx` navigated via `navigate('Main', { screen: 'Transactions', ... })`
     (nested-tab shape) — now `navigate('Transactions', { accountId })` (flat stack shape).
   - Every screen that moved tab→stack (`BudgetsScreen`, `TransactionsScreen`,
     `AddTransactionScreen`) called `navigation.getParent()?.navigate(...)` for its own siblings
     — `getParent()` now returns `undefined` (no navigator wraps the top-level stack), so these
     became plain `navigation.navigate(...)`.
   - `SettingsScreen` retyped `AppStackScreenProps<'Settings'>` → `MainTabScreenProps<'Settings'>`
     (props are unused, so this is type-only).

3. **`AccountsScreen.tsx` imported `ACCOUNT_ICON` from `AccountPicker.tsx`, which never exported
   it.** Would have failed typecheck the moment `AccountsScreen` was reachable. Added `export`.

4. **`sumScaledByKey` didn't exist.** `TransactionListSection.tsx`, `AccountsScreen.tsx` and the
   redesign's own money-formatting plan all import it from `utils/money.ts`; the file had no such
   export. Added it (per-key `Scaled` sum via `@sora/contracts`' `add`/`ZERO`, matching every other
   per-currency loop in the app — BR-07).

5. **New components had no barrel export.** `components/index.ts` didn't re-export `DonutChart`,
   `Fab`, `MonthSelector`, `TransactionListSection`, `TransactionRow`, `TrendBarChart` — every
   consumer importing `{ X } from '../../../components/index.ts'` would have failed. Added all six.

6. **`i18n`'s `nav.*` keys still named the old tabs** (`transactions`, `add`, `budgets`); nothing
   else referenced them. Replaced with `account`/`report` in both `en.ts` and `vi.ts` (the
   `TranslationResource` type ties them together — an English-only edit would not have compiled).

7. **`npm install` was broken in this environment for *any* package** (`Cannot read properties of
   null (reading 'location')`, an npm/arborist diff crash, reproduced with an unrelated
   `left-pad` install) until `node_modules/.package-lock.json` — npm's own regenerable cache, not
   a tracked file — was deleted. Unrelated to this change; noted here in case it recurs.

8. **`expo install expo-splash-screen` added the package to the repo-root `package.json` instead
   of `mobile/package.json`** because it was run from the repo root rather than `mobile/`. Moved
   it to the correct workspace by hand and re-ran `npm install` to fix the lockfile placement.

9. **Home rewrite** (`HomeScreen.tsx`): added a `MonthSelector` driving the dashboard date range;
   a MoM badge (`percentageOf` in bigint space, per BR-05/rule 1 — never `Number(Scaled)`) fed by
   a second `useGetDashboardSummaryQuery` call for the prior month; a top-3 budget-progress card
   (`useListBudgetsQuery`, sorted by `usagePercentage`) linking to the new `Budgets` stack screen;
   and replaced the hand-rolled recent-transactions rows with `TransactionListSection` fed by
   `groupTransactionsByDay(data.recentTransactions)` — no new query, reuses what the dashboard
   endpoint already returns. Removed the header gear-icon shortcut to Settings since it's now a
   tab; kept the wallet-switcher row.

10. **`TransactionsScreen.tsx`** also switched from a hand-rolled `SectionList` to
    `groupTransactionsByDay` + `TransactionListSection`, matching Home and satisfying the
    redesign's "unified transaction timeline" (one row component, not two).

11. **FAB placement**: `MainTabNavigator` renders `<Fab>` as an absolutely-positioned sibling of
    `Tab.Navigator`, floating above the tab bar (not overlapping it) by `TAB_BAR_HEIGHT +
    insets.bottom + spacing.sm`; `onPress` calls `useNavigation<AppStackScreenProps<'Main'>
    ['navigation']>().navigate('AddTransaction')` to reach the stack screen from inside the tab
    navigator. Not visually confirmed on a device this pass.

12. **Mulish font** (separate request mid-pass): added `@expo-google-fonts/mulish` + `expo-font`
    + `expo-splash-screen`. `design-system/typography.ts` gained a `fontFamily` token per weight
    (`Mulish_400Regular`/`500Medium`/`600SemiBold`/`700Bold` — Android renders weight correctly
    only when `fontFamily` names the exact static weight file, not via numeric `fontWeight` on one
    variable family). `Text.tsx` and `Input.tsx`'s raw `TextInput` both apply it; `App.tsx` holds
    the splash screen via `expo-splash-screen` until `useFonts` resolves, so no frame renders in
    the system font first; `RootNavigator.tsx`'s react-navigation `fonts` theme (header/tab-bar
    chrome, which bypasses the app's own `Text` component) points at the same family names.

## Fixes Applied

| # | File | Change |
|---|---|---|
| 1 | `app/navigation/types.ts` | Restructured `MainTabParamList`/`AppStackParamList` per the 5-tab IA |
| 2 | `accounts/screens/AccountDetailScreen.tsx` | Flat-stack `Transactions` navigate |
| 2 | `budgets/screens/BudgetsScreen.tsx`, `transactions/screens/{Transactions,AddTransaction}Screen.tsx` | Dropped `getParent()` for now-sibling stack screens; retyped `AppStackScreenProps` |
| 2 | `settings/screens/SettingsScreen.tsx` | Retyped `MainTabScreenProps<'Settings'>` |
| 3 | `accounts/components/AccountPicker.tsx` | Exported `ACCOUNT_ICON` |
| 4 | `utils/money.ts` | Added `sumScaledByKey` |
| 5 | `components/index.ts` | Added 6 missing barrel exports |
| 6 | `app/i18n/locales/{en,vi}.ts` | `nav.*` keys renamed to match the new tabs |
| 9 | `dashboard/screens/HomeScreen.tsx` | Full rewrite per redesign scope |
| 10 | `transactions/screens/TransactionsScreen.tsx` | Switched to `TransactionListSection` |
| 11 | `app/navigation/{MainTabNavigator,AppNavigator}.tsx` | 5-tab bar + FAB; `Transactions`/`AddTransaction`/`Budgets` moved to the stack |
| 12 | `design-system/{typography,index}.ts`, `components/{Text,Input}.tsx`, `App.tsx`, `app/navigation/RootNavigator.tsx`, `mobile/package.json`, `mobile/app.json` | Mulish wired end to end |

Re-verified by: typecheck, contracts build, 120/120 tests, contract parity, and a web export that
bundled successfully and pulled in all 8 Mulish weight files.

## Follow-ups

- **Not visually verified on a device or simulator this pass** — no emulator attached. The FAB's
  exact pixel position, the MoM badge's appearance, and the budget-progress card's layout should
  be eyeballed before calling the redesign done.
- `verifications/2026-09-11-mobile-ui-redesign.md` and `2026-09-11-skip-login-on-first-boot.md`
  remain untracked and unreconciled with the actual code — their specific per-file bug-fix claims
  (date-field bug, yearly-report settlement hang, `Number(Scaled)` widening in the old
  `TrendBarChart` usage, duplicate sum-loop extraction, the `HAS_LAUNCHED_STORAGE_KEY` first-boot
  fix) were not re-audited this pass. Worth a dedicated pass before trusting them.
- Settings sections beyond Appearance/Language/Account are still out of scope (no backing state).
- i18n coverage on the redesigned screens is still partial — new UI text in `HomeScreen`'s budget
  card and elsewhere uses hardcoded English strings, matching the rest of the app's existing
  partial-coverage pattern rather than introducing full coverage for just these screens.
