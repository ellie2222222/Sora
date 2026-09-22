# Double-check: AddTransactionModal redesign (header/category grid/persistent calculator dock)

**Date:** 2026-09-21T00:00:00Z
**Method:** double-check skill — Phase 1 broad sweep (delegated to a general-purpose agent, its
findings re-verified against CLAUDE.md rules 14/15 and MB-09/MB-10) + Phase 2 pre-completion
verification
**Verdict:** PASS
**Scope:** The most recently built feature this session — the full `AddTransactionModal.tsx`
redesign (custom Cancel/title/currency header, inline `CategoryGrid.tsx`, persistent
amount/note/keypad dock, two-stage checkmark confirm logic), the `insertToken`/
`hasTrailingOperator` pure helpers added to `calculatorEngine.ts`, `CalculatorKeypad.tsx`'s use of
them plus its new key borders, the require-cycle fix (direct relative imports for
`AccountPicker`/`CategoryGrid` instead of their feature barrels), and the border additions to the
Today/Confirm pills and the dock's top divider. Run broadly (not just Phase 2) since this replaced
a whole screen's interaction model, not a small scoped fix. Does not re-audit the
cancelled→deleted rename underneath it — that's separate, earlier work.
**Files touched:** none this pass (report-only; no findings required a code change)
**Related reports:** [2026-09-16-double-check-money-keyboard-rework.md](2026-09-16-double-check-money-keyboard-rework.md)
(the prior `MoneyInput`/`CalculatorKeypad` review this pass builds on),
[2026-09-16-modal-form-consistency-review.md](2026-09-16-modal-form-consistency-review.md) (fixed
`AddTransactionModal`'s duplicate-`AccountPicker` bug this redesign was checked not to reintroduce)

## Method

Read `CLAUDE.md` fresh (rule 14 barrel/require-cycle, rule 15 Pressable-style-as-function,
MB-09/MB-10). Delegated a targeted sweep to a general-purpose agent covering: dead code
(`CategoryPicker.tsx` orphaned?), the `handleConfirm()` two-stage logic traced against the exact
evaluate/strip/submit table against file:line evidence, `any`/unused imports across the 5 touched
files, `CategoryGrid` vs `CategoryPicker` duplication, i18n key parity, and `insertToken`'s
operator-replace guard against `evaluateExpression`'s own unary-minus grammar. Re-verified its
one finding myself. Re-ran typecheck and the full mobile suite after the border-addition edits
that landed after the agent's sweep was scoped.

## Findings

1. **Dead code** — clean. `CategoryPicker.tsx` still has real callers (`EditTransactionModal.tsx`,
   `AddBudgetModal.tsx`, `AddContributionModal.tsx`); nothing else among the 5 touched files is
   now unreferenced.
2. **`handleConfirm()` two-stage table** — matches exactly, traced against
   `AddTransactionModal.tsx:128-140`: `"100"` → submit; `"100+50"` → evaluate to `150.0000`, stay
   open; `"100+50×"` → strip to `"100+50"`, stay open; `"100+"` → strip to `"100"`, stay open.
3. **Negative result path** — clean. `"−5+3"` → -2 evaluates without crashing;
   `formatMoney`/`displayAmount`'s magnitude+prefix handling both cover it; submitting a negative
   amount is rejected by `schemas.ts`'s existing "must be greater than zero" check (unaffected,
   pre-existing contract validation), surfacing as a normal field error, never a crash.
4. **`any`/unused imports/exports** — clean across all 5 files.
5. **`CategoryGrid` vs `CategoryPicker` duplication** — the "default to first category" effect is
   duplicated but byte-identical, ~7 lines; acceptable given the two are genuinely different
   interaction patterns (inline grid vs. tap-to-open sheet), not a real finding.
6. **i18n parity (MB-09)** — clean. Every new/changed string uses `t(key, {defaultValue})`; `en.ts`
   and `vi.ts` both carry every referenced key with full parity.
7. **Rule 15 (Pressable style-as-function)** — clean, re-checked `CategoryGrid.tsx`'s
   `CategoryCell` and `CalculatorKeypad.tsx`'s key grid specifically; both use
   `useState`+`onPressIn`/`onPressOut` with a plain-object `style`.
8. **`insertToken`'s operator-replace guard vs. unary minus — investigated, not a bug.** Typing
   `5`, `×`, `−` produces `"5−"` (the `×` is replaced), not `"5×−"`, even though
   `evaluateExpression`'s grammar (`parsePower`→`parseUnary`, `calculatorEngine.ts:170-188`)
   can evaluate a unary minus as an operator's right-hand side. This is a **deliberate consequence
   of the user's own explicit spec**, not an oversight: the spec's duplicate-operator section gives
   `"100 + → press × → 100 ×"` / `"Never produce: 100 + ×"` as the literal rule, with no carve-out
   for a second operator that happens to be `−`. There is no way to distinguish "replace my
   mistake" from "I meant unary minus" from the keystroke alone — special-casing `−` to stack
   would silently reintroduce exactly the `"100 + −"` double-operator case the spec explicitly
   forbids. The workaround the keypad already supports is parentheses (`5×(−2)`), since `(` isn't
   an operator glyph and `insertToken` only replaces when the *immediately preceding* character is
   one. Left as-is; documented here as a known, spec-driven keypad limitation rather than fixed.

## Fixes Applied

None needed.

## Follow-ups

- Not visually verified on a device/simulator — no emulator/ADB access this session (carried
  forward from every UI change this session).
- "Multiply/divide by a negative number" needs parentheses on this keypad (`5×(−2)`, not
  `5×−2`) — see Finding 8. Worth surfacing to the user only if it turns out to be an unwanted
  limitation in practice, not fixed pre-emptively since it currently matches their own spec.
- Carried forward from [2026-09-16-double-check-money-keyboard-rework.md](2026-09-16-double-check-money-keyboard-rework.md):
  no automated test exercises a focus/interaction lifecycle end-to-end (no component-level test
  harness exists in `mobile/` — everything here is `node --test` on pure logic).
