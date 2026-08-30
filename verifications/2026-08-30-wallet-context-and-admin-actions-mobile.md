# Wallet context bar rollout + wallet admin/activity UI (mobile)

**Date:** 2026-08-30T00:00:00Z
**Method:** double-check skill
**Verdict:** PASS
**Scope:** This session's uncommitted mobile changes only (not a full-codebase sweep): the
`WalletSwitcher` wired into all 5 tabs via a new `WalletContextBar`, a new `WalletActivityScreen`
(audit log, WAL-US-13), and Transfer Ownership / Leave Wallet / Archive Wallet UI actions wired to
pre-existing, previously-unused hooks (`useTransferOwnership`, `useLeaveWallet`,
`useArchiveWallet`) that `mobile/GAPS.md` had documented as built-but-uncalled.
**Files touched:** `mobile/src/app/config/queryKeys.ts`, `mobile/src/app/navigation/AppNavigator.tsx`,
`mobile/src/app/navigation/types.ts`, `mobile/src/features/budgets/screens/BudgetsScreen.tsx`,
`mobile/src/features/goals/screens/GoalsScreen.tsx`,
`mobile/src/features/transactions/screens/AddTransactionScreen.tsx`,
`mobile/src/features/transactions/screens/TransactionsScreen.tsx`,
`mobile/src/features/wallets/screens/WalletDetailScreen.tsx`,
`mobile/src/features/wallets/screens/WalletMembersScreen.tsx`, `mobile/GAPS.md`,
`mobile/src/features/wallets/components/WalletContextBar.tsx` (new),
`mobile/src/features/wallets/hooks/useWalletActivity.ts` (new),
`mobile/src/features/wallets/screens/WalletActivityScreen.tsx` (new),
`mobile/src/services/api/audit.ts` (new)
**Related reports:** none (first report touching this area)

## Method

- Delegated a read-only codebase-health sweep (Phase 1, categories 1–11 from this skill) to an
  Explore agent, scoped to exactly the files above, with the live diff and full new-file contents
  as its evidence — not a description from memory.
- `npx tsc --noEmit` (mobile workspace) — before and after the fix below.
- `npx tsx --test src/services/auth/session.test.ts src/utils/transactionForm.test.ts` — before
  and after.
- `npx expo export --platform web` — before and after, confirming module count and that every
  import across the monorepo boundary still resolves.
- Manual re-read of `WalletDetailScreen.tsx`, `WalletMembersScreen.tsx`,
  `WalletActivityScreen.tsx`, `WalletContextBar.tsx` in full after editing, per the repo's own
  "review your diff as if reviewing someone else's PR" convention.

## Findings

1. **Dead code — none.** `WalletContextBar` is imported and rendered in all four target tab
   screens; `useWalletActivity` is called from `WalletActivityScreen.tsx` and nowhere else (used,
   not orphaned); `AuditLogListParams` follows the same `*ListParams` pairing every other resource
   in `queryKeys.ts` already uses. PASS.
2. **Duplicated logic — confirmed and fixed.** The loading/error/empty (and success, for
   `BudgetsScreen`/`GoalsScreen`/`AddTransactionScreen`) branches in all four touched screens
   repeated an identical `<View style={{flex:1}}><WalletContextBar .../>{...}</View>` wrapper —
   ~10 near-identical blocks across 3 files. Fixed: `WalletContextBar` now optionally accepts
   `children` and does the wrapping itself, collapsing every call site to one line. Re-verified:
   `tsc --noEmit` clean, `expo export --platform web` still resolves (2608 modules, unchanged),
   test suite still 36/36.
3. **Convention drift — one cosmetic-only item.** `WalletActivityScreen.tsx`'s row `testID`
   (`wallet-activity-${entry.id}`) omits the `-row-` segment `TransactionsScreen.tsx` uses
   (`transaction-row-${item.id}`), the sibling screen it otherwise mirrors closely. Not fixed —
   cosmetic, and every other testID in the new/changed files already follows this repo's actual
   (non-`NC-04`-compliant) ad hoc convention rather than the documented one, so singling out this
   one testID for a different fix than its neighbors would itself be an inconsistency. See
   Follow-ups.
