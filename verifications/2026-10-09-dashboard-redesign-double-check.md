# Dashboard redesign, Home period card and Metro open-file limit — double-check

**Date:** 2026-10-09T03:13:58Z
**Method:** double-check skill
**Verdict:** PASS
**Scope:** This session's uncommitted mobile work: the Dashboard redesign (`PeriodBar`, `ActionSheet` selected rows, `AccountScopePicker`, `AccountsOverview`, `SectionLabel`, `IncomeExpenseSummary`, the section headings, `DashboardScreen`, `MainTabNavigator`, `SettingsScreen`), the `spentMultiple` caption, `OtherCurrencies` + `PeriodSummaryCard`, the locales, and `metro.config.js`.
**Files touched:** `packages/contracts/src/calc.ts`, `packages/contracts/test/calc.test.ts`, `mobile/src/components/{ActionSheet,PeriodBar,PeriodSummaryCard,TrendBarChart}.tsx`, `mobile/src/design-system/sizes.ts`, `mobile/src/features/accounts/components/{AccountScopePicker,AccountsOverview}.tsx`, `mobile/src/features/dashboard/components/{IncomeExpenseSummary,MemberSplit,YearlyReport}.tsx`, `mobile/src/features/dashboard/screens/DashboardScreen.tsx` (prop, roles, skeleton), `mobile/src/app/i18n/locales/*.ts` (10), `CLAUDE.md`, `plans/architecture/dashboard-current-state.md`
**Related reports:** follows up `2026-10-08-home-filters-account-sheet.md` (its follow-ups on `transactions.title` and first-currency picks are resolved here)

## Method

- A read-only Explore agent swept the scoped files for:
  - dangling references to the deleted `MonthSelector`/`WaterfallChart`/`DashboardKpis`/`CashFlowCard` and their testIDs, across code, docs and `mobile/e2e`;
  - orphaned `dashboard.*`/`common.*` keys;
  - unused exports;
  - token literals;
  - function `style` on a `Pressable` (rule 15);
  - duplicated helpers;
  - first-element currency picks;
  - roles and touch targets.

  Every finding below was re-checked against the file before it was fixed.
- Commands run:
  - `npm run typecheck` (all packages)
  - `npm run typecheck -w @sora/mobile`
  - `npm run test -w @sora/mobile`
  - `npm run test -w @sora/contracts`
  - `node scripts/check-contract-parity.mjs`
- Emulator (Medium_Phone, Expo Go, Ví của An, Oct 2026), checked against `docs/DESIGN_GUIDELINES.md` Part 4:
  - Dashboard in Month view, top and the income/expense section;
  - Dashboard in Year view;
  - Home on the All and Transfer filters;
  - Dashboard and Settings in the light theme, then restored to dark.
- Metro:
  - `fd-limit.cjs` (scratch) opens one file repeatedly via `fs.promises.open` until EMFILE.
  - `cache-limit-check.cjs` (scratch) loads the real `metro.config.js` and fires 5,000 concurrent `get`s at the wrapped store.
  - A cold `npx expo start --clear` plus app reload, sampling Metro's `HandleCount` once a second.

## Findings

1. **Typecheck, all packages.** `npm run typecheck`: exit 0. PASS.
2. **Mobile tests.** 689/689 pass, including `tokens-usage`, `localeParity` and `plurals`. PASS.
3. **Contract tests.** 171/171 pass, including the new `amountInCurrency` case. PASS.
4. **Contract parity.** 65/65 parity checks pass. PASS.
5. **Dangling references.** No code imports a deleted component. Every testID used by an e2e flow resolves. Three docs were stale:
   - `CLAUDE.md:993` rule 15 cited `MonthSelector.tsx`.
   - `dashboard-current-state.md:78` described "the KPI row, cash-flow waterfall".
   - `dashboard-feature-roadmap.md:113` says "extend the period-selector `Button` row". This is a completed plan step, so it records history and was left as is.

   Fixed the first two.
