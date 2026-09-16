# NativeWind adoption: infra setup + full static-layout migration

**Date:** 2026-09-15T00:00:00Z
**Method:** ad hoc (user request), 7 parallel general-purpose agents for the per-file conversion
**Verdict:** PASS
**Scope:** Wire NativeWind (already a partial dependency) into a working state, then convert every
file's static, theme-independent inline `style={{...}}` layout on raw React Native elements to
Tailwind `className`. Dynamic values (colour, shadows, animated/reanimated styles, anything
prop/state-driven) deliberately left as inline `style`, per explicit scoping decisions below.
**Files touched:** 73 files with inline styles (see batch lists below) + 6 infra files
(`mobile/tailwind.config.js`, `mobile/global.css` (new), `mobile/nativewind-env.d.ts` (new),
`mobile/tsconfig.json`, `mobile/src/App.tsx`).
**Related reports:** none

## Scoping decisions (asked, not assumed)

NativeWind is a real architectural fork — it replaces how the whole app expresses layout. Two
things were confirmed with the user before touching 73 files:
1. **Wire tailwind.config.js to the existing design-system tokens** (not a parallel, divergent
   palette) — chosen over "install only" or "install + migrate everything" as the initial scope,
   later expanded to "replace all" on explicit request.
2. **Dynamic values (runtime theme colour, react-native-reanimated styles, per-item tints) stay as
   inline `style`**, never forced into `className` — chosen over pushing them through NativeWind's
   CSS-variable mechanism, which would have meant redesigning `ThemeProvider`'s runtime palette
   switching (5 named themes × 2 modes) as CSS custom properties, a much larger and unapproved
   change.

These two decisions resolve each other: colour is the one part of the design-system that is
genuinely dynamic (user-selectable at runtime), so "leave dynamic inline" cleanly excludes colour
from `tailwind.config.js` entirely — only `spacing`, `borderRadius`, and `fontSize` (identical
across every theme/mode) were added to `theme.extend`.

## Method

1. Read `mobile/package.json` — `nativewind`, `tailwindcss`, `prettier-plugin-tailwindcss` were
   already dependencies, and `babel.config.js`/`metro.config.js` were already correctly wired
   (`jsxImportSource: 'nativewind'`, `withNativeWind`). Only `tailwind.config.js` (still the
   tutorial stub, wrong `content` globs, empty `theme.extend`), `global.css`, and
   `nativewind-env.d.ts` were missing or unfinished.
2. Read `mobile/src/design-system/{spacing,radius,typography}.ts` and wrote
   `tailwind.config.js`'s `theme.extend` to match exactly (spacing/radius in px strings, font
   sizes in px strings) — colour excluded per the scoping decision above.
3. Added `global.css` (`@tailwind base/components/utilities`), `nativewind-env.d.ts`
   (`nativewind/types` + `expo/types` — the latter needed because this repo has no generated
   `expo-env.d.ts` to supply the `declare module '*.css'` TypeScript needs), added `*.d.ts` to
   `tsconfig.json`'s `include`, and imported `global.css` from `src/App.tsx`.
4. Ran `npm run typecheck -w @sora/mobile` — confirmed clean before starting the per-file sweep.
5. Counted files with inline styles: `grep -rlE "style=\{" src --include="*.tsx"` → 73.
6. Split into 7 batches by directory, dispatched as parallel background agents, each given an
   identical strict rule set (below) plus its own file list. Every agent was told to leave a file
   untouched rather than force a conversion, and to report what it deliberately skipped and why.
7. After all 7 completed: `npm run typecheck -w @sora/mobile` (clean) and `npm test -w
   @sora/mobile` (139/139 passing), plus manual greps for empty `style={{}}` leftovers and
   duplicate `className` attributes on one element (both clean).

## The conversion rules given to every agent

- Convert only static layout props (`flexDirection`, `alignItems`, `justifyContent`, `gap`,
  `padding`/`margin`, `borderRadius`, `overflow: 'hidden'`, `position`, fixed pixel
  width/height) on **raw React Native elements** (`View`, `Pressable`, `ScrollView`, etc.)
  imported directly from `'react-native'`.
- **Never** add a `className` to a custom app component (`Card`, `Button`, `Text`, `Money`,
  `StateView`, `CategoryAvatar`, etc.) — none of them call NativeWind's `cssInterop()`, so a
  `className` passed to one would silently do nothing. This is the main way this kind of
  migration goes wrong invisibly, so it was called out explicitly and repeatedly.
- Never convert anything reading `theme.colors.*`/`theme.shadows.*`/any `useTheme()` value,
  anything inside a `Pressable`'s `pressed`-dependent style callback, anything reanimated/
  `Animated.View`-driven, or any prop/state-conditional style — these stay inline.
- Use only the named spacing/radius scale (`p-md`, `rounded-sm`) — never bare numeric Tailwind
  classes (`p-4`), which aren't guaranteed to match this app's exact pixel values.
- Split mixed objects: static entries move to `className`, dynamic entries stay in a smaller
  `style`/callback — both can coexist on one element.
- `mobile/src/components/Text.tsx` (the single shared text component, coupling `fontFamily` to
  weight for Android rendering — see its own comment) was explicitly flagged as untouchable; the
  assigned agent confirmed by reading it that every one of its style entries is theme/prop-derived
  and made no changes.

## Findings

- All 7 batches (73 files) completed; each self-reported a read-through confirming balanced JSX
  and preserved `testID`s.
- `npm run typecheck -w @sora/mobile`: clean, both before and after the full sweep.
- `npm test -w @sora/mobile`: 139/139 passing, unchanged from before the migration (these are
  pure-logic tests with no style assertions, so this confirms no logic regressions, not visual
  correctness).
- Manual greps post-sweep: zero empty `style={{}}` objects, zero elements with a duplicated
  `className` attribute.
- One agent (batch 2) flagged that it couldn't confirm NativeWind's `contentContainerClassName`
  remap was safe in its sandbox and left `ScrollView.contentContainerStyle` calls untouched
  everywhere rather than risk it — consistent with every other batch, which also left
  `contentContainerStyle` inline (see Follow-ups).

## Fixes Applied

N/A — this pass *was* the change; there was nothing to fix afterward. No typecheck or test
failures surfaced at any point.

## Follow-ups

- **Not visually verified.** No Expo runtime/simulator available in this pass. Typecheck + the
  existing (style-blind) unit test suite are the only automated verification; a real on-device or
  simulator pass across the app's screens (light and dark, at least two of the five palettes) is
  the right next step before trusting this visually.
- **`contentContainerStyle` on every `ScrollView`/`RefreshableScrollView`/`FlatList` was left
  entirely as inline style, everywhere** — several agents independently judged it out of scope
  (mixes insets-dependent and static values in one shorthand that can't be split cleanly, and/or
  uncertainty about `contentContainerClassName` support). This is a legitimate, sizeable remaining
  pocket of un-migrated static styling if a "no inline style left at all" bar is the goal.
- **`theme.spacing.*`/`theme.radius.*` read symbolically (not as literal numbers) were left
  inline everywhere**, even where numerically identical to the Tailwind scale — every agent
  correctly followed the "any `theme.*` value stays inline" rule literally. If the goal is
  eventually zero inline spacing/radius, that would need a second, different pass (replacing
  `theme.spacing.md` reads with the `md` className token directly), not a mechanical continuation
  of this one.
- `categoryIconFor()` (added earlier this session, unrelated to this migration) still only maps
  the 6 starter-category icons — noted here again since it's still open.
