# Double-check of the uncommitted editable-transactions, sheet-header and button-role work

**Date:** 2026-10-05T06:10:00Z
**Method:** double-check skill
**Verdict:** PASS (one bug found and fixed)
**Scope:** the whole uncommitted tree: this session's BR-03 reversal, `TransactionFormModal`, the shared sheet header, button roles; also the earlier `server/Dockerfile`, day-card gap and web-warning filter
**Files touched:** `mobile/src/components/BottomSheetModal.tsx`, `mobile/src/app/providers/{ModalProvider.tsx,ModalContext.ts}`, `mobile/src/features/transactions/components/TransactionFormModal.tsx`, `mobile/src/features/goals/components/AddContributionModal.tsx`, `plans/mobile/offline-sync-plan.md`
**Related reports:** [2026-10-05-editable-transactions-sheet-header.md](2026-10-05-editable-transactions-sheet-header.md) (its follow-ups carried forward)

## Method

The delegated sweep agent stopped on a rate limit before reporting; the sweep was done directly:

```bash
grep -rn "AddTransactionModal|EditTransactionModal|SheetFormHeader|TRANSACTION_IMMUTABLE|rejectImmutableFieldsPipe|immutableFieldsNotice|transactionImmutable" (ts/tsx/mjs/yaml/json/md, minus node_modules, dist, verifications)
grep -rn "Close|Cancel" mobile/e2e/flows mobile/e2e/subflows     # flows tapping removed buttons by text
npx tsc -p mobile --noEmit --noUnusedLocals --noUnusedParameters  # filtered to changed files
npx tsc -p server --noEmit --noUnusedLocals; npx tsc -p packages/contracts --noEmit --noUnusedLocals
npm run typecheck; npm run test -w @sora/mobile
```

Read by hand: `TransactionFormModal` reset/fill effects, `updateBodyOf`, server `updateMovement`, `ModalProvider` back/close wiring, `BottomSheetModal` nesting.

## Findings

- **Bug, fixed:** `ModalProvider` passed a close-everything `onClose` to Add Contribution, and that form also calls `onClose` after a successful save, so saving a contribution would have closed the Goal detail too (before, it stayed open showing the new row). Same shape for Edit Transaction, harmless there.
- Form effects: a reopen of the same transaction clears `filledFrom` and refills on the next render; a refetch of the same id never refills over unsaved input; `currentData` keeps another transaction's values out. Clean.
- `updateBodyOf`: untouched form sends `{}`; emptied note sends `null`; a type switch sends type plus the moved account side. Covered by tests.
- Server `updateMovement`: re-checks status in the `UPDATE`'s `WHERE`; locks the new accounts; a contribution removed concurrently makes the mirror update touch 0 rows, harmless. Clean.
- Dangling references: none in code or e2e; one doc line (`offline-sync-plan.md:130`) fixed. `MODAL_UI_STATE.md` keeps historical names under its dated note.
- No unused locals/params in changed files (server, contracts, mobile). Header labels `common.back/close/cancel` exist in `en` and `vi`. No e2e flow taps a removed Close/Cancel by text.
- Rules: no function `style`, no money as number (`updateBodyOf` compares with `parseMoney`), tokens gate passes in the mobile suite, imports follow the barrel rule.

## Fixes Applied

- `BottomSheetModal` gained `onCloseAll`, run only by the header's Close; `ModalProvider` passes plain `closeModal` as `onClose` and the parent's close as `onCloseAll` to `TransactionFormModal` and `AddContributionModal`. A save closes only the form; the header's Close still closes the stack.
- Hardware back now follows the header's Back where there is one (`onRequestClose`), so a sheet step or a sheet reached from another returns there instead of closing.
- Re-verified: `npm run typecheck` clean; `npm run test -w @sora/mobile` 624/624.

## Follow-ups

- Carried forward: no device run of Add vs Edit, the Back/Close stack, button states; Reference field not on the shared form; offline edit of a contribution-backed payment doesn't move the goal in the cache.
- An `ActionSheet` opened inside another sheet (member actions in the wallet sheet) shows Back plus Cancel, and Cancel closes the wallet sheet too. That follows the agreed rule; worth a look on the device whether a menu should be the exception.
