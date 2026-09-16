# Double-check: calculator money-input feature, plus a broken Button.tsx found mid-pass

**Date:** 2026-09-16T00:00:00Z
**Method:** double-check skill (Phase 1 broad sweep skipped — the infra-audit skill just ran a broad
sweep this same session, see [2026-09-16-infra-audit.md](2026-09-16-infra-audit.md); Phase 2
pre-completion verification scoped to the calculator/`MoneyInput` feature just built)
**Verdict:** PASS (one real defect found and fixed — see below)
**Scope:** The calculator-keypad/`MoneyInput` feature from this session
([2026-09-16-calculator-money-input.md](2026-09-16-calculator-money-input.md)) — confirming full
scope coverage and re-running verification, not a whole-repo sweep.
**Files touched:** [mobile/src/features/budgets/screens/BudgetDetailScreen.tsx](../mobile/src/features/budgets/screens/BudgetDetailScreen.tsx),
[mobile/src/components/Button.tsx](../mobile/src/components/Button.tsx)
**Related reports:** [2026-09-16-calculator-money-input.md](2026-09-16-calculator-money-input.md)
(what this pass re-verifies), [2026-09-16-infra-audit.md](2026-09-16-infra-audit.md) (covers Phase 1's
ground this same session)

## Method

- Grepped for any `keyboardType="decimal-pad"`/`"numbers-and-punctuation"`/`"numeric"`/`"number-pad"`
  left in `mobile/src` to confirm the calculator report's "every money field app-wide" scope was
  actually complete, rather than trusting the original research agent's file list.
- Grepped for any remaining `onChangeText={set...Amount}`/`set...Balance` handler to double check from
  the other direction.
- Re-ran `npm run typecheck -w @sora/mobile` and `npm run test -w @sora/mobile` after each fix.
- `git status --short` for full working-tree shape.

## Findings

1. **A 7th money-input call site was missed by the original scope survey** —
   `mobile/src/features/budgets/screens/BudgetDetailScreen.tsx:120-126`, the inline "Edit budget" amount
   field, still used `<Input keyboardType="decimal-pad">`. The original research agent's grep
   (`amount|initialBalance|targetAmount`) matched this file's `amount` state variable but the file was
   apparently classified as read-only/display during that pass and not flagged. Real gap against the
   user's explicit "every money field app-wide" scope choice.
2. **Real, unrelated defect found sitting in the working tree: `mobile/src/components/Button.tsx` did
   not compile.** Not something this session wrote — `git diff` showed an in-progress, uncommitted
   addition of a `loadingLabel?: string` prop (plus a `useTranslation` import) that left two sibling JSX
   elements (the original `<ActivityIndicator/>` and a new `<>...</>` fragment) directly concatenated
   inside the `loading ? (...) : (...)` ternary's true branch — "JSX expressions must have one parent
   element" (TS2657), breaking `tsc --noEmit` for the whole `@sora/mobile` package. This was blocking
   the very typecheck this pass needed to run, so it had to be resolved rather than worked around.

## Fixes Applied

1. **BudgetDetailScreen.tsx** — replaced the `Input` amount field with `MoneyInput` (same pattern as the
   other 6 call sites), import updated. Re-verified: `npm run typecheck -w @sora/mobile` clean,
   `npm run test -w @sora/mobile` 153/153 (unchanged count — no new coverage needed, same component
   already tested).
2. **Button.tsx** — completed the interrupted edit rather than reverting it, since a `loadingLabel` prop
   is a self-contained, backward-compatible addition and nothing else in the tree referenced it yet
   (confirmed via `grep -rn loadingLabel mobile/src` — zero call sites use it). Merged the two sibling
   loading-state elements into one `<>` fragment: kept the original `ActivityIndicator`'s
   disabled/variant-aware color logic (the newly-added second spinner had regressed that to a flat
   `textColor`), and show `loadingLabel` only when a caller actually passes it — no default fallback
   text, so every existing `loading` button keeps its exact current bare-spinner appearance. Removed the
   now-unused `useTranslation` import and `t` binding (the interrupted edit's default-text fallback was
   dropped, not adapted, since defaulting every loading button in the app to a "Loading…" label would
   have been an unrequested, app-wide visible change). Re-verified: `tsc --noEmit` clean, full mobile
   test suite still 153/153.

## Follow-ups

- `Button`'s new `loadingLabel` prop has no callers yet — whoever was mid-edit on it (not this session)
  may still want to wire it into a specific button; left as an opt-in, unused addition rather than
  guessing where it belongs.
- Everything else from [2026-09-16-infra-audit.md](2026-09-16-infra-audit.md) (Finding 11, the
  duplicated add-account form; Finding 14, MB-02 vs. reality; etc.) stands as the current record — not
  re-scanned this pass, this pass was scoped to the calculator feature plus the blocking Button.tsx fix.
