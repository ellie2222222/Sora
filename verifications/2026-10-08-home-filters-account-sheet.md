# Home filters, account scope sheet, account detail sheet and money display fixes

**Date:** 2026-10-08T08:41:25Z
**Method:** double-check skill
**Verdict:** PASS
**Scope:** this session's uncommitted mobile UI work, excluding the guest upload rework, which `2026-10-08-guest-upload-background-cancel.md` already covers:

- the account scope "…" sheet;
- the `largestCurrencyTotal` and zero-sign money fixes;
- the Home tab's account and category filters;
- `AccountDetailModal` replacing `AccountDetailScreen`;
- the `TransactionListScreen` rework and the tab indicator.

**Files touched:**

- `mobile/src/features/accounts/accountScope.ts`
- `mobile/src/features/accounts/accountScope.test.ts`
- `mobile/src/features/accounts/components/AccountScopePicker.tsx`
- `mobile/src/features/accounts/components/AccountPicker.tsx`
- `mobile/src/services/guest/guestDashboard.ts`
- `mobile/src/features/dashboard/components/PeriodReport.tsx`
- `mobile/src/features/dashboard/screens/DashboardScreen.tsx`
- `mobile/src/features/transactions/components/TransactionListScreen.tsx`
- `mobile/src/app/navigation/MainTabNavigator.tsx`
- `plans/architecture/dashboard-feature-roadmap.md`

**Related reports:** none in this area.

## Method

- A read-only sweep agent reviewed every in-scope diff against CLAUDE.md MB-06, MB-10, NC-04 and Part 7 rules 11, 14 and 15. It also checked for:
  - dangling references to the removed `AccountDetail` and `Transactions` routes and files;
  - dead code;
  - duplication;
  - correctness.
- Each finding was re-checked by grep or read before fixing.
- Commands run:
  - `npm run typecheck`
  - `npm run test -w @sora/mobile`
  - `npm run test -w @sora/contracts`
  - `npm run test -w @sora/server`
  - `node scripts/check-contract-parity.mjs`
- Device: Android emulator (Medium_Phone), Expo Go, signed in as An, against `sora_dev`.

## Findings

- **No references to removed code remain.** Grep across `mobile/src`, `mobile/e2e`, `docs`, `SDS.md`, `SRS.md` and `plans` for these returned nothing outside historical `verifications/`:
  - `AccountDetailScreen`, `AccountEditCard`, `TransactionsScreen`;
  - `'AccountDetail'`, `navigate('Transactions'`;
  - `screen-account-detail`.
- **Stale docblock** in `TransactionListScreen` described a deleted Transactions stack screen. Fixed.
- **`plans/architecture/dashboard-feature-roadmap.md` row 38** cited the removed `AppStackParamList.Transactions`. Fixed.
- **testID collision (NC-04).** The scope chips used `option-account-<id>`, the same ids as `AccountPicker`'s rows in the Add Transaction sheet that opens over Home. Fixed: the ids are now `btn-account-scope-<id>`, `btn-more-account-scope`, and `option-account-scope-<id>` in the sheet.
- **Duplication: "All accounts" row.** The sheet's "All accounts" row copied `AccountItem`'s row. Fixed: both now render `AccountOptionRow`, and `AccountItem` is exported as `AccountOption` so it no longer shares a name with `AccountsOverview`'s local `AccountItem`.
- **Duplication: dominant currency.** `guestDashboard.ts` kept its own copy of the rule and broke ties in Map insertion order, while its `expense` array is sorted. A tie could label the breakdown with the wrong currency. Fixed: it now uses `largestCurrencyTotal`.
- **Category tap dropped the account scope.** On an account-scoped Overview, tapping a category opened Home across all accounts, so the figures disagreed. Fixed: `PeriodReport` passes `accountId: scope`.
- **Filter with no way back.** An archived filtered account with fewer than two active accounts left the picker hidden, so the filter couldn't be cleared. Fixed: the picker stays visible while a filter is set.
- **Possible one-frame indicator jump.** The tab indicator's offset was written in `useEffect`, after the new `left` had painted. Changed to `useLayoutEffect`. This was not seen on the device before or after.
- **Dead alias.** `DashboardScreen`'s `openAccount` only renamed `setSelectedAccountId`. Inlined.
- **No test for `inlineAccounts`.** Extracted to `features/accounts/accountScope.ts`, with 4 tests.
- **Rules that held:**
  - no function `style` on a Pressable;
  - no hook after an early return;
  - no import cycle;
  - only allowed token literals;
  - all new i18n keys exist in both en and vi.

## Fixes Applied

- Each fix is listed above.
- Re-verification:
  - `npm run typecheck`: clean.
  - `npm run test -w @sora/mobile`: 685/685 pass (681 before, plus 4 new).
  - `npm run test -w @sora/contracts`: 169/169 pass.
  - `npm run test -w @sora/server`: 66/66 pass.
  - Contract parity: 65/65.
- Device checks on the Home tab:
  - the row shows All, Tiền mặt, Vietcombank and "…" without scrolling;
  - the sheet lists All plus the 7 accounts, with balances;
  - picking MoMo puts it in the last chip slot and filters the list and summary;
  - a zero income reads "đ0" in neutral colour.

## Follow-ups

- **`transactions.title` is orphaned** in en and vi. Removing it fails typecheck: the 8 inactive locales still define it, and CLAUDE.md MB-09 says not to touch them. Left in place.
- **Integration suites not run.** No disposable database exists, and creating then dropping one needs explicit approval.
  - Affected suites: `server/test/integration.dashboard.test.ts`, `integration.ledger.test.ts` and `integration.transactions.test.ts`.
  - The `spendingByCategory` change keeps the same tie rule, and contract tests cover the helper.
- **First-currency picks remain** in `DashboardKpis.tsx:41`, `CashFlowCard.tsx:30`, `MemberSplit.tsx:31` and `YearlyReport.tsx:82`. Which currency these show for a multi-currency wallet is a product decision.
- **Deep-link edge case:** `HomeScreen` applies route params once, so params arriving before wallets load could lose their wallet switch. Every caller today navigates after load.
- **Duplicated wallet-scoped state** in `HomeScreen` and `DashboardScreen`. A shared hook is a candidate refactor.
- `AccountDetailModal` sets no `entity` (so no `sheet-account`/`btn-cancel-account` ids), because `AddAccountModal` already uses `entity="account"`. This follows the `BudgetDetailModal` precedent.
