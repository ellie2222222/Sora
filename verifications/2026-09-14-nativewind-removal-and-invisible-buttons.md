# Remove NativeWind (root cause of invisible buttons), fix Button contrast and top-inset bugs

**Date:** 2026-09-14T11:05:00Z
**Method:** ad hoc, driven by user-supplied screenshots of broken buttons on real device/emulator
**Verdict:** PASS (real root cause found and fixed; two secondary, genuinely-broken issues fixed
alongside it)
**Scope:** `SettingsScreen.tsx`'s account section (reported directly) and the shared `Button`,
`WalletContextBar` components + NativeWind itself (root-caused from there)
**Files touched:** see Fixes Applied
**Related reports:** [2026-09-14-handoff-fab-and-nativewind.md](2026-09-14-handoff-fab-and-nativewind.md)
(Finding 4 there wrongly concluded "no genuine invisible-button case found" — corrected below),
[2026-09-14-expo-dependency-version-fix.md](2026-09-14-expo-dependency-version-fix.md)

## Findings

### 1. CONFIRMED, retracting an earlier finding — buttons genuinely invisible on native, fine on web

User screenshots showed the Settings screen's "logout"/"clear local data" buttons rendering with no
visible background or border on both an emulator and a real device — bare text floating in a list,
still tappable. A side-by-side screenshot showed the *same* `Button` component rendering correctly on
web (filled orange primary button, red-outlined danger-outline button) and broken on native. Earlier
today's `2026-09-14-handoff-fab-and-nativewind.md` (Finding 4) investigated `Button.tsx`'s color tokens
in isolation and concluded there was no bug — that conclusion was wrong; it never checked actual
contrast ratios or cross-platform rendering, only eyeballed hex values.

**Root cause**: `nativewind`'s Babel preset (`nativewind/babel` in `babel.config.js`, active for every
file matching `content` in `tailwind.config.js`, i.e. all of `src/`) globally wraps native `View`/
`Text`/`Pressable` through `react-native-css-interop`'s render pipeline — even in files with zero
`className=`, like `Button.tsx`. React Native's own `Pressable` API allows `style` to be a **function**
of press state (`style={(state) => [...]}`, used by `Button.tsx` and at least three other components:
`DatePickerModal.tsx`, `MonthSelector.tsx`, `OfflineBanner.tsx`). `react-native-css-interop`'s native
runtime needs `style` as a plain object/array to merge in class-derived styles and silently drops it
when it's a function — stripping every visual style while touch handling still works. Web isn't
affected because `react-native-web`'s own style path doesn't go through this native interop runtime.
This matches "invisible but still pressable" exactly, and explains why it's cross-component (any
`Pressable` using the function-style pattern), not a `Button.tsx`-specific defect.

**Fix**: removed NativeWind entirely rather than patch every affected component individually (already
justified before this — it had zero `className=` usage anywhere in the app; see
`2026-09-12-infra-audit.md`). The only past blocker was `ThemeProvider.tsx`'s `useColorScheme` import
from `nativewind`, which turned out to do nothing useful: it only synced NativeWind's own dark/light
state, and nothing in the app uses NativeWind's `dark:` variant classes. Removed that usage too.

### 2. CONFIRMED, separate and real — `secondary`/`danger-outline` contrast on a `surface` card

Independent of the NativeWind bug: `Button.tsx`'s `secondary` variant used `theme.colors.surfaceMuted`
(`#1B1B20`) as its fill and `theme.colors.border` (`#27272A`) for its border. Both are barely
distinguishable from `theme.colors.surface` (`#141417`) — the background `SettingSection` itself uses
for its card. Contrast ratio is ~1.05:1, far under the ~3:1 WCAG floor for UI components — so even once
the NativeWind bug is gone, a `secondary` button sitting on a `surface`-coloured card would still be
hard to see. Fixed to use `theme.colors.borderStrong` for the border (meaningfully lighter, real
separation) and `theme.colors.dangerMuted` (a tinted red, not just transparent) as `danger-outline`'s
fill, so it reads as a bordered box rather than a bare outline that can look invisible at some pixel
densities.

