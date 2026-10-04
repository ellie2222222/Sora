# Double-check of the uncommitted tree: comment audit and module extraction

**Date:** 2026-10-03T09:32:30Z
**Method:** double-check skill, with comment-audit and extract-modules
**Verdict:** PASS
**Scope:**
- The whole uncommitted working tree (`git status`): swipe row actions, goal edit/cancel, account rename/archive, contribution removal, the E2E fixes, the permission-matrix server test, `collectPages`, and the plan updates.
- Asked for explicitly by `/double-check /comment-audit /extract-modules`.
**Files touched:** listed under Fixes Applied
**Related reports:** [2026-10-03-swipe-row-actions.md](2026-10-03-swipe-row-actions.md) (open follow-ups carried below), [2026-10-03-backend-audit-followups.md](2026-10-03-backend-audit-followups.md)

## Method

- Read-only review agent over `git diff` plus the untracked files. Checked against CLAUDE.md (MB-01..11, NC-04, rules 11/14/15/17) for comments, duplication, rule violations and dead code. Every finding was re-checked against the live file before any edit.
- `npm run typecheck`.
- `npx tsc --noEmit --noUnusedLocals`, filtered to the touched files.
- `npm run test -w @sora/mobile`; `node --test src/utils/roles.test.ts`; `node --test src/features/goals/goalChanges.test.ts`.
- `DATABASE_URL=postgresql://sora:sora@localhost:55443/scratch_gapfill_91c7 npm run test -w @sora/server`, against the throwaway embedded-postgres cluster in the scratchpad (`data4`, started for the run and stopped after).
- `node scripts/check-contract-parity.mjs`; `npm run agents:check`; `node scripts/audit-runtime-deps.mjs`.
- `npx expo export --platform android` into the scratchpad.
- `git ls-files --eol -m` (no CRLF in modified files).

## Findings

**Bugs (all fixed)**
1. **Offline budget archive left the budget on Planning** (`budgetsApi.ts`). The cache patch only relabelled the budget as ARCHIVED, so it stayed in the ACTIVE list, still offering swipe Edit and Archive. Accounts and goals had already been fixed this way; budgets had not.
2. **`SwipeableRow` whose actions vanish while open.** Example: a role change makes the row read-only. `ReanimatedSwipeable` then unmounts with no close event, leaving the row claimed and `revealed` true. If the actions came back, hidden buttons would be mounted on a closed row. The existing comment claimed this case was handled; it was not.
3. **Dashboard scrolling didn't close an open account row.** No `onScrollBeginDrag={closeOpenSwipeRow}`, against the guideline.
4. **`TransactionListScreen` had a duplicate inline edit handler.** It also shadowed `t`.
5. **The contribution trash button's accessibility label was a question** ("Delete this contribution?").

