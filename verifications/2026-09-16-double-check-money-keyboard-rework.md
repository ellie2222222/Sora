# Double-check: money-keyboard rework + date-slide/StateView animation fixes

**Date:** 2026-09-16T00:00:00Z
**Method:** double-check skill, Phase 1 broad sweep (delegated to a general-purpose agent, findings
re-verified against its own cited file:line evidence) + Phase 2 pre-completion verification
**Verdict:** PASS — one real bug found and fixed
**Scope:** The most recently built work this session: the calculator-keyboard rework
(`KeyboardDockProvider.tsx`, `MoneyInput.tsx`, `BottomSheetModal.tsx`, `BudgetDetailScreen.tsx`) and
the date-slide/`StateView` animation fixes (`DateStrip.tsx`, `StateView.tsx`,
`TransactionListScreen.tsx`), plus the incidental `Button.tsx` completion. Phase 1 run broadly since
this replaced a whole interaction architecture, not a small scoped fix.
**Files touched:** [mobile/src/components/KeyboardDockProvider.tsx](../mobile/src/components/KeyboardDockProvider.tsx)
**Related reports:** [2026-09-16-money-keyboard-rework.md](2026-09-16-money-keyboard-rework.md) (the
implementation this pass double-checks), [2026-09-16-double-check-calculator-and-button-fix.md](2026-09-16-double-check-calculator-and-button-fix.md)

## Method

Delegated a 10-point sweep to a general-purpose agent, reading `CLAUDE.md` fresh (rule 15 Pressable/
style-as-function, MB-10 barrels) and every touched file's current content + diff against `HEAD`.
Re-typechecked and re-ran the full mobile suite after applying the one fix it surfaced.

## Findings

1. **Rule 15 (Pressable style-as-function)** — clean. No `Pressable` in `KeyboardDockProvider.tsx`
   at all; `MoneyInput.tsx`'s "Done" pill uses a plain-object `style`; `CalculatorKeypad.tsx` still
   uses the documented single `pressedKey` state for its key grid.
2. **Dead code from the superseded always-visible design** — clean. The prior `MoneyInput.tsx` was
   never committed (this whole feature is uncommitted this session), so nothing to leak. Zero
   remaining references to the old `animateEntrance` prop name anywhere in `mobile/src`.
3. **MB-10 barrel compliance** — clean. Cross-directory imports (`@/app/providers`, `@/utils`) go
   through barrels; same-directory imports (`./CalculatorKeypad.tsx`, `./KeyboardDockProvider.tsx`)
   are relative.
4. **React Context correctness — real bug found.** `KeyboardDockProvider.tsx`'s `setDockedKeypad` was
   a plain closure, recreated every render (not `useCallback`-wrapped). `MoneyInput.tsx`'s
   keypad-registration effect includes it in its dependency array, and each firing hands the
   provider a referentially-new JSX element — so the effect re-fired every render with no
   convergence: a genuine infinite re-render loop for the entire time any `MoneyInput` stays focused,
   not just an efficiency concern.
5. **Dock ownership/race logic** — correct as written (traced both interleavings of a fast
   blur-then-refocus-elsewhere), though currently unexercised in practice since none of the 7 real
   call sites ever mount two `MoneyInput`s under one provider scope.
6. **`BudgetDetailScreen.tsx`'s new `flex: 1`** — doesn't affect `ConfirmDialog`, which renders through
   a real `Modal` (a separate native layer), unaffected by a sibling's layout style.
7. **Unused imports** — clean. `DateStrip.tsx` no longer imports `FadeIn`/`FadeOut` at all (not just
   unused); `TransactionListScreen.tsx`'s `FadeOut` import is still genuinely used (the exit
   animation).
8. **`Button.tsx`'s `loadingLabel`** — confirmed still zero call sites, as already documented.
9. **No leftover old `MoneyInput` props** — confirmed no call site still passes `keyboardType`/
   `onChangeText` (which `MoneyInputProps` doesn't declare, so it would silently no-op).
10. **Money-never-a-JS-number rule** — confirmed no regression; `calculatorEngine.ts` and
    `MoneyInput.tsx` still never coerce a `Scaled` bigint through `Number()`.

## Fixes Applied

- [mobile/src/components/KeyboardDockProvider.tsx](../mobile/src/components/KeyboardDockProvider.tsx) —
  wrapped `setDockedKeypad` in `useCallback(..., [])` (its body only closes over a ref and a state
  setter, both stable, so no dependencies needed) and the context value in `useMemo` keyed on it.
  Re-verified: `npm run typecheck -w @sora/mobile` clean, `npm run test -w @sora/mobile` 153/153.
  Not verified via an actual re-render count on-device (this repo has no component-level test
  harness for `mobile/` — see the money-keyboard-rework report's own follow-up on that gap); the fix
  is a standard, well-understood React memoization pattern for exactly this failure mode.

## Follow-ups

Carried forward, unchanged, from [2026-09-16-money-keyboard-rework.md](2026-09-16-money-keyboard-rework.md):
- Not yet verified on an actual iOS/Android device/simulator — the native-keyboard-suppression
  requirement needs a hands-on check this pass didn't perform either.
- `BudgetDetailScreen.tsx` has no `ScrollView` (pre-existing, not introduced by this rework).
- No automated test exercises the focus → dock → blur lifecycle.