### 3. CONFIRMED — top of every main-tab screen ignores the status bar

Separately reported: "why didn't header account for the top status bar." `MainTabNavigator.tsx` sets
`headerShown: false` (a fully custom tab bar), so React Navigation's own automatic status-bar spacing
never happens. `WalletContextBar.tsx` (the de-facto header for Home/Account/Goals/Report) only had a
fixed `paddingTop: theme.spacing.sm` (8px) — no `useSafeAreaInsets().top` at all, even though the same
file's sibling `CustomTabBar` correctly does this for `insets.bottom`. `SettingsScreen.tsx` has no
`WalletContextBar` and had the same gap in its own `ScrollView`. Fixed both to add `insets.top`.

## Fixes Applied

1. [mobile/babel.config.js](../mobile/babel.config.js) — removed `nativewind/babel` preset and the
   `jsxImportSource: 'nativewind'` option.
2. [mobile/metro.config.js](../mobile/metro.config.js) — removed the `withNativeWind` wrapper.
3. [mobile/src/app/providers/ThemeProvider.tsx](../mobile/src/app/providers/ThemeProvider.tsx) —
   removed the `useColorScheme` import from `nativewind` and its now-pointless sync effect.
4. [mobile/src/App.tsx](../mobile/src/App.tsx) — removed `import '../global.css'`.
5. [mobile/tsconfig.json](../mobile/tsconfig.json) — removed `nativewind-env.d.ts` from `include`.
6. `mobile/global.css`, `mobile/tailwind.config.js`, `mobile/nativewind-env.d.ts` — deleted
   (`git rm -f`; recoverable from history if ever needed).
7. [mobile/package.json](../mobile/package.json) — removed `nativewind`, `tailwindcss`,
   `prettier-plugin-tailwindcss` dependencies. `npm install` from repo root removed 57 packages.
8. [mobile/src/components/Button.tsx:51-58](../mobile/src/components/Button.tsx#L51-L58) —
   `danger-outline` fill changed to `theme.colors.dangerMuted`; border for non-`danger-outline`
   variants changed to `theme.colors.borderStrong`.
9. [mobile/src/features/wallets/components/WalletContextBar.tsx](../mobile/src/features/wallets/components/WalletContextBar.tsx) —
   added `useSafeAreaInsets`, `paddingTop: insets.top + theme.spacing.sm`.
10. [mobile/src/features/settings/screens/SettingsScreen.tsx](../mobile/src/features/settings/screens/SettingsScreen.tsx) —
    added `useSafeAreaInsets`, `paddingTop: insets.top + theme.spacing.md` on its `ScrollView`.

Re-verified: `npm run typecheck -w @sora/mobile` clean, `npm test -w @sora/mobile` 120/120, `npm ls
--all` shows no invalid/error edges (only the same pre-existing, unrelated `ajv-errors` optional-peer
notice from eslint tooling), `grep -rl nativewind mobile/` (excluding `node_modules`) returns nothing.
Not re-verified on an actual device/emulator this pass — see Follow-ups.

## Follow-ups

- **Not yet confirmed on a real device/emulator.** Typecheck and unit tests can't see rendered pixels;
  the user should re-open the Settings screen (and any other screen using `DatePickerModal`,
  `MonthSelector`, `OfflineBanner` — the other components sharing the now-removed interop bug) to
  confirm the buttons render correctly and the status bar no longer overlaps content.
- `2026-09-14-handoff-fab-and-nativewind.md` Finding 4's "no genuine bug" conclusion should be treated
  as superseded by this report, not as still-standing guidance.
- `DESIGN_GUIDELINES.md` still documents NativeWind as installed-but-dead-config in places; worth a
  pass to update now that it's actually removed.
- Root `package.json`'s `overrides.react-native-worklets` (added earlier today) and
  `overrides.react-native-gesture-handler` (pre-existing, unexplained) are both untouched by this pass.
