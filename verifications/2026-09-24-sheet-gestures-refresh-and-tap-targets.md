# Bottom-sheet dismissal, pull-to-refresh state machine, and partially-tappable controls audit

**Date:** 2026-09-24T03:42:10Z
**Method:** ad hoc
**Verdict:** PASS (static checks and unit tests); gestures not exercised on a device
**Scope:** `BottomSheetModal` drag/dismiss/fade; `components/refresh/*` pull-to-refresh; app-wide
audit for controls where only part of the visible control is tappable (started from the Budget
date field).
**Files touched:** `mobile/src/components/BottomSheetModal.tsx`, `mobile/src/components/refresh/*`
(`pullMath.ts`, `usePullToRefresh.ts`, `PullToRefreshContainer.tsx` (new), `Refreshable*.tsx`,
`index.ts`, `pullMath.test.ts` (new)), `mobile/src/components/DateField.tsx`,
`mobile/src/features/settings/components/AppearanceSection.tsx`,
`mobile/src/features/planning/screens/PlanningScreen.tsx`,
`mobile/src/features/wallets/screens/WalletDetailScreen.tsx`,
`mobile/src/features/wallets/screens/WalletMembersScreen.tsx`
**Related reports:** [2026-09-24-transfer-categories-double-check.md](2026-09-24-transfer-categories-double-check.md)

## Method

- Read `BottomSheetModal.tsx`, `components/refresh/*`, `DateField.tsx`; audit of every
  Pressable-bearing file under `mobile/src` by a read-only agent, each reported finding re-read
  before changing it.
- `npm run typecheck`; `npm run test -w @sora/mobile`; `grep -rn "style={({" mobile/src` (rule 15).

## Findings

1. Sheet fade → the sheet was a child of the backdrop `Animated.View` whose `opacity` the drag
   lowered, so the sheet itself faded while sliding. FAIL → fixed.
2. Sheet release → hardcoded `dy > 90 || vy > 0.4`; `PanResponder` built once, closing over the
   first render's `dismissModal`/`onClose`. FAIL → fixed.
3. Pull-to-refresh on iOS → touch handlers and native-overscroll handlers both ran; both called
   `triggerRefresh` on release. FAIL → fixed.
4. Pull-to-refresh range → indicator translate/rotation clamped at the threshold, so the pull felt
   capped; content never moved on touch platforms. FAIL → fixed.
5. Pull-to-refresh completion → spinner started only when the caller's `refreshing` flipped; a
   refresh that never flipped it left the indicator parked. Spinner rotation reset to 0 while still
   visible on finish. FAIL → fixed.
6. `DateField` (Budget, Goal, Contribution, Edit Transaction) → only an inner `Pressable` around the
   date text was tappable (content-height in an `items-center` row); container, padding and
   calendar icon were not. FAIL → fixed.
7. Settings dark-mode row → one visual row (icon, title, description, toggle) where only the 58×30
   `ThemeToggle` responded; the palette rows beneath are fully tappable. FAIL → fixed.
8. Icon-only buttons with ~18–22px targets and no `hitSlop`: Planning add-budget/add-goal, Wallet
   detail history/settings/add-account, member ⋮ and invitation revoke ×. FAIL → fixed.
9. Checked, no change needed: `AccountPicker` (full + compact), `CategoryPicker`, `CategoryGrid`,
   `MonthSelector`, `PeriodBar`, `DateStrip`, `DatePickerModal`, `CalculatorKeypad`, `Input`,
   `MoneyInput`, `WalletSwitcher`, `CollapsibleSection`, `LanguageSection`, palette rows, tab bar,
   `TransactionRow`, contribution checkbox row, wallet/account/budget/goal cards, `StateView` and
   `ActionSheet` actions. No search, currency, time or standalone month/year pickers exist; the
   currency field is a plain `Input`. No function `style` on any `Pressable`.
10. Add Transaction's transfer footer (Banknote circle + currency) resembles the compact account
    pill but is display-only, not a partially wired action — left as-is.

## Fixes Applied