6. **Orphaned keys.** `dashboard.*` and `common.*` are clean. `transactions.title` had no reference, and no `keyPrefix` use exists in `src`. It had been kept only because the inactive locales still defined it, and MB-09 now keeps all ten locales active. Removed from all ten.
7. **First-element currency picks** (BR-07):
   - `MemberSplit.tsx:31` took `members[0].expense[0]` as the leader, so bars could compare amounts in different currencies.
   - `YearlyReport.tsx:81-82` took `income[0]`/`expense[0]` per month, so one chart scale could mix currencies.
   - Fixed: `MemberSplit` scales against the members' largest expense currency. `YearlyReport` adds up each currency across the year and charts the largest.
8. **Transfers in other currencies.** `IncomeExpenseSummary` showed transfers only in the headline currency and dropped the rest. Fixed: each side now lists every currency, headline first.
9. **Duplicated helpers:**
   - two `amountIn` copies (`IncomeExpenseSummary`, `PeriodSummaryCard`);
   - a hand-rolled `net < ZERO ? negate(net) : net` that duplicates `absScaled`;
   - a format→parse round trip in `PeriodSummaryCard`.

   Fixed: `amountInCurrency` added to `packages/contracts/src/calc.ts` beside `largestCurrencyTotal` and used in all four dashboard/Home callers; `absScaled` reused; round trip removed. `pendingTotals.totalOf` is the same lookup but outside this scope; left.
10. **Token misuse.** `IncomeExpenseSummary` used `sizes.chart.minBarHeight` as a `minWidth`. Renamed the token to `minBarLength` (2 code uses plus the definition).
11. **Dead prop.** `YearlyReport`'s `navigation` prop was unused, and already unused at HEAD. Removed, along with the call-site argument in `DashboardScreen`.
12. **Accessibility:**
    - Added `accessibilityRole="button"` to `ActionSheet` rows, `btn-add-account`, account rows and `btn-manage-account`.
    - Raised touch targets to ≥44pt with `hitSlop` tokens: vertical only on the side-by-side `PeriodBar` label and chip and on the `AccountScopePicker` chips, `hitSlop.lg` on `btn-add-account` and `btn-manage-account`.
    - `PeriodBar` prev/next already reach 44pt.
13. **Rule 15 and token literals.** No function `style` on any `Pressable`. The remaining literals are animation values, a refresh delay and skeleton proportions, all allowed. PASS.
14. **Metro EMFILE:**
    - Node on this machine fails at 8,189 open files, i.e. the C runtime's 8,192 minus stdio. Metro opened every module's cache entry at once.
    - Before the fix, a warm reload peaked about 4,100 handles over an idle 11,027, and a cold `--clear` build crashed Metro.
    - After wrapping the store (`MAX_OPEN_CACHE_FILES = 512`, slot handed directly to the next waiter), 5,000 concurrent calls peak at exactly 512. The cold rebuild bundled 3,950 + 5×~3,000 modules with 0 EMFILE, peaking at 11,418 handles.

    PASS.
15. **Device.**
    - **Dashboard, Month:** net-worth hero; account rows; income/expense bars with "vs Sep 2026"; Net reads "You spent 80.1× what you earned."; In —, Out ₫3,000,000; other currencies +$1,405.78 / −¥36,080.
    - **Dashboard, Year:** one VND scale across the twelve months.
    - **Home:** VND block plus other-currency line on All; ₫4,300,000 on Transfer.
    - **Light theme:** legible throughout.

    PASS.
16. **Self-inflicted regression, caught and repaired during this pass.**
    - The `transactions.title` removal loop ran `sed -i "${n}d"` over every file in `locales/`, including `catalogs.ts`, where the key does not exist. With `n` empty this became `sed -i d` and emptied the untracked `catalogs.ts`.
    - The app then failed at `i18n/index.ts:43` ("Cannot convert undefined value to object").
    - Restored from the session transcript's original `Write` (544 bytes). No later tool call had edited the file. Confirmed with `cmp`, a re-run typecheck and tests, the served bundle containing it, and a clean Expo Go relaunch.

