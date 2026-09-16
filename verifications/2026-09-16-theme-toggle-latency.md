# Eliminate press-to-animation delay on the theme toggle

**Date:** 2026-09-16T00:00:00Z
**Method:** ad hoc (root-cause investigation via a delegated Explore agent, then a targeted fix)
**Verdict:** PASS — typecheck/tests clean; not measured on a physical device (see Follow-ups)
**Scope:** The theme toggle's ~500ms-1s perceived delay between tap and the color transition
starting. Investigated the full press → state → animation chain: `ThemeToggle`, `AppearanceSection`,
`ThemeProvider`/`AnimatedThemeRoot`, theme persistence, and theme token computation.
**Files touched:** [mobile/src/components/ThemeToggle.tsx](../mobile/src/components/ThemeToggle.tsx),
[mobile/src/app/providers/ThemeProvider.tsx](../mobile/src/app/providers/ThemeProvider.tsx)
**Related reports:** none

## Root cause

Two animations were involved and both were gated behind the same slow path, not the animations
themselves:

1. **`ThemeToggle`'s own knob/track slide** (`ThemeToggle.tsx`) started from a plain `useEffect`
   keyed on the `value` prop. `value` is derived from `themeMode` read through `useThemeControl()`
   — so the animation could only start once React had: committed the press handler's state update,
   propagated it through `ThemeContext`, re-rendered `AppearanceSection` (and its siblings under
   `ThemeProvider`), and flushed effects. The `useEffect` also assigned `slideProgress.value` twice
   in the same tick (`withTiming(...,200ms)` immediately overwritten by `withTiming(...,380ms)`) —
   dead work, not itself a cause of the delay.
2. **The app-wide cross-dissolve overlay** (`AnimatedThemeRoot` inside `ThemeProvider.tsx`) started
   from a `useLayoutEffect` keyed on its own `theme` prop. `ThemeContext`'s value is read via
   `useTheme()` at ~90 call sites across the app (confirmed via `grep -rn "useTheme(" src`), and
   `ThemeProvider` wraps the entire navigator (`App.tsx`) — so a mode/name change forces a
   synchronous re-render of essentially the whole visible tree *before* `AnimatedThemeRoot` even
   receives its new `theme` prop and its `useLayoutEffect` can fire. That JS-thread re-render pass
   is the ~500ms-1s: the `withTiming` calls themselves are near-instant once reached, but reaching
   them was gated behind the full-tree re-render.

Persistence (`preferencesStore.set`, AsyncStorage) and theme token computation (`buildTheme`/
`getThemeColors`, plain synchronous JS) were both ruled out — neither blocks the render/animation
path (state update happens before the `await`; token computation is cheap plain-object construction
with no Reanimated/worklet involvement).

## Fix

Decoupled both animation triggers from the context-driven re-render, firing them synchronously in
the same call stack as the press instead of waiting for a render to complete:

- **`ThemeToggle.tsx`**: `onPress` now calls a new `animateTo(target)` directly (starts
  `slideProgress`'s `withTiming` immediately) *before* calling `onValueChange`, instead of relying
  solely on the `value`-prop-driven `useEffect`. The `useEffect` still runs when `value` catches up
  a render later, but `animateTo` is idempotent against an `animatedTarget` ref, so it's a no-op by
  then — no duplicate/restarted animation. Also removed the dead first `withTiming(...,200ms)` call.
- **`ThemeProvider.tsx`**: `AnimatedThemeRoot` now exposes an imperative `beginTransition(fromBackground)`
  via `forwardRef`/`useImperativeHandle`. `setThemeMode`/`setThemeName` call
  `rootRef.current?.beginTransition(...)` synchronously (reading the previous theme's background off
  a `themeRef` ref) *before* calling `setThemeModeState`/`setThemeNameState` — so the overlay fade
  starts in the same tick as the tap, independent of when the ~90-consumer re-render actually
  finishes. That re-render's cost is now hidden behind the already-fading overlay instead of gating
  its start. The original `useLayoutEffect` is kept as a fallback for theme changes not driven
  through those setters (cache/server hydration on mount); a `pendingImperativeTrigger` ref stops it
  from re-firing a second, duplicate fade for a change `beginTransition` already handled.

No change to visual style, easing, duration, or the toggle's appearance — only when the existing
animations start.

## Verified

- `npm run typecheck -w @sora/mobile` — clean.
- `npm run test -w @sora/mobile` — 153/153 (unchanged; no existing test exercises animation timing).

## Follow-ups

- Not measured on a physical Android device — this fix addresses a well-understood structural cause
  (animation trigger gated behind a large synchronous re-render) rather than a profiled number, per
  the investigation. Please confirm on-device that the tap-to-color-transition gap is gone and that
  rapid repeated toggles still look correct (no flicker, no stuck overlay, no intermediate wrong
  theme) before considering this fully closed.
- The underlying ~90-consumer full-tree re-render on every theme change is still there — this fix
  masks its cost (the overlay is now already covering the screen while it happens) rather than
  eliminating it. If a future profile still shows jank *during* the fade (not before it), reducing
  that consumer count or memoizing further down the tree would be the next lever, but it's out of
  scope for a "smallest change that fixes the latency at its root" pass per the task's own
  constraints.
