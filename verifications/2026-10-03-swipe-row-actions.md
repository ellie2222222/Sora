# Swipe-left row actions app-wide; goal edit/cancel; budget sheet and assistant input fixes

**Date:** 2026-10-03T08:41:02Z
**Method:** ad hoc
**Verdict:** PASS (static checks and unit tests). Gestures and haptics not exercised on a device; the new E2E flow has not run yet.
**Scope:** Every list of manageable records in `mobile/src` was audited and swipe actions added where an edit or delete flow exists. Also in scope, both reported by the user: "cannot edit budget, check if can edit goal", and the assistant tab's broken input bar.
**Files touched:** see Fixes Applied
**Related reports:** [2026-10-03-backend-audit-followups.md](2026-10-03-backend-audit-followups.md) (same day; its E2E follow-ups still apply)

## Method

- Audit: a read-only sweep of `features/*/screens`, `features/*/components`, `components/` and `app/store/api/*.ts`. It recorded each row, its list, its tap behaviour, its edit and delete flows, and its permission gating.
- `npx tsc --noEmit` (mobile), then `npm run typecheck` (all packages).
- `npm run test -w @sora/mobile`.
- `npx expo export --platform android --output-dir <scratchpad>`.
- `node scripts/check-contract-parity.mjs`; `npm run agents:check`.
- Plan link check (scratchpad `checklinks.py`), plus a recount of every `| TC-` row against `docs/test-plans/README.md`.

## Findings

1. **Rows audited.** Each entry lists the row's existing edit and delete flows, then the outcome.
   - **Transactions** (`TransactionListSection`): edit through `EditTransactionModal`, delete through the detail sheet. Swipe added: Edit and Delete.
   - **Budgets** (Planning): edit and archive both live in `BudgetDetailModal`. Swipe added: Edit and **Archive**; there is no hard delete.
   - **Goals** (Planning): **no edit or cancel in the app at all**; `goalsApi.ts` exposed only create and contribute. Edit and cancel built, then swipe added: Edit and **Cancel**.
   - **Categories**: rename, archive and delete-permanently exist in `CategoryDeleteDialog`. Swipe added: Edit (opens rename) and Delete (opens the chooser).
   - **Wallet members**: role change, make owner and remove sit in the ⋮ `ActionSheet`. Swipe added: Edit (opens that sheet) and **Remove**.
   - **Invitations**: inline revoke exists. Swipe added: **Revoke**.
   - **AI conversations**: inline delete exists. Swipe added: Delete.
2. **Rows not swiped, by design.**
   - **Accounts** (dashboard and wallet sheet): no edit flow exists, and `useArchiveAccountMutation` is unused.
   - **Wallets** (switcher): no edit exists; archive and leave live in the detail page.
   - **Goal contributions**: the app has no remove mutation, although the API supports it (§13.8).
   - **Dashboard budget/goal previews**: summaries; the full rows are on Planning.
   - **Read-only lists**: the audit log, AI messages, and pickers.
3. **"Cannot edit budget" (`BudgetDetailModal`): FAIL, now fixed.** These are causes found by reading the code; the bug was not reproduced on a device.
   - The sheet had no `ScrollView`, so the docked amount keypad pushed Save out of reach.
   - Name and amount state survived switching budgets, so an unsaved edit followed the sheet onto the next budget and Save would have applied it there.
   - A successful save showed no feedback at all.
4. **Goal edit (SAV-US-04).** Not possible in the app before this pass. The server's `PATCH /goals/{id}` and the guest `update`/`cancel` already existed. The offline adapter threw `goal update is not wired to any UI flow yet`.
5. **Planning cards fired on `onTouchEnd`.** This is a raw View event, so it would also fire at the end of a swipe. Converted to `Pressable`.
6. **Member action sheet never closed** after an action was chosen. `ActionSheet` leaves closing to its caller, and the caller never closed it.
7. **Member remove, invitation revoke and AI chat delete ran with no confirmation.** All three now confirm, from both the swipe and the existing buttons.
8. **`ReanimatedSwipeable` renders closed actions at opacity 0.** Every row would then expose a hidden Delete to screen readers and to Maestro `id:` selectors. Actions now mount only while a row is opening or open.
9. **Assistant tab** (screenshot).
   - Commit `23371b3` replaced `ChatInputBar`'s row with a `flex: 1` wrapper and a floating placeholder. The send button was gone and the box floated mid-screen. Restored the row and send button.
   - The guest prompt also rendered a disabled input bar beneath the sign-in prompt; removed.
10. **`openModal` was a new function each render.** It would have re-rendered every memoized transaction row whenever a modal opened. It is now `useCallback`, with a memoized context value.

## Fixes Applied

**Shared pieces**
- `mobile/src/components/swipe/SwipeableRow.tsx` (new)
  - Built on gesture-handler's `ReanimatedSwipeable`: a 76pt action per button, a 40pt open threshold, no overshoot, and clipping to the row's radius.
  - The reveal haptic fires once per opening. Edit and Delete each have their own haptic.
  - While a screen reader is on, the actions are offered as accessibility actions.