17. **Loading skeleton order.** Found by the comment audit: `DashboardScreen.tsx:77`'s skeleton drew the account scope chips above the account rows, but the redesigned screen puts them below. The chips were moved after the rows and the block label was updated. Re-verified with the typecheck and tests.

18. **Follow-up: accessibility in `CategoryBreakdown`/`BudgetGoalSummary`.**
    - Category group, child and top-category rows now have `accessibilityRole="button"` and `minHeight: sizes.touchTarget`. They are stacked rows, so a `hitSlop` would overlap the neighbouring row. Groups with children also report `accessibilityState.expanded`.
    - Budget and goal cards (already taller than 44pt) get `accessibilityRole="button"`.
    - Device: Linh's Wallet, Oct and Sep 2026, rows render at the new height.
19. **Follow-up: `MemberSplit` on device.** Linh's Wallet, Sep 2026: Linh ₫3,088,000 with a full bar; An ₫280,000 with a bar about 9% as long (280,000 / 3,088,000). "Earned ₫15,900,000" appears under Linh. Oct 2026 has one member with activity, so the section correctly hides. PASS.
20. **Follow-up: `pendingTotals.totalOf`** replaced by `amountInCurrency` (2 call sites); the local helper was deleted.
21. **Found while switching wallets: another wallet's accounts under the new wallet's name.**
    - Switching from Linh's Wallet to Ví của An briefly showed Linh's accounts (Cash, BIDV, ZaloPay, ₫171,078,000) under the "Ví của An" header.
    - Cause: `AccountsOverview` read `accounts.data` and gated its skeleton on `isLoading`, which is true only on a query's very first load. RTK Query's `data` keeps the previous argument's result while the new wallet loads. The same was true at HEAD.
    - `AccountScopePicker` had the same read, so it could offer the old wallet's accounts as scopes.
    - Fixed: both read `currentData`, and `AccountsOverview` shows its skeleton while `currentData === undefined && isFetching`, the pattern `PeriodReport` already uses.
    - Re-verified with the typecheck and tests. On device, after switching, each wallet shows its own accounts. The in-between frame can't be reproduced now that both wallets are cached.