4. **Contract/response-shape drift — none.** `AuditLogResponse` in `packages/contracts/src/responses.ts`
   has every field the new mobile code touches (`id`, `createdAt`, `event`, `actorRole`,
   `entityType`, `result`), with matching types confirmed against the live interface. PASS.
5. **CLAUDE.md rule checks — no violations.** Verified against a fresh read of `CLAUDE.md`: no
   client-side role check is treated as the actual authorization boundary (every new action routes
   through its real API mutation, matching `roles.ts`'s own documented caveat); no money value is
   read/compared as a JS number anywhere in the new/changed code (`<Money>` used throughout); no
   restates-the-code or debug-journal comments introduced; MB-01–MB-08 (TanStack Query for server
   state, lucide-react-native icons only, theme tokens not literals, every screen handles
   loading/error/empty/success) all hold. PASS.
6. **testID convention (NC-04) — pre-existing drift, not newly introduced.** New testIDs use the
   same ad hoc `<feature>-<action>` scheme as every pre-existing testID already in these same
   files, rather than the documented `btn-*`/`row-*` table. Matching the surrounding file's actual
   convention is more consistent than unilaterally introducing the documented pattern in only the
   new lines. Not fixed this pass — repo-wide, out of scope. See Follow-ups.
7. **Destructive-confirmation pattern — correct, no duplication.** `ConfirmDialog` is the
   established pattern (already used in `SettingsScreen.tsx`); `Alert.alert` is not used anywhere
   in `mobile/src` (confirmed via grep). Leave/Archive/Transfer all correctly reuse `ConfirmDialog`
   rather than introducing a second confirmation mechanism. PASS.
8. **Padding/layout doubling — none.** Confirmed `TransactionsScreen`'s `SectionList`
   `contentContainerStyle` carries no horizontal/top padding, so its `ListHeaderComponent` usage
   doesn't double up with `WalletContextBar`'s own padding; `Budgets`/`Goals`/`AddTransaction` keep
   `WalletContextBar` as a sibling outside each list's independently-padded
   `contentContainerStyle`. Re-confirmed after the Finding 2 refactor. PASS.

## Fixes Applied

- [mobile/src/features/wallets/components/WalletContextBar.tsx](../mobile/src/features/wallets/components/WalletContextBar.tsx) —
  added optional `children`; wraps them in the `flex: 1` shell itself instead of every consumer
  screen repeating the wrapper. Re-verified: `tsc --noEmit` clean, `node --test` 36/36, `expo
  export --platform web` succeeds (2608 modules).
- [mobile/src/features/transactions/screens/TransactionsScreen.tsx](../mobile/src/features/transactions/screens/TransactionsScreen.tsx),
  [BudgetsScreen.tsx](../mobile/src/features/budgets/screens/BudgetsScreen.tsx),
  [GoalsScreen.tsx](../mobile/src/features/goals/screens/GoalsScreen.tsx),
  [AddTransactionScreen.tsx](../mobile/src/features/transactions/screens/AddTransactionScreen.tsx) —
  updated to the collapsed `<WalletContextBar onManage={...}>{...}</WalletContextBar>` form in
  every branch.

## Follow-ups

- `WalletActivityScreen.tsx`'s row testID doesn't match `TransactionsScreen.tsx`'s `-row-`
  naming — cosmetic, low priority.
- The whole mobile app's testID scheme diverges from the documented `NC-04` table repo-wide
  (pre-existing, not introduced by this pass) — a dedicated pass to either update the convention
  doc to match reality or migrate every testID is out of scope here.
- `HomeScreen.tsx` still renders `WalletSwitcher` directly rather than through the new
  `WalletContextBar` — deliberate (its layout genuinely differs, with an inline settings icon), not
  an oversight, but worth a look if Home's header row is ever revisited.
- Not tested on a device/emulator — none available in this environment, per `mobile/GAPS.md`'s
  own standing note.
