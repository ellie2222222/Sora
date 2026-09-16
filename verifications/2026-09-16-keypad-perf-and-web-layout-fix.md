# Fix web-only keypad clipping and reduce per-keystroke re-render cost

**Date:** 2026-09-16T00:00:00Z
**Method:** ad hoc (bug fix, no skill invoked)
**Verdict:** PASS — typecheck/tests clean; not visually re-verified in a browser (see Follow-ups)
**Scope:** Two issues reported against the money-keyboard rework, both on web only (native iOS/Android
unaffected per the report): the docked keypad's bottom half being clipped, and general perceived lag
while typing.
**Files touched:** [mobile/src/components/CalculatorKeypad.tsx](../mobile/src/components/CalculatorKeypad.tsx),
[mobile/src/components/MoneyInput.tsx](../mobile/src/components/MoneyInput.tsx),
[mobile/src/components/KeyboardDockProvider.tsx](../mobile/src/components/KeyboardDockProvider.tsx),
[mobile/src/components/BottomSheetModal.tsx](../mobile/src/components/BottomSheetModal.tsx)
**Related reports:** [2026-09-16-money-keyboard-rework.md](2026-09-16-money-keyboard-rework.md),
[2026-09-16-double-check-money-keyboard-rework.md](2026-09-16-double-check-money-keyboard-rework.md)

## Issue 1 — keypad only showing its top half, bottom half clipped (web only)

**Diagnosis:** classic web-only flexbox gotcha. `BottomSheetModal`'s sheet is capped with
`maxHeight` on its outer `Animated.View`; the card `View` below it and the scrollable form content
inside `KeyboardDockProvider` had no explicit `flexShrink`/`minHeight`. Native Yoga (RN's layout
engine) shrinks flex children to fit a `maxHeight`-capped ancestor without needing to be told to;
real CSS flexbox (what `react-native-web` compiles to) defaults a flex item's `min-height` to `auto`,
which refuses to let it shrink below its own content size unless told otherwise. Nothing in this
chain overflowed on native; on web, once the docked keypad pushed total content past `maxHeight`, the
CSS engine's default behavior meant something in the chain didn't shrink — the browser doesn't
resize the box further, so the tail end of it renders past its own bottom edge and is not visible.

**Fix:** explicit `flexShrink: 1, minHeight: 0` on the shrinkable parts of the chain (the card `View`
in `BottomSheetModal.tsx`, the `{children}` wrapper in `KeyboardDockProvider.tsx`), and explicit
`flexShrink: 0` on the docked keypad's own wrapper — CSS flexbox also defaults `flex-shrink` to `1`
(Yoga defaults it to `0`), so without pinning it explicitly the keypad itself could be the thing
getting squeezed on web instead of the scrollable form area above it.

## Issue 2 — perceived lag while typing on the keypad

**Diagnosis:** every keystroke updated `MoneyInput`'s `expression` state, which re-fired its
keypad-registration effect and rebuilt the entire docked JSX (a "Done" row plus the full 20-key
`CalculatorKeypad` grid) and pushed it through `KeyboardDockProvider`'s context. `CalculatorKeypad`
only ever needed the *current* expression value inside its `handlePress` closure (to compute the
next string on insert/backspace) — nothing about its own rendered output (the 20 `Pressable` keys)
actually depends on the expression's value — so reconciling the whole grid on every keystroke was
pure waste.

**Fix:** `CalculatorKeypad` now takes `expressionRef: RefObject<string>` instead of `expression:
string`, reading `expressionRef.current` inside `handlePress`, and is wrapped in `React.memo`.
`MoneyInput` keeps a ref in sync with its own `expression` state and passes that ref down. Since
`expressionRef` (a stable ref object), `onExpressionChange` (`setExpression`, a stable setter) and
`testID` never change reference across keystrokes, `React.memo` now bails out of reconciling the
20-key grid entirely on every keystroke — only the small "Done row" JSX above it still re-renders,
which is unavoidable since it needs to show the live expression text.

## Verified

- `npm run typecheck -w @sora/mobile` — clean.
- `npm run test -w @sora/mobile` — 153/153 (unchanged; no test exercises rendering/reconciliation
  cost or web-specific flex layout).

## Follow-ups

- Not re-verified visually in a browser — this pass fixed the mechanism (flex-shrink chain,
  `React.memo`) based on a well-understood, well-documented cause (the web-CSS-flexbox
  `min-height: auto` default), not from watching it render. Please confirm the keypad renders fully
  and feels snappier on web before considering this closed.
- The reported "keyboard autocloses on every key touch" was called out by the user as a separate,
  web-only artifact they're not asking to be fixed right now (native focus/blur semantics differ from
  web's click-anywhere-blurs-the-input behavior) — left as-is, not addressed this pass.
