# Double-check of the pull-to-refresh rework (indicator-only, vertical, icon → spinner)

**Date:** 2026-09-24T03:59:28Z
**Method:** double-check skill
**Verdict:** PASS (static checks, unit tests, code review); gesture not exercised on a device
**Scope:** `mobile/src/components/refresh/*` and its six callers — the most recent change (content no
longer moves, vertical-only indicator, `ActivityIndicator` crossfade). Phase 1 limited to that module.
**Files touched:** none (read-only pass)
**Related reports:** [2026-09-24-sheet-gestures-refresh-and-tap-targets.md](2026-09-24-sheet-gestures-refresh-and-tap-targets.md)
(rework section; its open follow-ups carried below)

## Method

- `rtk grep -r "calculateIndicatorTranslateX|animatedContentStyle|handleScrollBeginDrag|handleScrollEndDrag|driftX|NATIVE_OVERSCROLL|spinActive|spinRotation" mobile/src`
- `grep -rlw <symbol> mobile/src` for every export of `pullMath.ts`, `usePullToRefresh.ts`,
  `PullToRefreshContainer.tsx`, `PullToRefreshIndicator.tsx`
- `grep -rn "style={({\|style={(state" mobile/src/components/refresh` (rule 15)
- `grep -rn "bounces\|overScrollMode\|onScrollBeginDrag\|onScrollEndDrag" mobile/src --include=*.tsx`
  outside `components/refresh`
- Read `usePullToRefresh.ts` end to end against the state flow
- `npm run typecheck -w @sora/mobile`; `npm run test -w @sora/mobile` (run after the last code edit)

## Findings

1. Dangling references to removed symbols → no matches. PASS.
2. Exports → every `pullMath.ts` helper is used by the hook; `PullPhase`/`*Props` types are
   barrel-exported public API of the module. No dead code. PASS.
3. Rule 15 → no function `style` in `components/refresh`. PASS.
4. Callers → none of the six screens pass `bounces`, `overScrollMode` or the removed drag handlers,
   so the new defaults apply everywhere and nothing forwarded is lost. PASS.
5. `ActivityIndicator` → already the app's spinner (`Button.tsx`, `RootNavigator.tsx`,
   `CategoryListScreen.tsx`, `GuestUploadScreen.tsx`); MB-05 covers icons, not spinners. PASS.
6. Duplication → the only other `clamp` hit (`BottomSheetModal.tsx:75`) is Animated's
   `extrapolate: 'clamp'` string, not a second helper. PASS.
7. State flow review:
   - touch during retraction → `cancelAnimation` fires the retract callback, phase ≠ REFRESHING, so
     spinner resets and the next pull shows the icon;
   - `disabled` release in TRIGGERED → springs back;
   - callers' `setIsRefreshing(true)` inside `onRefresh` → effect sees REFRESHING and does nothing;
   - completion gated on promise + `refreshing` false + settle-spring callback (always called, so no
     stuck state);
   - horizontal swipes (`dy <= |dx|`) never start a pull, so `DateStrip`/`SlideSwap` keep working.
   PASS.
8. Typecheck → exit 0. Tests → 235/235. PASS.

## Fixes Applied

None needed.

## Follow-ups

Carried from the related report, still open:

- Android (assumption): native `ScrollView` interception may `touchcancel` the pull after touch slop;
  fix would be `react-native-gesture-handler` as a direct dependency — awaiting the user's decision.
- `bounces={false}` removes the iOS bottom-edge bounce on these lists.
- No device run and no render tests (`@testing-library/react-native` absent).
