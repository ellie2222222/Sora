# Pull-to-refresh moved onto react-native-gesture-handler (direct dependency, UI-thread pan)

**Date:** 2026-09-24T04:11:35Z
**Method:** ad hoc
**Verdict:** PASS (typecheck, unit tests, Android bundle); gesture not exercised on a device
**Scope:** adding `react-native-gesture-handler` as a direct `@sora/mobile` dependency, the app-root
`GestureHandlerRootView`, and rebuilding `components/refresh/*` on it. The bottom sheet was left on
`PanResponder` (not requested).
**Files touched:** `mobile/package.json`, `package-lock.json`, `mobile/src/App.tsx`,
`mobile/src/components/refresh/{usePullToRefresh.ts,PullToRefreshContainer.tsx,RefreshableScrollView.tsx,RefreshableFlatList.tsx,RefreshableSectionList.tsx}`,
`CLAUDE.md` (Part 6 mobile stack), `mobile/MODAL_UI_STATE.md` (stale sheet thresholds)
**Related reports:** [2026-09-24-pull-to-refresh-rework-double-check.md](2026-09-24-pull-to-refresh-rework-double-check.md)
(closes its Android follow-up)

## Method

- `npm ls react-native-gesture-handler` before and after; `npx expo install react-native-gesture-handler` in `mobile/`
- `npx tsc --noEmit` (mobile); `npm run test -w @sora/mobile`
- `npx expo export --platform android --output-dir <scratchpad>/export-android`
- `git check-ignore mobile/android`; grep `mobile/android` for gesture-handler linking

## Findings

1. Dependency before → `@sora/mobile → @react-navigation/stack → react-native-gesture-handler@2.32.0`
   only; root `overrides` pins `~2.32.0`; no import anywhere in `mobile/src`; no root view.
   After `expo install` → `mobile/package.json` `"react-native-gesture-handler": "~2.32.0"`, `npm ls`
   shows it direct with the stack's copy `deduped`. Lockfile: the one dependency line plus `peer: true`
   flags dropped from its now-direct subtree (`@egjs/hammerjs`, `@types/hammerjs`, …). PASS.
2. `App.tsx` → whole tree inside `<GestureHandlerRootView style={{ flex: 1 }}>`. PASS.
3. Pull gesture → `Gesture.Simultaneous(Pan, Native)` on the list: the list keeps its native scroll;
   the pan activates on a downward drag only (`activeOffsetY(6)`), fails on sideways travel
   (`failOffsetX ±14`), and counts the pull only from the moment `scrollY` (UI-thread
   `useAnimatedScrollHandler`) is at the top. Update/release run as worklets; release in TRIGGERED
   starts the icon→spinner crossfade and the settle spring on the UI thread in the same frame, then
   hands the refresh call to JS. Native interception can no longer cancel the pull (the Android risk).
4. Lists → `Animated.ScrollView` / `Animated.FlatList` / `createAnimatedComponent(SectionList)` (typed
   alias restores its generics). `onScroll` (no caller uses it) and, for FlatList,
   `CellRendererComponent` (Reanimated's FlatList owns it) removed from the wrapper prop types.
5. Typecheck → clean. Tests → 235/235. Android bundle → exported, 7.4MB `.hbc`, no errors. PASS.
6. `mobile/android` → gitignored local prebuild; no gesture-handler linking in it. Expo Go (every
   `--go` script) ships the native module; a dev-client build needs a rebuild. Not a code defect.
7. Docs → CLAUDE.md Part 6 now lists Reanimated + gesture-handler; `MODAL_UI_STATE.md` sheet line
   still quoted the pre-rewrite `>100px / >1.2` thresholds → corrected to the current props.

8. Device report after the above: the icon vanished briefly mid crossfade. Cause →
   `ActivityIndicator animating={spinnerVisible}` only started after `runOnJS` → `setState` → render,
   and a stopped indicator hides itself, while the icon's fade had already begun on the UI thread;
   the linear, mirrored fades also bottomed out together at 50%. Fix → the indicator is always
   `animating` (visibility is the UI-thread opacity alone); icon fades over 0.4–1, spinner in over
   0–0.6. Re-verified: `npx tsc --noEmit` clean, tests 235/235. Not re-checked on device.

## Fixes Applied

As listed above; each re-verified by the typecheck, test and export runs in Method.

## Follow-ups

- Not exercised on a device — no component-test library in `mobile/`.
- Dev-client/`expo run:android` users must rebuild the native app once for the new direct dependency.
- `BottomSheetModal` still uses `PanResponder` from the handle strip; moving it to gesture-handler
  (body drag, simultaneous with inner scroll) was offered, not requested. It renders in RN `Modal`,
  which on Android needs its own `GestureHandlerRootView` inside if that move is made.
- `bounces={false}` still removes the iOS bottom-edge bounce on these lists.
