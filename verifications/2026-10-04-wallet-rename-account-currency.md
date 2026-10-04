# Wallet rename, account currency edit, wallet swipe actions in the app

**Date:** 2026-10-04T09:54:01Z
**Method:** ad hoc
**Verdict:** PASS (static and unit checks); device and E2E not run
**Scope:** The last two unwired API capabilities from the swipe audit: `PATCH /wallets/{id}` name (§6.4) and `PATCH /accounts/{id}` currency (§9.4). Also Edit/Archive swipe on owned wallet rows, which became possible once wallets had an edit flow.
**Files touched:** see Fixes Applied
**Related reports:** [2026-10-03-double-check-uncommitted.md](2026-10-03-double-check-uncommitted.md), [2026-10-03-swipe-row-actions.md](2026-10-03-swipe-row-actions.md) (its "Unwired API capabilities" follow-up is closed here)

## Method

- Read §6.4, §6.5 and §9.4, `updateWalletSchema`, `updateAccountSchema`, `createContributionSchema`, and `balance.service.ts` (`transactionCount`).
- Read the guest copy, `guestAccounts.update`.
- `npm run typecheck`
- `npm run test -w @sora/mobile`
- `npx tsc --noEmit --noUnusedLocals` in `mobile/`, filtered to the touched files
- `node scripts/check-contract-parity.mjs`
- `npx expo export --platform android` into the scratchpad

## Findings

- **The server already serves both.**
  - Wallet rename: `PATCH /wallets/{id}`, OWNER only. The HTTP client already had `walletsApi.update`, but no RTK mutation used it.
  - Account currency: changeable only while nothing names the account, otherwise `422 ACCOUNT_CURRENCY_MISMATCH`. Covered server-side by TC-ACC-11/16 and TC-WAL-27; the guest copy mirrors the rule.
- **`transactionCount` alone can't decide currency editing.** It counts every transaction status (`balance.service.ts:216`), but an earmark contribution names an account without a transaction (`createContributionSchema.accountId`). So the app shows the currency field when `transactionCount === 0` as a hint, and the API's 422 has the final say (AC-02).
- **Guest mode.** Wallet create, update and archive have no guest branch by scope decision (the `walletsApi.ts` header). Rename and the wallet swipe actions are therefore hidden for guests. Account currency works in guest mode through `guestAccounts.update`.
- **Offline.** Wallet rename is online-only, like create and archive; a network failure shows as the save error. The account update keeps its existing offline queue path, and a currency change the server refuses at sync fails there.
- **Stale doc.** Objective 3 in `docs/test-plans/accounts.md` said currency could never change, contradicting §9.4 and TC-ACC-11. Fixed.

## Fixes Applied

- `mobile/src/app/store/api/walletsApi.ts`: `updateWallet` mutation and hook. It invalidates `Wallet`, so the sheet title and the switcher refetch.
- `mobile/src/features/wallets/components/WalletEditCard.tsx` (new): rename only, `updateWalletSchema`, toast `toast.walletUpdated`. Rendered in `WalletDetailPanel` for the owner, outside guest mode.
- `mobile/src/features/wallets/components/WalletDetailPanel.tsx`: mounts the card; `keyboardShouldPersistTaps="handled"`, so Save takes a single tap while the keyboard is up.
- `mobile/src/features/wallets/components/WalletSwitcher.tsx`: owned wallet rows (not guest) swipe to Edit (opens details) and Archive (a `MutationConfirmDialog` with the existing wallet archive copy; errors as a toast). Scrolling closes an open row.
- `mobile/src/features/accounts/components/AccountEditCard.tsx`:
  - takes `AccountDetailResponse`;
  - shows a 3-letter currency field while `transactionCount === 0`, otherwise the caption `accounts.currencyLocked`;
  - sends only changed fields;
  - shows field errors per field.
- `mobile/src/features/accounts/components/accountSwipeActions.ts`: doc comment no longer says the screen is rename-only.
- en/vi: `accounts.currencyLocked`, `wallets.editWallet`, `toast.walletUpdated`.
- `docs/DESIGN_GUIDELINES.md`: wallets added to the Archive list.
- `docs/test-plans/accounts.md`: objective 3 corrected.

**Verified**
- `npm run typecheck`: exit 0.
- `npm run test -w @sora/mobile`: 594/594.
- `tsc --noUnusedLocals`: no hits in touched files.
- Contract parity: 40/40.
- `expo export --platform android`: `index-599850215324ea80ba8d9ef3ce1e5e1f.hbc` written, 3815 modules.

## Follow-ups

- **Not on a device, not in E2E.** Rename a wallet, swipe-archive a wallet, and change an empty account's currency (then confirm the field is replaced by the caption once a transaction exists). No Maestro flow covers them yet.
- **Restoring an archived wallet** (`PATCH` with `status: ACTIVE`) has no app entry point. Archived wallets don't appear in the switcher, so it needs its own list. That is a product decision.