- `mobile/src/components/swipe/openSwipeRow.ts` (new): one open row at a time; lists close it on `onScrollBeginDrag`.
- `useScreenReaderEnabled.ts` (new): one shared system subscription for every row.
- `mobile/src/services/haptics/` (new, `expo-haptics ~57.0.3` via `npx expo install`).
  - Android uses `performAndroidHapticsAsync`, which honours the system touch-feedback setting and needs no VIBRATE permission. iOS uses the native generators.
  - Every call is best-effort, and the web build is a no-op.
- `BottomSheetModal.tsx`: a `GestureHandlerRootView` inside the `Modal`, which Android needs for gestures in sheets.

**Per entity**
- **Transactions**: `DeleteTransactionDialog.tsx` (new), shared by the detail sheet and the list. `TransactionListItem` takes stable `onEdit`/`onDelete`, which are passed only with `canWrite`.
- **Budgets**
  - `ArchiveBudgetDialog.tsx` (new).
  - `BudgetDetailModal.tsx`: a `ScrollView` with `keyboardShouldPersistTaps`, state reset per `budgetId`, a success toast, the duplicate `KeyboardDockProvider` dropped, and the garbled `Â·` separator fixed.
- **Goals**
  - `goalsApi.ts`: `updateGoal` and `cancelGoal`, covering guest, offline queue (`update`/`cancel`) and cache patches. `GOAL_TAGS` now includes `Dashboard`, since `activeGoals` embeds `GoalResponse`.
  - `entityAdapters.ts`: goal `update` now calls `goals.update`.
  - `GoalEditCard.tsx` and `CancelGoalDialog.tsx` (new); `GoalDetailModal.tsx` mounts both when `canWrite` and the goal is ACTIVE.
- **Categories**: `CategoryDeleteDialog` gains `initialMode` (Edit opens rename, and Cancel then closes).
- **Members and invitations** (`WalletMembersPanel.tsx`): swipe Edit and Remove (owner only, never self or the owner), swipe Revoke, the confirmations, and the action-sheet close.
- **AI history** (`ConversationHistorySheet.tsx`): swipe Delete plus a confirmation.

**Other**
- `ChatInputBar.tsx`, `AiChatScreen.tsx`: input row restored; guest input removed.
- `ModalProvider.tsx`: stable `openModal`/`closeModal`.
- en/vi: 19 keys each (`common.edit/delete/remove/revoke`, goal edit and cancel copy, member and invite confirmations, chat-delete confirmation, `toast.budgetUpdated/goalUpdated`).
- Docs: `docs/DESIGN_GUIDELINES.md` gains a "Row actions (swipe)" rule. Test plans: TC-SAV-24 (Covered) and TC-TXN-35 (Gap until the flow runs). README totals are now 257 / 251 / 2 / 4 / 0, and a recount of the rows matches.
- E2E: `mobile/e2e/flows/swipe-delete-transaction.yaml` (new).
- Tests: `openSwipeRow.test.ts` (4 cases). In `entityAdapters.test.ts`, the "rejects a goal update" case became "forwards a queued goal edit".

**Re-verified**
- `npm run typecheck`: exit 0.
- `npm run test -w @sora/mobile`: 585/585 (was 581).
- `expo export --platform android`: bundle written.
- Contract parity: 40/40. `agents:check`: in sync.
- Plan links: 667, 0 broken, 3 that don't land on a test title (existing fixtures).

## Follow-ups

- **Not observed on a device.** Still unchecked:
  - the swipe feel against vertical scroll and pull-to-refresh (the swipe pan has no `failOffsetY`);
  - haptics on real hardware;
  - the docked keypad in the goal and budget sheets.
- **No tap-outside-to-close.** An open row closes on: tapping the row itself, opening another row, scrolling its list, or choosing an action.
- **Untested logic.** The once-per-opening haptic guard and the revealed-state mount are component logic, so the node test runner can't load them. Only the registry is unit-tested.
- **TC-TXN-35** stays a Gap until CI runs `swipe-delete-transaction.yaml`.
- **E2E run `37108044161`:** all 3 failures are diagnosed and fixed (see the addendum below). Not yet re-run.
- **Unwired API capabilities:** editing a wallet, and changing an account's currency (§9.4 allows it only while the account is empty). Account rename/archive and contribution removal are done; see the second addendum.
- **Dead files:** the unused `features/planning/components/BudgetCard.tsx`/`GoalCard.tsx` and `features/accounts/components/AccountDetailModal.tsx`. These were not removed this pass.

## Addendum: E2E run `37108044161` diagnosed

**Method.**
- `gh run download 37108044161 -n maestro-e2e` into the scratchpad.
- Read each failing step's screenshot, the per-flow `maestro.log`, and `work/_temp/api.log`.
- Compared against run `37105774939` (on `ca33eb7`) with `gh run view --log-failed`.

