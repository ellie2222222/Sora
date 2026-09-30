# Wallet management as one sheet, and no "create a wallet" prompt when the wallets can't be loaded

**Date:** 2026-09-29T11:30:30Z
**Method:** ad hoc
**Verdict:** PASS (typecheck, unit tests, Android bundle). Not driven on a device or against a live or unreachable server.
**Scope:** Two changes to `mobile/`. (1) The `WalletList` screen is removed; wallet details, members, invitations, activity and creation become pages of the wallet switcher's sheet. (2) An unreachable server with no saved wallet list no longer shows the "No wallet yet → New wallet" empty state.
**Files touched:**
- **Provider:** `mobile/src/app/providers/WalletProvider.tsx`
- **Wallet sheet:** `mobile/src/features/wallets/components/{WalletSwitcher,WalletDetailPanel,WalletMembersPanel,InviteMemberPanel,WalletActivityPanel,CreateWalletForm,CreateWalletModal,NoWalletState,WalletContextBar}.tsx`, `mobile/src/features/wallets/index.ts`
- **Callers:** `mobile/src/features/{dashboard,planning,accounts,home,transactions}/…`
- **Navigation:** `mobile/src/app/navigation/{types,AppNavigator}.ts(x)`
- **Copy:** `mobile/src/app/i18n/locales/{en,vi}.ts`
- **Spec:** `SDS.md` §4 screen table and tab-bar note
- **Removed:** `mobile/src/features/wallets/screens/*` (5 files, moved to a scratch quarantine, not deleted)
**Related reports:** supersedes `2026-09-29-wallet-management-double-check.md` (FAIL)

## Method

- `npm run typecheck -w @sora/mobile`
- `npm run test -w @sora/mobile`
- `npm run export -w @sora/mobile`: Metro bundles the Android app, proving every import resolves
- `rtk grep -r -n "WalletListScreen|WalletDetailScreen|WalletMembersScreen|InviteMemberScreen|WalletActivityScreen|'WalletList'|…|onManage|manage-wallets" mobile/src mobile/e2e`, plus the same over docs, plans and agent rules

## Findings

1. **Cause of the empty-state prompt.** `readSignedIn` rethrows a network error when the account has no saved copy. `WalletProvider` hid network errors from `isError`, so the provider reported `wallets: []`, not loading and no error. Dashboard (`activeWalletId === null`), Planning and Accounts then rendered "No wallet yet" with a New wallet button. Dashboard also ignored a non-network `isError`, and Planning never checked `isLoading`, so it showed the same prompt during every slow load. Verdict: fixed. `isUnavailable` is now `isError && isNetworkError && data === undefined`, and the shared `NoWalletState` renders loading, then error, then unavailable (informational, with Retry), then empty. Coming back online already refetches through `refreshEverything` (`syncEngineRuntime.ts`).
2. **Why a saved copy can be missing.** Not established. Owner scoping, cache keys and the SQLite opener were read and are consistent. On web the cache is memory-only (`localCacheDb.ts`), so it is empty on every launch. Verdict: open; see Follow-ups.
3. **Prior report's three FAIL findings.** Stale create-wallet input, no `createWalletSchema`, and `ROLE_LABELS` in the switcher and list: all three were already fixed in the working tree when this pass started. One more `ROLE_LABELS` use remained in the wallet detail member list. Verdict: fixed with `getRoleLabel`.
4. **One sheet, pages instead of stacked modals.** The switcher hosts `list | create | detail | members | invite | activity`, with a back button (`btn-back-wallet`) to each page's parent. Account detail and add-account are stack screens, so the sheet closes before navigating there. Existing test IDs are kept; the sheet is `sheet-wallet`, and a row's details are `btn-view-wallet-<id>`. Verdict: PASS by typecheck and bundle.
5. **Typecheck.** No errors. PASS.
6. **Tests.** `tests 528 · pass 528 · fail 0`. PASS.
7. **Android export.** Exported `_expo/static/js/android/index-5fb044d0b0c35ff117e279ed072cde06.hbc (7.5MB)`. PASS.
8. **Stale references.** No matches in `mobile/src`, `mobile/e2e`, docs, plans or agent rules. PASS.

## Fixes Applied

Findings 1, 3 and 4 as described, re-verified by the typecheck, test, export and grep runs above.

## Follow-ups

- Drive the sheet and the unavailable state on a device. Nothing here was exercised at runtime: page heights inside the content-sized sheet, and the nested `ConfirmDialog`/`ActionSheet` on iOS, are unobserved.
- Finding 2: on a native build that has loaded wallets online before, confirm the saved copy appears offline. If it doesn't, that is a separate cache bug.
- `wallets.manageWallets` is now unused. It is left in place because removing it from `en.ts` breaks the inactive locales' `InactiveTranslationResource` typing, and those files are not to be touched.
- `mobile/.export/` is regenerated build output, untracked and still present.
