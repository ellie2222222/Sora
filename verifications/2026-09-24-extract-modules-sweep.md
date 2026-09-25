# Extraction candidates across mobile screens (first extract-modules sweep)

**Date:** 2026-09-24T06:01:59Z
**Method:** ad hoc; the sweep that became `.claude/skills/extract-modules`
**Verdict:** SKIP (candidate list only; no extraction carried out yet)
**Scope:** every file in `mobile/src/features/*/{screens,components}`, `app/navigation`, `app/providers`, except the five Add* sheets, which were rewritten in the same session
**Files touched:** none (read-only pass)
**Related reports:** `2026-09-24-budget-goal-keypad-sheets.md` (the sheet-level extractions already done)

## Method

A read-only exploration agent grepped every duplicate it reported. Paths are relative to `mobile/src`. Line numbers are from the pass date.

## Findings (most valuable first)

**Duplication**
1. The guest-wallet display name (`name === 'Guest Wallet' ? t('wallets.guestWallet') : name`) is repeated in several places:
   - `WalletSwitcher.tsx:41-46,110-111`
   - `WalletListScreen.tsx:84-90` (three times)
   - `GuestUploadScreen.tsx:195`
   - The seed side is `guestSeed.ts:38`.

   → `utils` `walletDisplayName(wallet, t)` plus a `GUEST_WALLET_NAME` constant. The same helper should cover the `isOwn ? name : relationLabel ?? name` branch.
2. Role labels go through two different APIs:
   - untranslated `ROLE_LABELS`: `WalletSwitcher:133`, `WalletListScreen:90`, `WalletDetailScreen:198`, `AcceptInvitationScreen:59`;
   - translated `getRoleLabel`: `WalletMembersScreen:248,291`, `WalletActivityScreen:122`.

   → use `getRoleLabel` everywhere.
3. The "relationLabel · role" caption appears three times → `memberCaption` helper.
4. The selectable picker row (`AccountPicker:156-201`, `CategoryPicker:120-160`, `WalletSwitcher:98-145`) → `components/SelectableRow`.
5. The category colour dot appears at `CategoryPicker:57,149` and `CategoryListScreen:137`, with an 8px variant at `CategoryBreakdown:85,168` → `CategoryDot`.
6. The account row (`AccountsScreen:265-285`, `WalletDetailScreen:285-313`) has drifted: WalletDetail hard-codes `Landmark` instead of `ACCOUNT_ICON[type]` → `AccountRow`.
7. The no-wallet empty state (`AccountsScreen:65-73`, `PlanningScreen:259-273`; Dashboard uses a third key) → `NoWalletState`.
8. `CreateWalletModal` is inline in `WalletListScreen:105-147` → its own file.

**Pure logic in screens**
9. `AccountsScreen:287-325` `netWorthByCurrency` → a money util, with a test.
10. `WalletActivityScreen:92-109` `groupByDay` and `humanizeEvent` → `utils/groupByDate.ts`, generic `groupByDay<T>`.
11. `DashboardScreen:440-466` `yearOf` and `monthsOfYear` → dashboard utils. `monthsOfYear` should reuse `startOfYear`/`addMonths`.

**Oversized inline components**
12. `CategoryListScreen` (456 lines) contains:
    - `CreateCategoryModal`, about 80 lines;
    - `CategoryDeleteDialog`, about 165 lines;
    - `DeleteOption`;
    - `CategoryRow`.
13. `DashboardScreen` (466 lines) contains `PeriodReport` (about 115 lines), `YearlyReport` (about 95), `PeriodInsights` and `MonthDataPoint`.
14. `PlanningScreen` contains `BudgetCard` and `GoalCard`; `WalletMembersScreen` contains `MemberRow` and `InvitationRow`. All four are rendered in loops.
15. Navigation and providers: `MainTabNavigator:21-150` holds `CustomTabBar`, and `ThemeProvider:81-146` holds `AnimatedThemeRoot`.
16. `TransactionListScreen.tsx` is a screen sitting under `components/` → hand to `restructure`.

**Magic values**
17. `.slice(0, 10)` is used instead of `dayOfInstant` at `GoalDetailScreen:129`, `TransactionDetailModal:136,142` and `WalletMembersScreen:292`.
18. The `toFixed(0)}%` percentage format appears five times → `formatPercent`.
19. `query.isError && !isNetworkError(query.error)` appears 13 times in 12 files → an `isBlockingError` helper.

No screen-declared type is used by two or more files.

## Follow-ups

- Run the extractions via the `extract-modules` skill, in independent batches: wallets (1–3, 8, 14b), categories (5, 12), dashboard (11, 13), planning/accounts (6, 7, 9, 14a), shared (4, 17–19), navigation (15). Awaiting the user's go-ahead: it is about 30 files of behaviour-preserving moves.
- The drift in 6 (the Landmark icon) is a small behaviour fix. Decide it when the row is extracted.