**Findings.**
1. **Add-transaction and offline-sync** never closed the sheet.
   - The screenshot shows "Select an account…" and, under it, "Expected string, received null".
   - `api.log` has one `GET /accounts` (200) at 08:15:32. So the sheet's `listAccounts` read came from the cache that `useWarmAddTransactionReads` (added in `2144bdc`) had already filled.
   - Add-transaction passed on `ca33eb7`, before that hook existed.
   - Cause:
     - `AddTransactionModal` stays mounted and clears its draft in an `if (visible)` effect.
     - On open, `AccountPicker` mounts with cached data, and `useDefaultToFirst` selects the first account in the child's effect.
     - The parent's reset runs after it in the same commit and wins.
     - The hook's effect was keyed on `[enabled, list, value]`, and `value` was null both before and after. It never ran again, so the account stayed empty.
   - The same race exists in `AddContributionModal` (`setAccountId(null)`, `setCategoryId(null)` on open).
   - Fix (`mobile/src/hooks/useDefaultToFirst.ts`): the effect now has no dependency list and re-checks after every commit.
     - The callers are `AccountPicker` ×3 in the add sheet, `AccountPicker` and `CategoryGrid` in contributions, `CategoryGrid` in budgets, and `CategoryPicker` in edit.
     - Each `onChange` sets the very value the hook reads, so it settles after one extra render and cannot loop.
   - Also fixed: an unpicked account now shows `accounts.selectAccount` in place of Zod's raw message (`AddTransactionModal.tsx`).
2. **Guest-upload-register** did not reach home.
   - The screenshot shows the email field holding `…example.invalidprobe-pw-…` (both "Invalid email" and "Password must be at least 12 characters").
   - `maestro.log` shows `Tap on id: input-register-password COMPLETED` at (160, 419), inside that field's bounds [24,395][296,443]. The next `inputText` still went to the email field.
   - Cause: the tap was intercepted, most likely by a popup over the field after the email was typed. This is not proven, because the artifact has no hierarchy from that step.
   - Fix:
     - `RegisterScreen.tsx`: name → email → password are now chained (`returnKeyType="next"`, `submitBehavior="submit"`, `onSubmitEditing` focuses the next field).
     - `flows/guest-upload-register.yaml` moves between fields with `pressKey: Enter` instead of tapping.
3. **`flows/add-transaction.yaml`** now waits for either Create button (`btn-add-transaction|home-empty-action`), like the subflow. It isn't needed for the seeded user, who has rows, but it no longer depends on the list's state.

**Re-verified.**
- `npm run typecheck`: exit 0.
- `npm run test -w @sora/mobile`: 585/585.
- `expo export --platform android`: bundle written.
- The E2E flows themselves were not re-run; that needs a push.

## Addendum: account rename and archive, goal-contribution removal

The API (§9.4, §9.5, §13.8), the HTTP client and the guest store already had all three. Only the app's mutations and UI were missing.

**Accounts**
- `accountsApi.ts`
  - New `updateAccount` mutation, covering guest, the offline queue (`update`, which the adapter already supported) and cache patches.
  - `archiveAccount`'s offline cache patch now removes the account from lists filtered to `ACTIVE`, since an archived account must leave the pickers (§9.5). Before, it was only relabelled and stayed pickable.
- New `features/accounts/components/ArchiveAccountDialog.tsx` and `AccountEditCard.tsx`. The edit card does rename only; type and opening balance are fixed, and currency moves only while the account is empty.
- `AccountDetailScreen.tsx`: shows rename and archive when the role on the account's **own** wallet allows writes. This screen opens from any wallet's sheet, so the active wallet's role would be the wrong check.
- Swipe Edit (opens the account screen) and Archive on:
  - `AccountsOverview` (dashboard);
  - `WalletDetailPanel` (wallet sheet).
- `409 ACCOUNT_LAST_ACTIVE` arrives as a toast. In the wallet sheet the inline error area only renders for leave/archive-capable users, never for guests, which is why a toast is used there.

**Contributions**
- `goalsApi.ts`: new `removeContribution` mutation.
  - Guest or online only. The offline adapter refuses contribution removal by design.
  - Invalidates `CONTRIBUTION_TAGS`, because a transaction-backed removal also deletes its expense.
- `GoalDetailModal.tsx`: each contribution row gets swipe Delete and an inline trash button, both gated on `canWrite`.
  - The confirmation explains what happens: a transaction-backed contribution also deletes its expense; an earmark only lowers the goal's progress.
  - Failures, e.g. `409 WALLET_ARCHIVED` for a transaction-backed one, arrive as a toast.

**Strings and docs**
- en/vi: 8 keys (account edit/archive copy, contribution-removal copy, `toast.accountUpdated`).
- `docs/DESIGN_GUIDELINES.md` names accounts **Archive**.

**Verified**
- `npm run typecheck`: exit 0. The first run failed: en.ts had two apostrophes inside single-quoted strings, which are now double-quoted.
- `npm run test -w @sora/mobile`: 585/585.
- `expo export --platform android`: bundle written.
- Not exercised on a device.
