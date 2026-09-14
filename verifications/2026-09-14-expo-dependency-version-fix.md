# Fix Expo SDK 57 dependency version mismatch, surfaced after the NativeWind revert

**Date:** 2026-09-14T10:45:00Z
**Method:** ad hoc (user reported `npx expo install --check`/Metro output flagging outdated versions,
suspected it was a regression from this session's earlier NativeWind removal-then-revert)
**Verdict:** PASS (root cause identified, real invalid dependency edge fixed, distinct from a
pre-existing mismatch that predates this session)
**Scope:** repo-wide dependency graph (`package-lock.json`, `mobile/package.json`, `mobile/tsconfig.json`,
`mobile/nativewind-env.d.ts`) — not a code-logic change
**Files touched:** [mobile/package.json](../mobile/package.json), [mobile/tsconfig.json](../mobile/tsconfig.json),
[mobile/nativewind-env.d.ts](../mobile/nativewind-env.d.ts), `package-lock.json`
**Related reports:** [2026-09-14-handoff-fab-and-nativewind.md](2026-09-14-handoff-fab-and-nativewind.md)
(the NativeWind remove/revert episode that left the lockfile churned)

## Method

`git diff` against HEAD for every `package.json` in the tree to separate "what I actually changed" from
"what was already broken." `npm ls --all` (twice, before and after each fix) to surface invalid/deduped
dependency edges rather than trust version-string comparisons alone. `npx expo install --fix` to let Expo's
own SDK-57 compatibility table drive the version bump, rather than guessing numbers by hand.

## Findings

### 1. Not caused by this session — the version-pin gap itself

`git diff -- mobile/package.json` was empty before any fix here: the pins Expo flagged as outdated
(`react-native@0.86.2`, `react-native-reanimated@~3.16.7`, `react-native-worklets@0.10.4`,
`typescript@^5.7.2`) were already the committed state, untouched by anything done resolving `HANDOFF.md`.
The gap between those pins and Expo SDK 57.0.16's recommended versions predates this session.

### 2. CONFIRMED — my earlier NativeWind remove→revert→reinstall cycle left the lockfile in a genuinely
invalid state

`npm ls react-native-reanimated --all` initially crashed (`Cannot read properties of null (reading
'edgesOut')`), and after one plain `npm install`, `npm ls --all` still showed a real invalid edge:
`@react-native/metro-config@0.86.3 deduped invalid: "0.86.2" from mobile/node_modules/
@react-native/community-cli-plugin`. Root cause: `nativewind@4.2.6` → `react-native-css-interop@0.2.6`
requires `react-native-reanimated@4.5.1`, conflicting with `@sora/mobile`'s direct `~3.16.7` pin — a
real, pre-existing structural conflict (nativewind has needed reanimated v4 all along), but my repeated
install/uninstall/reinstall churn during the NativeWind experiment left it half-resolved instead of
cleanly nested, which is what produced the invalid/crashing state the user's tooling then reported.

### 3. Fix applied — bump mobile's pins to what the tree actually needs

Ran `npx expo install --fix` from `mobile/`, which bumped `mobile/package.json`:
`react-native` 0.86.2→0.86.3, `react-native-reanimated` ~3.16.7→4.5.1 (**major version bump**),
`react-native-worklets` 0.10.4→0.10.1. Its own inner `npm install` crashed (`Cannot read properties of
null (reading 'location')` — a separate npm/arborist bug triggered by running plain `npm install` inside
a workspace subfolder instead of at the monorepo root). Re-ran `npm install` from the repo root instead,
which completed cleanly. `typescript` isn't Expo-managed, so bumped `^5.7.2`→`~6.0.3` by hand to match
Expo's own recommendation and the root workspace's existing `~6.0.3` devDependency.

### 4. Two new compile errors surfaced by the TypeScript 5→6 bump, both fixed

- `tsconfig.json(14,5): error TS5101: Option 'baseUrl' is deprecated` — TS 6 hard-errors on it under
  `moduleResolution: "Bundler"`. Removed `"baseUrl": "."` and changed `"@/*": ["src/*"]` to
  `"@/*": ["./src/*"]` (a leading `./` is required once `baseUrl` is absent) — same resolution, no
  behavior change.
- `App.tsx(1,8): error TS2882: Cannot find module or type declarations for side-effect import of
  '../global.css'` — `nativewind-env.d.ts` only ever referenced `nativewind/types` (prop-type
  augmentation for `className`), which never declared an ambient `*.css` module; TS 6 is stricter about
  side-effect imports with no matching declaration than TS 5.7 was. Added `declare module '*.css';`.

## Fixes Applied

1. [mobile/package.json](../mobile/package.json) — dependency version bumps (react-native, reanimated,
   worklets via `expo install --fix`; typescript by hand).
2. [mobile/tsconfig.json](../mobile/tsconfig.json:14) — removed deprecated `baseUrl`, made the `@/*` path
   mapping explicitly relative.
3. [mobile/nativewind-env.d.ts](../mobile/nativewind-env.d.ts) — added `declare module '*.css';`.
4. `package-lock.json` — regenerated via root `npm install`, resolving the invalid dependency edge.
5. [package.json](../package.json:34-37) — added `"react-native-worklets": "0.10.1"` to the root
   `overrides` block. A plain `npm install`/reinstall did not retroactively re-resolve the existing
   lockfile against it (npm doesn't always recompute overrides against an already-satisfied tree); a
   full clean reinstall (`node_modules` + `package-lock.json` deleted at root and in every workspace,
   then `npm install` from the root) was required for it to take effect. Confirmed with
   `node -e '...lock.packages'`: previously `node_modules/react-native-worklets@0.10.4` (hoisted, pulled
   in by `react-native-reanimated`'s own broad `0.10.x` range) coexisted with a separate
   `mobile/node_modules/react-native-worklets@0.10.1` (mobile's own exact pin) — Metro/Babel resolve
   `react-native-worklets/plugin` from `mobile/`'s own node_modules first, so the app used `0.10.1`
   while `reanimated`'s internal `require` used the other copy at `0.10.4`. After the clean reinstall,
   only one copy remains anywhere in the tree: `node_modules/react-native-worklets@0.10.1`.

Re-verified: `npm ls --all` shows no invalid/error edges (only an unrelated, pre-existing
`UNMET OPTIONAL DEPENDENCY ajv-errors` from eslint tooling). `npm run typecheck -w @sora/mobile` clean,
`npm run typecheck -w @sora/server` clean, `npm run build -w @sora/contracts` clean, `npm test -w
@sora/mobile` 120/120, `npm test -w @sora/contracts` 63/63, `node scripts/check-contract-parity.mjs`
31/31.

## Follow-ups

- **`react-native-reanimated` 3→4 is a major version bump.** Typecheck and the existing test suite pass,
  but neither exercises animation behavior at runtime — this needs an actual on-device/simulator smoke
  test of every animated surface (`AnimatedScreen`, the FAB, any `useAnimatedStyle`/`withTiming` usage)
  before this is trusted in production, not just typechecked.
- `root package.json`'s new `"overrides": { "react-native-gesture-handler": "~2.32.0" }` (uncommitted, not
  added by this pass — already present before this fix started) is unexplained and untouched here; worth
  confirming with whoever added it that it's still needed.
- `package-lock.json`'s working-tree diff is large (dependency resolution, not hand-edited) — normal for
  a lockfile regeneration, but means `commit-messages` should bundle it with the `mobile/package.json` +
  `tsconfig.json` + `nativewind-env.d.ts` group as one dependency-upgrade commit, not split apart.
