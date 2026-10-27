# Theme colour transition, status bar on light themes, carousel `DECK` worklet error

**Date:** 2026-10-19T11:01:43Z
**Method:** ad hoc
**Verdict:** BLOCKED (on device); static checks PASS
**Scope:** User-reported: theme switch changes colours abruptly; white-theme status bar text invisible; `ReferenceError: Property 'DECK' doesn't exist` flooding Metro. Changes since 2026-10-19-double-check-accounts-cards.md.
**Files touched:** `mobile/src/design-system/motion.ts` (new), `mobile/src/components/Themed.tsx` (new), `components/Text.tsx`, `app/providers/ThemeProvider.tsx`, `App.tsx`, `app/navigation/{AppNavigator,MainTabNavigator}.tsx`, ~90 component/screen files (codemod), `features/accounts/carouselLayout.ts`, `components/refresh/pullMath.ts`, `CLAUDE.md`, `.agents/rules/bug-prevention-and-gotchas.md`, `docs/DESIGN_GUIDELINES.md`
**Related reports:** 2026-10-19-double-check-accounts-cards.md (its "theme sweep not seen on device" follow-up is superseded)

## Method

- `DECK`: compiled `carouselLayout.ts` with `@babel/core` + `react-native-worklets/plugin` and printed each worklet's serialized `code` string; then the same over every `'worklet'` file in `mobile/src` looking for `=` in a worklet's parameter list.
- Colour transition: read `react-native-reanimated@4.5.1` `src/css` (transition types, `CSSColor` interpolator, `_setComponentRef` ref forwarding) and `react-native-css-interop` `runtime/components.js` (which components resolve `className`).
- `npx tsc --noEmit -p mobile`; `npm run typecheck`; `npm run test -w @sora/mobile`; `tsc --noUnusedLocals` filtered to touched imports; `git ls-files --eol` over changed files.

## Findings

1. `DECK` → serialized worklet was `function deckPose(offset,fadeEnd=DECK.visibleRange){const{DECK}=this.__closure;…`: a default parameter is evaluated before the body unpacks the closure, so every UI-thread call without `fadeEnd` (the names row) threw. FAIL → fixed: optional parameter resolved in the body. Same latent shape in `pullMath.ts` (3 functions; UI callers always passed the argument) → fixed. Rescan: no worklet with a default parameter remains. CLAUDE.md Part 7 rule 19 + Antigravity port added.
2. Status bar → `<StatusBar style="auto" />` follows the OS scheme, not the app theme: light theme on a dark-mode phone drew white status text on white. FAIL → fixed: rendered in `ThemeProvider` with `theme.mode === 'light' ? 'dark' : 'light'`.
3. Theme colours → plain style values on plain `View`/`Text`; a switch changes them in one render, so nothing can interpolate. The previous sweep/crossfade only hid that render. Reanimated 4 CSS transitions interpolate colours natively but only on Reanimated components; lucide writes `stroke` onto every path, so icon colour cannot be transitioned from outside. → `theme.motion.colorTransition` (200 ms ease-in-out; 0 under Reduce Motion and on web) applied through `ThemedView`/`ThemedPressable`/`ThemedScrollView`/`ThemedTextInput` (own `createAnimatedComponent` types registered with `cssInterop`, so `Animated.View` itself is untouched), `Text` as `Animated.Text` (nested spans stay plain and inherit), `ThemedIcon` (old-colour icon faded out over the new one = colour interpolation over identical strokes). Root backdrop transitions; Main card and tab scenes transparent over it. Sweep removed.
4. Conversion → AST codemod: host `View`/`Pressable`/`ScrollView` whose `style` mentions a colour/background/shadows → themed primitive; self-closing lucide icon with `color` → `ThemedIcon`. Reviewed by hand: 19 icon components passed as props, `Animated.View`s (tab indicator, toggle thumb, net-worth panel given the transition; RN-`Animated` skeleton/sheet backdrop and off-screen guest/chat views left), style-helper sites (`SegmentedControl`, `DatePresetSheet`, `NetWorthSummary` converted; `PeriodBar`, `StateView`, `ConnectionSyncStatus` carry no theme colour at rest). Static palette swatches left plain.
5. Static checks → `tsc` exit 0 (mobile and root `npm run typecheck`); mobile 803/803; no unused `View`/`Pressable`/`Themed*` imports; all changed files LF. PASS.

## Fixes Applied

As in Findings 1–4. Each re-verified by the commands in Method after the last edit.

## Follow-ups

- Not exercised on a device (phone not on adb, Metro stopped at the user's request): the colour easing, icon crossfade, status bar, and the `DECK` fix all need a look after a Metro reload. No native rebuild needed (no new dependency).
- A pressed-state background on a converted `Pressable` now eases over 200 ms too.
- A tab frozen by `freezeOnBlur` re-renders when next shown, so it eases from the old theme once on entry.
- Pushed `CategoryList` screen keeps its navigator-painted card and header (theme cannot be switched from it).
- Not converted: `FlatList`/`SectionList` backgrounds, `placeholderTextColor`/`selectionColor` props, SVG charts (`DonutChart`, `TrendBarChart` fills), RN-`Animated` views.
- Card styles picker (10+ styles and colours, user request) not started.
