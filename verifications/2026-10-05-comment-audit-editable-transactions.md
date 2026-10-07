# Comment audit of the uncommitted editable-transactions / sheet-header work

**Date:** 2026-10-05T06:25:00Z
**Method:** comment-audit skill
**Verdict:** PASS
**Scope:** comment lines added in `git diff` (ts/tsx/mjs, locales excluded) plus every comment in the untracked `TransactionFormModal.tsx`, `SheetHeader.tsx`, `webLibraryWarnings.ts`. Policy: CLAUDE.md Part 7 rule 11.
**Files touched:** `mobile/src/features/transactions/components/TransactionFormModal.tsx`, `mobile/src/services/guest/guestTransactions.ts`, `mobile/src/features/goals/components/AddContributionModal.tsx`
**Related reports:** [2026-10-05-double-check-editable-transactions.md](2026-10-05-double-check-editable-transactions.md), [2026-10-05-comment-audit.md](2026-10-05-comment-audit.md) (its flag-only items carried forward)

## Method

```bash
git diff -U0 -- '*.ts' '*.tsx' '*.mjs' ':!**/locales/**' | grep -E '^\+\s*(//|/\*|\*|\{/\*)'
grep -nE '^\s*(//|/\*\*|\*|\{/\*)' <each untracked file>
cp <file> <scratch>/ca-before-*; <edit>; diff <before> <after>   # comment-only proof
npm run typecheck; npm run test -w @sora/mobile
```

## Findings

- `guestTransactions.ts:249` — `/** Parses with the shared schema, translating a failure into the API's error envelope. */` above `parseCreate` (`safeParse` + `fromZodError`). Pattern 1, restates the code. Deleted.
- `TransactionFormModal.tsx:343` — skeleton doc narrated its layout ("type row, fields, then the keypad"). Pattern 8. Rewritten to the why: shaped like the form so nothing jumps when it fills (source: DESIGN_GUIDELINES Part 2 "Loading preserves the final layout").
- `AddContributionModal.tsx:42` — `onBack`'s doc read as a noun ("The goal sheet this was opened from"). Clarified to "Returns to the goal sheet this was opened from."
- Kept, each a real why: the reset/fill comments in `TransactionFormModal` (`currentData`, hook order, wallets-loading gate), `BottomSheetModal`'s nesting/Back/hardware-back notes, `transactionsApi`'s read-before-patch note, `schemas.ts`'s null-account-side note, server `updateMovement`'s delete race and both-wallets audit notes, `pendingTotals`' `inPlace`, `webLibraryWarnings`' library-origin note.
- No commented-out code, untracked TODO/FIXME or magic-count claims found. No missing why found in the changed code.
- Comment-only proof: the three diffs touch comment lines only; typecheck clean; mobile 624/624.

## Fixes Applied

The three edits above, re-verified by the suites listed.

## Follow-ups (flag-only, not fixed by design)

- `TransactionDetailModal.tsx` carries uncommitted changes this session did not make (+111/−63, a layout rework). Its new doc block's second paragraph narrates the visual hierarchy (pattern 6/8); left for whoever owns that change.
- Cross-file references that resolve but nothing keeps in sync: `AddBudgetModal.tsx:22` and `AddContributionModal.tsx:23` → `TransactionFormModal.tsx`'s deep-import comment; `guestTransactions.ts` "Mirrors `transactions.service.ts`'s `checkWrite`/`updateMovement`".
- Duplicated why-prose: the deep-import/require-cycle explanation in `TransactionFormModal.tsx:22`, `AddContributionModal.tsx`, `AddBudgetModal.tsx` (carried from the earlier audit).
