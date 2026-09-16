# Rework calculator keypad into a true keyboard-replacement for money fields

**Date:** 2026-09-16T00:00:00Z
**Method:** ad hoc (architecture rework, no skill invoked)
**Verdict:** PASS — typecheck/tests clean; not run on a device/simulator (see Follow-ups)
**Scope:** Replaces the always-visible inline-keypad-under-the-field design from earlier this
session with a real focus-driven, keyboard-replacing custom keypad, per explicit correction: the
prior design ("calculator UI sitting above the native keyboard") was wrong — the keypad must occupy
the same conceptual role the native keyboard plays, appearing only while the field is focused and the
native keyboard must never appear underneath it.
**Files touched:** see below.
**Related reports:** [2026-09-16-calculator-money-input.md](2026-09-16-calculator-money-input.md)
(the superseded always-visible design), [2026-09-16-double-check-calculator-and-button-fix.md](2026-09-16-double-check-calculator-and-button-fix.md)

## Architecture

- **`mobile/src/components/KeyboardDockProvider.tsx`** (new) — a `React.Context` provider. Exposes
  `useKeyboardDock()` → `{ setDockedKeypad(id, node | null) }`. Renders `{children}` then, if a node
  is registered, that node in a `SlideInDown`/`SlideOutDown`-animated `Animated.View` (240ms in /
  200ms out — a fixed-duration slide, deliberately not a spring, per "no excessive bounce"). Ownership
  is id-tracked so a field that already lost focus can't clear a different field's now-focused dock.
- **`BottomSheetModal.tsx`** wraps `{children}` in `<KeyboardDockProvider applySafeArea={false}>` —
  the sheet already reserves its own bottom safe-area skirt, so the provider doesn't double it.
- **`BudgetDetailScreen.tsx`** (the one call site that's a plain stack screen, not a modal) wraps its
  own root in `<KeyboardDockProvider>` (default `applySafeArea=true`) so the same mechanism works
  there too.
- **`MoneyInput.tsx`** — full rework. Now renders a real `TextInput` (not a `View`+`Text` display):
  - `showSoftInputOnFocus={false}` is the actual suppression mechanism — the field stays the
    focused/cursor-bearing element (`caretHidden={false}`), but nothing brings up the OS keyboard.
    `onChangeText={() => {}}` is a deliberate no-op: with the native keyboard suppressed there's no
    path for real typed input to arrive through it, so nothing needs to be captured there — the
    calculator keypad is the only writer to `expression`.
  - On focus, registers `<Check/>`-and-expression header + `<CalculatorKeypad/>` with
    `setDockedKeypad`; on blur, unregisters. An unmount-cleanup effect unregisters too, so a
    closed/navigated-away screen never leaves a stale keypad docked.
  - Android hardware back button, while focused, blurs the field (closing the keypad) instead of
    falling through to the modal's own `onRequestClose` — same order a real keyboard would resolve
    back in.
  - Kept from the prior design: the `lastEmittedRef` external-value resync (still needed —
    `AddTransactionModal.tsx` doesn't unmount on close) and the negative-sign display fix (VL-04,
    `initialBalance`).
- **`CalculatorKeypad.tsx`** — unchanged; it was already a pure `expression`/`onExpressionChange`
  component with no assumptions about where it's rendered, so it works identically whether inlined
  (prior design) or rendered through the dock (this one).

## Findings from investigation (before implementing)

- Confirmed via a research pass: no existing pattern in this codebase already does "a real
  `TextInput`'s focus event drives a bottom-docked custom UI" — the closest analog
  (`DateField`/`DatePickerModal`) sidesteps the problem by using a fake `Pressable` field with no
  `TextInput` at all, externally `visible`-prop-driven. This is a genuinely new interaction shape
  for this codebase, not a reuse of an existing one.
- `react-native-keyboard-controller` is not a dependency; `react-native-reanimated` v4.5.1 (already
  used extensively — `DateStrip.tsx`, `AnimatedScreen.tsx`) provides everything needed
  (`SlideInDown`/`SlideOutDown`) without adding a new package.
- All 7 `MoneyInput` call sites confirmed already sitting inside a `BottomSheetModal` except
  `BudgetDetailScreen.tsx` — grepped and cross-checked against `BottomSheetModal` usage in each file
  after the change, all 6 confirmed nested correctly.

## Fixes Applied

N/A — this is the implementation pass itself, not a fix pass over something else.

## Verified

- `npm run typecheck -w @sora/mobile` — clean.
- `npm run test -w @sora/mobile` — 153/153 (unchanged; no test exercises focus/keyboard behavior
  directly, see Follow-ups).

## Follow-ups

- **Not run on a device/simulator.** This pass verified logic/wiring (typecheck, unit tests) only.
  The critical requirement — the native keyboard must never appear simultaneously with the custom
  keypad on both iOS and Android — needs an actual on-device check per the user's own instruction to
  verify on both platforms; `showSoftInputOnFocus` historically had iOS gaps in older React Native
  versions, so this is the one part of the spec that can't be confirmed from source alone.
- `BudgetDetailScreen.tsx` has no `ScrollView` at all (pre-existing, not introduced by this change) —
  if the docked keypad plus its existing content overflow the screen height on a small device, there's
  nothing to scroll. Worth a follow-up if it turns out to matter on-device.
- No automated test exercises the focus → dock → blur lifecycle (would need a component-level RN
  Testing Library setup, which this repo doesn't have for `mobile/` yet — only `node --test` pure-logic
  tests). Flagging rather than adding new test infrastructure unasked.