**Comments**
- **Fixed: the four dialog `onError` docs** said "The dialog closes either way". That was false; the caller clears the id. They now say so.
- **Fixed: `SwipeableRow`'s cleanup comment** was stale (bug 2 above).
- **Fixed: `haptics.ts`** was condensed from three lines to two.
- **Fixed: `add-expense.yaml`** described an approach the file no longer used.
- **Added: missing whys** for `ACTION_WIDTH` and the friction value (now `FRICTION`), and for the `btn-cancel-goal-status` id (`btn-cancel-goal` is the add-goal sheet's Cancel, NC-04).
- **Kept: verified good why-comments** in `ModalProvider`, `BottomSheetModal`, `useDefaultToFirst`, `collectPages`, `GOAL_TAGS`, `AccountDetailScreen`, and the unpicked-account note in `AddTransactionModal`.

**Duplication and extraction (extract-modules)**
- **Done: `MutationConfirmDialog`** (`components/`). The four confirm wrappers (`DeleteTransactionDialog`, `ArchiveBudgetDialog`, `CancelGoalDialog`, `ArchiveAccountDialog`) had identical bodies: busy guard, run, done or error, then a destructive `ConfirmDialog`. They now supply only the copy and the write, and keep their props, so no caller changed. The contribution removal in `GoalDetailModal` is a fifth caller.
- **Done: `accountSwipeActions`** (`features/accounts/components/`). The Edit/Archive pair was copied identically in `AccountsOverview` and `WalletDetailPanel`, including a duplicated comment.
- **Done: `canManageMember` and `permissionsForWallet`** (`utils/roles.ts`, with 6 tests). These were pure role logic inline in `WalletMembersPanel` and `AccountDetailScreen`.
- **Done: `goalChanges`** (`features/goals/goalChanges.ts`, with 3 tests). This is the edit form's diff against the saved goal.
- **Done: `BudgetEditCard`** (`features/budgets/components/`). Moved out of `BudgetDetailModal` and keyed by budget id, like the goal and account edit cards. That removes the reset effect.
  - The archive error stays in the sheet, tagged with its budget id, so it can't show on another budget.
  - Edit behaviour is unchanged: the "null means as saved" draft moved verbatim.
- **Done: rename `CategoryDeleteDialog` → `CategoryManageDialog`.** It is local to its file, and Edit now opens it in rename mode.
- **Declined: an Edit-action builder** for the seven one-line `{ key: 'edit', … }` literals. Each literal is self-describing; a builder would save only the icon and tone fields and add indirection.
- **Declined: defaulting `closeOpenSwipeRow` inside the Refreshable lists.** It would cover only some lists, while plain `ScrollView`/`FlatList` lists would still need the prop.
- **Declined: a generic cache-patch helper** for the update mutations' `onQueryStarted`. That is the 5th copy across slices and a separate refactor.
- **Declined: moving `useScreenReaderEnabled` to `@/hooks`.** It has a single consumer.

**Rules**
- **Clean:**
  - No `Pressable` with a function `style` (rule 15), no colour literals, and no `Number()` on money.
  - No require cycles. Nothing in `features/accounts` imports `@/features/*`, so `WalletDetailPanel → @/features/accounts` is safe.
- **Fixed: MB-10.** `TransactionListSection` now imports `./swipe/index.ts` instead of reaching past the barrel.
- **Fixed: unused imports and parameters** already present in files this tree changed:
  - `X` in `TransactionDetailModal`;
  - `ScrollView`, `SkeletonList` and `TransactionItemSkeleton` in `TransactionListScreen`;
  - `navigation` in `PlanningScreen`;
  - `sectionIndex` in `CategoryListScreen`.
- **Fixed: hard-coded English " to "** in the budget sheet's date range. It is now `budgets.dateRange` in en/vi; English output is unchanged.

## Fixes Applied

- `mobile/src/app/store/api/budgetsApi.ts`: the offline archive removes the budget from ACTIVE lists and patches `getBudget`.
- `mobile/src/components/swipe/SwipeableRow.tsx`:
  - resets claim, `revealed` and `isOpenRef` when `actions` empties;
  - adds `FRICTION` and the width comment;
  - corrects the cleanup comment.
- `mobile/src/components/MutationConfirmDialog.tsx` (new), exported from `components/index.ts`. The four dialog wrappers were rewritten on top of it.
- `mobile/src/features/goals/components/GoalDetailModal.tsx`: contribution removal uses `MutationConfirmDialog`; new trash label `goals.deleteContribution`.
- `mobile/src/features/accounts/components/accountSwipeActions.ts` (new), exported from the barrel. `AccountsOverview.tsx` and `WalletDetailPanel.tsx` now use it.
- `mobile/src/utils/roles.ts` and `roles.test.ts`: `permissionsForWallet`, `canManageMember`. `AccountDetailScreen.tsx` and `WalletMembersPanel.tsx` now use them.
- `mobile/src/features/goals/goalChanges.ts` and `goalChanges.test.ts` (new); `GoalEditCard.tsx` uses it.
- `mobile/src/features/budgets/components/BudgetEditCard.tsx` (new); `BudgetDetailModal.tsx` is slimmed.
- `mobile/src/features/categories/screens/CategoryListScreen.tsx`: rename to `CategoryManageDialog`; unused `sectionIndex` removed.
- `mobile/src/features/dashboard/screens/DashboardScreen.tsx`: `onScrollBeginDrag={closeOpenSwipeRow}`.
- `mobile/src/features/transactions/components/TransactionListScreen.tsx`, `TransactionDetailModal.tsx`, `mobile/src/features/planning/screens/PlanningScreen.tsx`: unused imports removed; edit handler reused; NC-04 comment added.
- `mobile/src/components/TransactionListSection.tsx`: barrel import.
- `mobile/src/services/haptics/haptics.ts`, `mobile/e2e/subflows/add-expense.yaml`: comments.
- en/vi: `budgets.dateRange`, `goals.deleteContribution`.

**Re-verified**
- `npm run typecheck`: exit 0.
- `tsc --noUnusedLocals`: no hits in any touched file.
- `npm run test -w @sora/mobile`: 594/594 (585 plus 9 new).
- Server against the scratch DB: 218/218.
- Contract parity: 40/40. `agents:check`: in sync. Runtime audit: no unaccepted high or critical advisories.
- `expo export --platform android`: bundle written.
- `git ls-files --eol -m`: no CRLF.

## Addendum 2026-10-03T09:55:04Z: follow-ups closed

- **`common.name`** added to en ("Name") and vi ("Tên"). `GoalEditCard`, `BudgetEditCard`, `AccountEditCard` and `CreateWalletForm` (pre-existing) now use it instead of `categories.name`. `categories.name` stays: `CategoryListScreen` still uses it.
- **Save error clears on the next edit** in all three edit cards. `GoalEditCard` routes every field through a local `edit(set)` wrapper.
- **Dialog `defaultValue`s: no change.** Each one in `DeleteTransactionDialog` and `ArchiveBudgetDialog` matches `en.ts` word for word, which is the repo-wide convention, not drift.
- **Re-verified:**
  - `npm run typecheck`: exit 0.
  - `npm run test -w @sora/mobile`: 594/594.
  - `git diff --stat` on `CreateWalletForm.tsx`: a one-line change. The file is CRLF on disk, as it already was, and the index is LF.

## Follow-ups

- **Not on a device, not in E2E.** Gesture feel, haptics, and the flows changed this session (swipe-delete, guest-register field chaining, add-transaction) need a device or a push. Carried from the previous report.
- **Not built:** editing an account's currency (allowed only while the account is empty) and renaming a wallet. Both need a product decision first.
- **Dead files** awaiting your go-ahead to delete: `planning/components/BudgetCard.tsx`, `GoalCard.tsx`, `accounts/components/AccountDetailModal.tsx`.
- **Commit and push** await an explicit request.