22. **Follow-up: `AccountPicker` stale default.**
    - All five reads of `accounts.data` now read `currentData`, including the one passed to `useDefaultToFirst`. A `walletId` change against an uncached wallet therefore no longer defaults the form to the previous wallet's first account.
    - Re-verified with the typecheck and tests (689/689).
    - Device: the new-transaction form defaults to Tiền mặt (Ví của An's first account). Transfer's "To" lists every wallet's accounts, each labelled with its wallet. The form was cancelled, so nothing was saved.
23. **Follow-up: database suites, on a throwaway cluster.**
    - The `sora` role on `localhost:5433` lacks CREATEDB, so I created a throwaway cluster (CLAUDE.md rule 10's fallback): `initdb -U sora_scratch -A trust -E UTF8` in the session scratchpad, `pg_ctl` on port 55433.
    - `node scripts/migrate.mjs --constraints` applied `001`/`002`; `001_constraints.sql` and `002_ai_messages.sql` PASS. The re-run reported "Up to date (2 migration(s) applied)".
    - **First server run, against `sora_scratch_58c6710d` (`--locale=C`): 249/252, 3 failures.**
      - `integration.categories.test.ts:220-221` and `integration.session.test.ts:297` still used `fr` as the unsupported locale; French has been in `LOCALES` since this session's all-locales change. Changed to `it`.
      - `rejects a custom name equal to a starter as the caller reads it` returned 201: under the `C` collation, `LOWER('Ăn uống')` stays `Ăn uống` (checked over a UTF-8 client). This came from my cluster, not the code. CI's `postgres:17` uses a UTF-8 locale.
    - **Second run, against `sora_scratch_icu_58c6710d`** (`--locale-provider=icu --icu-locale=en-US`, where `LOWER` folds `Ă`): migrations and constraint suites PASS again; `npm run test -w @sora/server` **252/252, 0 skipped** (`DATABASE_URL` set to the scratch database, a throwaway `JWT_SECRET`).
    - Torn down: `pg_ctl stop` (port 55433 freed). Then the data directory was deleted by exact path, after checking it held `PG_VERSION` 17, 1,790 files, no symlinks or reparse points and an empty `pg_tblspc`. The rest of the scratchpad was intact afterwards. `sora_dev` was only read (role rights).
24. **Follow-up: translation pass** over `viewBy`, `otherCurrencies`, `versusPeriod`, `spentMultiple` (plus `savingsRate`/`negativeSavingsRate` beside them) in the nine non-English catalogs. This is a careful non-native pass, not a native-speaker review. Changed three Russian strings:
    - `spentMultiple` → "Расходы превысили доходы: ×{{multiple}}." The natural "в N раз(а)" changes ending with the number, and the string has no count to pick from.
    - `versusPeriod` → "сравнение: {{period}}". "по сравнению с" needs the instrumental case, which a filled-in label can't take.
    - `viewBy` → "Период". "Показывать по" read as an unfinished title.

    The others read naturally. Mobile tests 689/689 (parity and placeholders).

## Fixes Applied

All of the following were re-verified by findings 1–4, plus the device pass in finding 15:
- `packages/contracts/src/calc.ts`: `amountInCurrency`.
- `packages/contracts/test/calc.test.ts`: its test.
- `IncomeExpenseSummary.tsx`: shared lookup, `absScaled`, transfers in every currency.
- `PeriodSummaryCard.tsx`: shared lookup, no round trip.
- `MemberSplit.tsx`, `YearlyReport.tsx`: currency rule; `YearlyReport` also lost its dead `navigation` prop, with `DashboardScreen.tsx` updated.
- `sizes.ts`, `TrendBarChart.tsx`: `minBarLength`.
- Roles and `hitSlop` in `ActionSheet.tsx`, `PeriodBar.tsx`, `AccountScopePicker.tsx`, `AccountsOverview.tsx`, `DashboardScreen.tsx`.
- `transactions.title` removed from 10 locales.
- `CLAUDE.md` rule 15 example; `dashboard-current-state.md`.
- `DashboardScreen.tsx`: loading skeleton puts the scope chips below the account rows.
- `CategoryBreakdown.tsx`, `BudgetGoalSummary.tsx`: roles, expanded state, 44pt row minimum.
- `services/sync/pendingTotals.ts`: `totalOf` → `amountInCurrency`.
- `AccountsOverview.tsx`, `AccountScopePicker.tsx`, `AccountPicker.tsx`: `currentData` instead of `data`.
- `server/test/integration.categories.test.ts`, `integration.session.test.ts`: unsupported-locale example `fr` → `it`.
- `mobile/src/app/i18n/locales/ru.ts`: `viewBy`, `versusPeriod`, `spentMultiple`.

## Follow-ups

- **`ActionSheet` rows use `key={action.label}`**, which collides if two actions share a label. No caller does today.
- **`metro.config.js` wraps `cacheStores` only when it is an array.** Expo provides an array today; a function form would skip the limit silently.
- **The duplicate-name check depends on the database collation.** `assertNameFree` relies on Postgres `LOWER()` folding non-ASCII letters, which a `C`-collation database doesn't do. `sora_dev` (`English_United States.1252`, `LOWER` folds `Ă`, checked read-only) and CI aren't `C`, so nothing breaks today. A server-side `lower()` on an ICU column, or comparing in JS, would remove the dependency. That is a design decision, so it is left here.
- **Native-speaker review** is still worth doing; finding 24 was a non-native pass.
