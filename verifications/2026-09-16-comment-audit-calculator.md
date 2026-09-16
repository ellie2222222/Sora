# Comment audit: calculator/MoneyInput feature and the Button.tsx fix

**Date:** 2026-09-16T00:00:00Z
**Method:** comment-audit skill
**Verdict:** PASS — no violations, no missing-comment gaps
**Scope:** Files touched this session — the calculator-keypad/`MoneyInput` feature and the incidental
`Button.tsx` compile-fix found during the double-check pass. Not a whole-repo sweep.
**Files touched:** none this pass — every file audited was already clean.
**Related reports:** [2026-09-16-comment-audit.md](2026-09-16-comment-audit.md) (prior session pass,
carries two still-open follow-ups below), [2026-09-16-calculator-money-input.md](2026-09-16-calculator-money-input.md),
[2026-09-16-double-check-calculator-and-button-fix.md](2026-09-16-double-check-calculator-and-button-fix.md)

## Method

Read `CLAUDE.md` Part 7 rule 11 (comments explain *why*, never *what*) fresh. Read every file touched
this session directly (small set, no delegated search agent needed):
`mobile/src/utils/calculatorEngine.ts`, `mobile/src/components/MoneyInput.tsx`,
`mobile/src/components/CalculatorKeypad.tsx`, `mobile/src/components/Button.tsx`, and diffed the
remaining seven call-site files (`AddTransactionModal.tsx`, `AddBudgetModal.tsx`,
`BudgetDetailScreen.tsx`, `AddGoalModal.tsx`, `AddContributionModal.tsx`, `AddAccountScreen.tsx`,
`AddAccountModal.tsx`, plus the two barrel `index.ts` files) to confirm none of their diffs touched a
comment at all.

## Findings

- `calculatorEngine.ts` — one file-level docstring (rule-1 cross-reference plus the rationale for
  reusing `parseMoney` for every literal instead of reimplementing decimal parsing) and two inline
  JSDoc comments on `evaluateExpression`/`tryEvaluate` explaining the throw-vs-null contract between
  them. All three are genuine *why*s (an external rule cross-reference, a non-obvious design choice, an
  API contract a caller must know) — left as-is, nothing to fix.
- `MoneyInput.tsx` — three comments: the `lastEmittedRef` rationale (why an echo-tracking ref exists,
  tied to a specific fact about which modals stay mounted), the "commits its last valid result" note on
  the live-evaluation effect, and the `formatCurrencyInput` sign-stripping quirk note on `displayValue`.
  All three explain a real non-obvious constraint or external-function quirk — none restate the code
  next to them, none flagged.
- `CalculatorKeypad.tsx` — zero comments. Checked whether one was owed (dense conditional logic, magic
  values): the keypad layout and press-handling are self-evident from naming
  (`isPressed`/`isClear`/`isOperator`, `ROWS` data), and `46` (key height) isn't a value a reader would
  misjudge without explanation. No gap.
- `Button.tsx` — the completed-and-fixed `loadingLabel` branch carries no new comments; the merge itself
  needed no explanation beyond the existing `pressed`-state comment (rule 15 cross-reference, unrelated
  to this session's edit and still accurate). No gap, nothing stale.
- The seven remaining call-site diffs (`Input` → `MoneyInput` swaps, one `parseFloat` → `parseMoney`
  fix in `AddContributionModal.tsx`, two barrel-export additions) — confirmed via `git diff` that none
  added, removed, or touched a comment line at all.

## Fixes Applied

None — nothing to fix in this session's own new/changed files.

## Follow-ups

Carried forward, unchanged, from [2026-09-16-comment-audit.md](2026-09-16-comment-audit.md) (neither
file was touched this session):
- `mobile/src/features/dashboard/screens/HomeScreen.tsx:12-14` — still has a debug-journal-style
  "(unlike the old global FAB this replaced)" clause.
- `AccountPicker.tsx`/`CategoryPicker.tsx`'s duplicated default-to-first-item comment, and
  `StateView.tsx:66-70`'s long fallback-justification comment — both still flagged as code-change-
  required, not a comment-only fix.
