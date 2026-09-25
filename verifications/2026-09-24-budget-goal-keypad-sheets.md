# All five create sheets share the keypad-first layout

**Date:** 2026-09-24T06:01:59Z
**Method:** ad hoc
**Verdict:** PASS (static; not driven on a device)
**Scope:** `AddBudgetModal`, `AddGoalModal`, `AddContributionModal` and `AddAccountModal` rebuilt on the `AddTransactionModal` pattern, plus the shared pieces extracted from it
**Files touched:** `mobile/src/components/{SheetFormHeader,IconChip,KeypadSheetFooter,SheetScrollArea}.tsx` (new), `utils/errors.ts` (+`issueMessagesByPath`, tested), `features/goals/components/AddContributionModal.tsx`, `features/accounts/components/AddAccountModal.tsx`, `components/useCalculatorExpression.ts`, `components/index.ts`, `utils/calculatorEngine.ts`, `utils/calculatorEngine.test.ts`, `features/{budgets/components/AddBudgetModal,goals/components/AddGoalModal,transactions/components/AddTransactionModal}.tsx`, `app/i18n/locales/{en,vi}.ts` (`common.clear`), `mobile/MODAL_UI_STATE.md`
**Related reports:** `2026-09-24-session-and-colors-double-check.md`

## Method

```bash
cd mobile && npx tsc --noEmit                                  # clean
node --test src/utils/calculatorEngine.test.ts                 # 34/34
npm run test (root)                                            # contracts 75, server 25, mobile 306
npx expo export --platform android --output-dir <scratchpad>   # bundled
```

## Findings

- **Layout:** all five sheets now share the same structure: `SheetFormHeader`, then an optional selector row (transaction type / budget period), then a scrolling picker area (`CategoryGrid`), then a bordered footer. The footer holds an `IconChip` and the heading-size amount, then the name/note `Input`, then an always-open `CalculatorKeypad` whose ✓ key submits. There is no tap-a-field-first step.
- **Date key:** the transaction key sets the date, the budget key sets the start date, and the goal key sets the deadline. The budget end date is set from the window chip. Picking an end date explicitly stops the period/start from overwriting it, which keeps FR-38 intact. The goal deadline chip has a clear button.
- **Confirm tap:** the decision logic moved from AddTransactionModal into a pure `confirmExpression` (4 new tests), wrapped by `useCalculatorExpression().confirm`. Transaction behaviour is unchanged (line-by-line diff review).
- **Validation:** budget and goal now validate with `createBudgetSchema` / `createGoalSchema` before submitting (MB-03) and show errors per field. Previously goal submit was only disabled on an empty name, and budget sent unvalidated input.
- **Rule 15:** the new `Pressable`s take plain-object `style` only.
- **Contribution:** the "record as expense" checkbox and `CategoryGrid` sit in the scroll area, the compact `AccountPicker` sits in the footer (as in the transaction sheet), and the date key sets the contribution date. Validation uses `createContributionSchema`, keeping the old translated account/amount messages.
- **Account:** the four types are shown as two rows of two. The footer chip shows the type icon and the opening-balance label, with name and currency side by side. There is no date key, because an account has no date. A signed balance is entered with the keypad's `−` (the first ✓ evaluates it, the second submits). A blank keypad submits `0`. Validation uses `createAccountSchema`.
- **Shared footer:** `KeypadSheetFooter`, `SheetScrollArea` and `issueMessagesByPath` replace the copies of the footer block, scroll area and issue loop in all five sheets.
- **Old inputs:** `MoneyInput` is still used by `BudgetDetailScreen`; `DateField` and `CategoryPicker` are still used by `EditTransactionModal`.

## Follow-ups

- Not exercised on a device or emulator. Please check all five sheets visually, including the short-screen case where the budget category grid scrolls.