- #1–2 → backdrop is a separate `pointerEvents="none"` layer whose opacity is interpolated from the
  sheet's `translateY` over its measured height, so it reaches 0 exactly at the dismissed position
  and the sheet never fades. Release decided by `dismissThreshold` (fraction of sheet height,
  default 0.3) or `dismissVelocity` (px/ms, default 0.5), both props; a committed release springs
  out carrying the gesture velocity (`overshootClamping`), otherwise springs back with it. A phase
  ref ignores gestures while dismissing; handlers read through a ref. Typecheck clean.
- #3–5 → `usePullToRefresh` rebuilt as IDLE → PULLING → REFRESHING: iOS reads the negative scroll
  offset only while the finger is down; other platforms move the content layer by touch. Pull uses
  a rubber band toward `maxPullDistance` (prop, default 2.5× threshold); indicator keeps moving and
  rotating past the threshold. Release ≥ threshold enters REFRESHING immediately (spinner continues
  from the pull's rotation, content springs to 0 with release velocity); completion waits for both
  the `onRefresh` promise and `refreshing === false`; the spinner stops only once the indicator has
  retracted. Touching during a spring-back resumes from the current position (`rawPullFor`).
  Shared `PullToRefreshContainer` replaces three copies of the touch/indicator wiring.
  `pullMath.test.ts`: 6 tests. Mobile 235/235.
- #6 → the bordered 48px container is the `Pressable` (with `accessibilityLabel` = label + date);
  the clear × stays a separate nested action.
- #7 → row is a `Pressable` toggling the mode, `accessibilityRole="switch"`, state-driven pressed
  background matching the palette rows; the nested toggle still handles its own taps.
- #8 → `hitSlop={12}` on each.

## Rework: pull-to-refresh moves only the indicator (2026-09-24T03:56:10Z)

Reported on device: (a) the content was dragged down with the indicator; (b) the icon never became a
spinner after release.

- (a) cause → `PullToRefreshContainer` translated the list layer by `contentOffset` on touch
  platforms, and iOS read the pull from native overscroll, i.e. the ScrollView bouncing its own
  content. Fix → content layer and `contentOffset`/`animatedContentStyle` removed; the pull is read
  from touches on every platform; the three `Refreshable*` lists default to `bounces={false}` and
  `overScrollMode="never"` (caller props still override), so nothing moves the content.
- (b) cause → the "spinner" was the same `RotateCw` icon continuing to rotate — indistinguishable
  from the pull — and a fast refresh retracted it almost immediately. Fix → release in `TRIGGERED`
  enters `REFRESHING` synchronously: `spinnerProgress` crossfades the icon out and an
  `ActivityIndicator` in (180ms) while the indicator springs to its loading position;
  completion needs the refresh done, `refreshing` false, and that spring settled (callback, no timer).
  Retraction resets the spinner even when a touch cuts it short, unless a refresh restarted.
- States now `IDLE / PULLING / TRIGGERED / REFRESHING`. The indicator moves vertically only — a
  sideways drift added in the first cut was removed on review; `dx` only gates pull vs. swipe.
- Verified: `npm run typecheck -w @sora/mobile` → exit 0; `npm run test -w @sora/mobile` → 235/235.
  Not exercised on a device.

## Follow-ups

- Android (assumption, unverified on device): a native `ScrollView` intercepts a vertical drag past
  touch slop even at the top, and RN then sends JS a `touchcancel`, which would end the pull after a
  few px. If a device shows that, the robust fix is `react-native-gesture-handler` (present only
  transitively today) as a direct dependency — a new dependency, so not added without asking.
- `bounces={false}` also removes the iOS bottom-edge bounce on these lists.
- None of the gesture/tap changes were exercised on a device — no component-test library
  (`@testing-library/react-native`) exists in `mobile/`, so they have no render tests.
- `DateField`'s clear button `accessibilityLabel="Clear date"` is a hardcoded English string —
  pre-existing, not an i18n key.
- Sheet drag still starts only from the handle strip, as before; dragging the sheet body was not in
  scope.
