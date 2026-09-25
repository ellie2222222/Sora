# Double-check of the keypad-first create sheets and the extract-modules skill

**Date:** 2026-09-24T07:25:56Z
**Method:** double-check skill
**Verdict:** PASS (static; not driven on a device)
**Scope:** the uncommitted tree since `ee24fe1`: five Add* sheets, `SheetFormHeader`/`IconChip`/`KeypadSheetFooter`/`SheetScrollArea`, `confirmExpression`, `issueMessagesByPath`, the `extract-modules` skill and doc edits
**Files touched:** `mobile/src/app/i18n/locales/*.ts` (10), `components/useCalculatorExpression.ts`, `features/goals/components/AddContributionModal.tsx`
**Related reports:** `2026-09-24-budget-goal-keypad-sheets.md`, `2026-09-24-extract-modules-sweep.md`

## Method

```bash
git diff -U0 -- mobile/src | grep '^-' | grep -oE "t\('[a-z]+\.[a-zA-Z.]+'"   # keys the rewrite stopped using
grep -rnF -e "'<key>'" -e '"<key>"' mobile/src   # per key, excluding locales; dynamic t(`...`) keys: none
cd mobile && npx tsc --noEmit && npm run test && npx expo export --platform android
node scripts/check-contract-parity.mjs
```

## Findings

1. **Orphaned translation keys (fixed).** `budgets.period`, `goals.noteOptional`, `goals.targetAmount`, `goals.targetDateOptional` and `transactions.type` have no remaining reader in either quote style. They were removed from all 10 locales, 50 lines in total. Removing a key from the inactive locales follows `92c3807`'s precedent and isn't translation work, so MB-09 isn't affected. tsc flagged each removal target as an excess property, which confirms the right lines were removed.
2. **Dead hook field (fixed).** `useCalculatorExpression().hasOperator` has no reader since AddTransactionModal moved to `confirm()`. Removed.
3. **Inconsistent error placement (fixed).** AddContributionModal passed the account error into the compact `AccountPicker`, which drew it inside the amount row. AddTransactionModal lists the same kind of error under the row. It now goes through `KeypadSheetFooter`'s `errors` like the transaction sheet.
4. Checked and still correct:
   - `MoneyInput` is still used (BudgetDetailScreen); `DateField` and `CategoryPicker` are still used (EditTransactionModal).
   - `Input` forwards `accessibilityLabel` through `...props`, so AddAccount's unlabeled currency field is still named for screen readers.
   - Rule 15: no function `style` in the new files.
   - MB-10: every sheet imports `@/components` through the barrel; the new primitives import their siblings relatively.
   - The new skill's frontmatter parses; the `restructure` ↔ `extract-modules` cross-references agree in both directions.

## Fixes Applied

Findings 1–3 as described. Re-verified after the fixes:
- tsc exit 0
- tests: contracts 75, server 25, mobile 306
- parity 31/31
- Android export bundled

## Follow-ups

- Carried: nothing has been checked on a device yet. Please look at all five sheets, including a short screen where the category grid scrolls.
- Carried: the 19 extraction candidates in `2026-09-24-extract-modules-sweep.md` await a go-ahead.
