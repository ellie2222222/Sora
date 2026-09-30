# Wallet-management navigation and modal double-check

**Date:** 2026-09-29T05:16:56Z
**Method:** double-check skill
**Verdict:** FAIL
**Scope:** Recent wallet-management refactor: `WalletList` navigation, `CreateWalletModal`, `ModalProvider`/`ModalContext`, and wallet-switcher callers.
**Files touched:** `verifications/2026-09-29-wallet-management-double-check.md` (report only)
**Related reports:** `2026-09-25-e2e-and-follow-ups-double-check.md` (broader mobile baseline; it does not cover this wallet flow)

## Method

- Read `CLAUDE.md`, the recent verification report, the changed wallet-navigation/modal files, their callers, and the shared wallet schema and role-label helper.
- Searched for `WalletList`/`CreateWallet` references and function-valued `Pressable` styles in the scoped UI.
- Ran `git diff --check`, `npm run typecheck -w @sora/mobile`, `npm run test -w @sora/mobile`, and `npm run export -w @sora/mobile`.

## Findings

- `mobile/src/features/wallets/components/CreateWalletModal.tsx:15-16,30-50` retains `name` and `error` while hidden. `ModalProvider` keeps the modal mounted, so reopening after dismissal restores stale input/error state. FAIL.
- `mobile/src/features/wallets/components/CreateWalletModal.tsx:18-27` submits without `createWalletSchema` or field errors, unlike the other form modals. The shared schema limits a trimmed wallet name to 100 characters, so invalid input unnecessarily reaches the API. FAIL.
- `mobile/src/features/wallets/components/WalletSwitcher.tsx:133` and `mobile/src/features/wallets/screens/WalletListScreen.tsx:76` render `ROLE_LABELS` directly. Vietnamese users see English roles even though `getRoleLabel(role, t)` supplies the localized label. FAIL.
- All `WalletList` route, type, export, and caller references resolve; no function-valued `Pressable` style was found in the scoped UI. PASS.
- `npm run typecheck -w @sora/mobile` completed without errors. PASS.
- `npm run test -w @sora/mobile` completed: 528 passed, 0 failed. PASS.
- `npm run export -w @sora/mobile` produced `mobile/.export/metadata.json`, proving Metro resolved the route and modal modules. PASS.

## Fixes Applied

None; this was a review-only pass.

## Follow-ups

- Reset create-wallet form and submit state on each visible transition, validate with `createWalletSchema`, and use `getRoleLabel` at both shared-wallet label call sites; then rerun this scoped audit.
- `npm run export -w @sora/mobile` generated the untracked `mobile/.export/` verification artifact. It remains because removing files requires explicit approval.
