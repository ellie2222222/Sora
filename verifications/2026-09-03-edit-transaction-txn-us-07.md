# TXN-US-07 — correct a transaction (mobile edit screen)

**Date:** 2026-09-03T16:05:00Z
**Method:** ad hoc (single scoped user story; no Phase 1 sweep)
**Verdict:** PASS
**Scope:** One user story from the backend-complete backlog: SRS TXN-US-07 / API spec §11.4. The API,
the Zod schema and `transactionsApi.update()` all already existed with no screen — `mobile/GAPS.md`
tracked it as deliberately absent. This adds the UI only; no server or contract change.
**Files touched:** `mobile/src/features/transactions/screens/EditTransactionScreen.tsx` (new),
`mobile/src/features/transactions/screens/TransactionDetailScreen.tsx`,
`mobile/src/features/transactions/hooks/useTransactions.ts`, `mobile/src/utils/date.ts`,
`mobile/src/app/navigation/types.ts`, `mobile/src/app/navigation/AppNavigator.tsx`, `mobile/GAPS.md`
**Related reports:** [2026-09-03-infra-audit.md](2026-09-03-infra-audit.md) (which enumerated the nine
backend-complete stories this is the first of),
[2026-09-03-status-enum-and-route-test-double-check.md](2026-09-03-status-enum-and-route-test-double-check.md)

## Method

Read the authoritative sources before writing anything, rather than inferring the rules:
`updateTransactionSchema` (`packages/contracts/src/schemas.ts:275-282`), API spec §11.4
(`docs/API_SPECIFICATION.md:844-861`), `TransactionResponse`/`TransactionAccountRef`
(`packages/contracts/src/responses.ts:316-341`), and the existing `AddTransactionScreen`,
`CategoryPicker` and `AddBudgetScreen` for form conventions.

```
npm run typecheck -w @sora/mobile      # clean
npm test -w @sora/mobile               # 36/36
npx expo export --platform web         # 2610 modules (was 2609; +1 = the new screen)
```

## Findings

1. **The four mutable fields, and only those.** §11.4 permits `description`, `transactionDate`,
   `categoryId`, `reference`. Amount, type and the accounts are immutable (BR-03) and return
   `409 TRANSACTION_IMMUTABLE`. The screen omits them entirely rather than rendering them disabled —
   a disabled amount field invites the user to look for a way to enable it, when the real correction
   path is cancel-then-recreate. A caption states that explicitly.
2. **A cancelled transaction cannot be edited at all** (§11.4, last line). Handled twice: the
   `TransactionDetail` entry point only appears when `status === 'COMPLETED'`, and the edit screen
   itself renders an explanatory message instead of a form if it is reached with a cancelled record.
   The second check exists because the first is only a UX affordance (AC-02).
3. **Editing the date preserves the time of day.** `instantOfDay()` deliberately returns midday to
   stop a timezone shift moving the day, so rebuilding the instant through it would have silently
   restamped the recorded clock time. Added `replaceDay(instant, day)` to `mobile/src/utils/date.ts`
   — next to `instantOfDay`, which is where this repo already keeps such helpers — so only the day
   the user actually edited changes.
4. **Only changed fields are sent.** Each field falls back to the loaded value until touched, and the
   submit handler diffs against the loaded record. `updateTransactionSchema` has
   `.refine(… 'Nothing to update')`, so an empty body would be a `422`; the screen navigates back
   instead of sending one.
5. **Category is scoped correctly.** §11.4 requires a changed `categoryId` to keep the same type and
   wallet. `CategoryPicker` is given the wallet from `fromAccount?.walletId ?? toAccount?.walletId`
   (`TransactionAccountRef` carries `walletId`) and the type mapped from the transaction's own type.
   Hidden entirely for `TRANSFER`, which has no category.
6. **Role gating.** The entry point requires `permissions.canWrite` (§11.4 needs `EDITOR`),
   consistent with how `AddTransactionScreen` gates. Server-side enforcement is unchanged and remains
   the actual control (AC-02).
7. **Type-narrowing fix, worth recording.** `handleSubmit` is a hoisted function declaration, so the
   `data === undefined` guard above it did not narrow inside it (`TS18048`). Resolved by passing the
   loaded record in as a parameter rather than by a non-null assertion, which would have silenced the
   compiler without removing the hazard.
8. **The route is now real.** `mobile/src/app/navigation/types.ts` carried a comment explaining that
   `EditTransaction` was deliberately absent so navigating to it would be a type error. That comment
   was removed with the reason it described, and the screen registered as a modal, matching every
   other `Add*` form screen.

## Fixes Applied

Not a fix pass — this is new work. Nothing was found broken in what already existed.

## Follow-ups

- Date entry is a validated `YYYY-MM-DD` text field. No date-picker primitive exists in
  `mobile/src/components/`, and `AddBudgetScreen` likewise derives its dates rather than offering
  one. A shared picker would improve this screen, `AddBudgetScreen` and `AddGoalScreen` together, and
  is worth doing once rather than three times.
- New strings are English literals, matching the 19 screens that still have no `t()` calls. Not
  translated here for the same reason the rest are not; see the i18n entry in `mobile/GAPS.md`.
- Not exercised on a device or against real data — no emulator and no Postgres role locally. The
  request shape is typed against the shared schema and the bundle resolves, which is the strongest
  evidence available here. CI does provision a migrated Postgres for the server job, so a real
  round-trip is writable there.
- Eight backend-complete stories remain: archive account, edit account, adjust budget, archive
  budget, adjust goal, remove contribution, complete/cancel goal, rename wallet.
