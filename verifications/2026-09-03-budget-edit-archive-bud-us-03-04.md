# BUD-US-03 / BUD-US-04 — adjust and archive a budget (mobile)

**Date:** 2026-09-03T16:20:00Z
**Method:** ad hoc (single scoped user story; no Phase 1 sweep)
**Verdict:** PASS
**Scope:** Two backend-complete stories from the infra audit's backlog: SRS BUD-US-03 (adjust) and
BUD-US-04 (archive), API spec §12.4/§12.5. `useUpdateBudget`/`useArchiveBudget` and
`budgetsApi.update`/`.archive` already existed with zero UI callers. UI only; no server/contract change.
**Files touched:** `mobile/src/features/budgets/screens/BudgetDetailScreen.tsx`
**Related reports:** [2026-09-03-infra-audit.md](2026-09-03-infra-audit.md) (source of this backlog item),
[2026-09-03-edit-transaction-txn-us-07.md](2026-09-03-edit-transaction-txn-us-07.md) (same backlog,
same shape of fix — a hoisted-function narrowing bug hit again here, see Findings)

## Method

Read `updateBudgetSchema` (`packages/contracts/src/schemas.ts:324-330`) and API spec §12.4/§12.5
(`docs/API_SPECIFICATION.md:929-945`) before writing anything.

```
npm run typecheck -w @sora/mobile     # clean
npm test -w @sora/mobile              # 36/36
npx expo export --platform web        # 2610 modules, unchanged (no new file this time)
```

## Findings

1. **Only `name`/`amount`/`status` are adjustable.** §12.4 explicitly forbids moving `categoryId`,
   `periodType`, `startDate` or `endDate` — a moved window covers different transactions, i.e. is a
   different budget; archive and create instead. The screen offers exactly the two editable fields
   and nothing else; the immutable ones stay display-only in the existing summary card.
2. **Archive and update are separate operations** (`DELETE` vs `PATCH`, per spec), not one form with a
   status toggle. Matches: a distinct "Archive budget" button and its own `ConfirmDialog`, mirroring
   `WalletDetailScreen`'s established archive/leave pattern rather than inventing a new one.
3. **An archived budget can't be edited or re-archived.** `canEdit = permissions.canWrite &&
   data.status === 'ACTIVE'` hides the whole edit card once archived — there is no unarchive endpoint
   in the spec, so no such action is offered.
4. **Same hoisted-function narrowing bug as the transaction-edit pass, caught by typecheck the same
   way.** `handleSave` is a function declaration; TypeScript does not carry the earlier
   `data === undefined` guard's narrowing inside it (`TS18048`). Fixed identically: the loaded record
   is passed in as a parameter instead of asserted non-null. Worth naming as a pattern now that it's
   hit twice — any detail-screen mutation handler declared this way needs the same treatment.
5. **Save is disabled until something actually changed** (`isDirty`), and the request body only
   includes fields that differ from the loaded record — `updateBudgetSchema`'s
   `.refine(… 'Nothing to update')` means an unchanged submission would otherwise be a `422`.
6. **Role gating matches the established convention**, not a new one: `useWallets().permissions` (the
   active-wallet context), the same source `TransactionDetailScreen` and `GoalDetailScreen` already
   use for a detail screen whose resource isn't necessarily the active wallet. Server-side enforcement
   (§12.4/§12.5's `EDITOR` minimum) is the actual control regardless.

## Fixes Applied

Not a fix pass — new work. Nothing found broken in what already existed.

## Follow-ups

- Amount validation is whatever `Input`'s `decimal-pad` keyboard plus server-side
  `positiveAmountSchema` provide; no client-side "must be positive" message before submit. Matches
  `AddBudgetScreen`'s existing amount field, so not a new gap introduced here.
- Not exercised on a device or against real data (no emulator, no Postgres role locally).
- Seven backend-complete stories remain: archive/edit account, adjust goal, remove contribution,
  complete/cancel goal, rename wallet.
