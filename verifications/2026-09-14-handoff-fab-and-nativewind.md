# Double-check: HANDOFF.md's FAB/add-action bugs fixed, NativeWind removal attempted then reverted on a live conflict

**Date:** 2026-09-14T10:26:48Z
**Method:** double-check skill, scoped to `HANDOFF.md`'s described bugs (named by the user)
**Verdict:** PASS (real bugs fixed and re-verified; the NativeWind decision was acted on, then correctly
reverted mid-fix on discovering it conflicted with concurrent work — see Finding 5)
**Scope:** `mobile/src/features/transactions/components/TransactionListScreen.tsx`,
`mobile/src/features/dashboard/screens/HomeScreen.tsx`,
`mobile/src/features/goals/screens/GoalsScreen.tsx`,
`mobile/src/features/budgets/screens/BudgetsScreen.tsx`, and the NativeWind config/dependency question
`HANDOFF.md` raised. `HANDOFF.md` itself was verified against the live repo rather than trusted —
one of its own diagnoses (Finding 2) turned out backwards.
**Files touched:** [mobile/src/features/transactions/components/TransactionListScreen.tsx](../mobile/src/features/transactions/components/TransactionListScreen.tsx),
[mobile/src/features/dashboard/screens/HomeScreen.tsx](../mobile/src/features/dashboard/screens/HomeScreen.tsx),
[mobile/src/features/goals/screens/GoalsScreen.tsx](../mobile/src/features/goals/screens/GoalsScreen.tsx),
[mobile/src/features/budgets/screens/BudgetsScreen.tsx](../mobile/src/features/budgets/screens/BudgetsScreen.tsx)
**Related reports:** [2026-09-12-infra-audit.md](2026-09-12-infra-audit.md) (first flagged NativeWind as
dead config), [2026-09-13-double-check-commit-plan-2.md](2026-09-13-double-check-commit-plan-2.md)

## Method

Read `HANDOFF.md` in full, then verified each of its four claims against the live files (not taken on
faith) before fixing anything, per this skill's own instruction to re-check a background report's
findings against the live repo. Traced the actual React Navigation tab-bar layout (`CustomTabBar`'s
`position: 'relative'`) and the pre-refactor commit (`f91fb0f`) that originally justified
`TAB_BAR_HEIGHT` in the FAB math, rather than accepting `HANDOFF.md`'s own stated assumption about it.

## Findings

### 1. CONFIRMED — `TransactionListScreen.tsx` imported `Fab` but never rendered it

`Fab`, `fabBottomOffset`, and `onAddTransaction` were all accepted and threaded through, but no
`<Fab>` element existed anywhere in the JSX. Whenever a wallet has transactions, there was no way to
add one from the Home tab or the Transactions stack screen (the empty state's own CTA was the only
path in). **Fixed**: render `<Fab bottomOffset={fabBottomOffset} onPress={onAddTransaction} />` as a
sibling inside the screen, gated on `!isLoading && !isError && items.length > 0` (the empty state
already has its own CTA, so the FAB only appears once there's a list to float over). Also widened the
list's `contentContainerStyle` bottom padding to `fabBottomOffset + 96` so the FAB doesn't sit on top
of the last row.

### 2. HANDOFF.md's own diagnosis for the offset math was backwards — traced to the actual regression cause

`HANDOFF.md` states `fabBottomOffset={TAB_BAR_HEIGHT + insets.bottom}` in `HomeScreen.tsx` is correct
"so the FAB floats above the bottom navigation bar," and that the earlier bug was something else. This
does not hold up: `MainTabNavigator.tsx`'s `CustomTabBar` container is `position: 'relative'` (a normal
flow sibling, not an absolute/floating overlay), and `TAB_BAR_HEIGHT` has exactly one other use in the
whole tree — sizing that same tab bar's own height. Nothing pads any screen's scroll content to
compensate for an overlapping tab bar, which would be expected if the tab bar really floated over
content. Checked the pre-refactor commit `f91fb0f` directly: the *original* FAB was a sibling of the
entire `Tab.Navigator` (rendered by `MainTabNavigator` itself, not by an individual screen) — at that
scope it genuinely needed `TAB_BAR_HEIGHT + insets.bottom` to clear the tab bar, because it overlapped
the whole screen including the tab bar. The refactor (`cb7394b`) moved the FAB down into each screen's
own component tree — which is *already* bounded above the tab bar — but carried the old offset math
over unchanged, double-counting the tab bar's height and pushing the FAB up into the list. This is the
exact "pushed far up" regression `HANDOFF.md` itself describes from a prior attempt, just misattributed
to something else. **Fixed**: `HomeScreen.tsx` now passes `fabBottomOffset={0}`, with a comment
recording why. `TransactionsScreen.tsx` (no tab bar, needs its own safe-area clearance) was already
correct at `insets.bottom` and was left unchanged.

### 3. CONFIRMED — `GoalsScreen.tsx`/`BudgetsScreen.tsx` had no way to add once the list wasn't empty

Both screens' only `openModal('AddGoal'/'AddBudget')` call lived inside the empty-state's
`primaryAction` — once `items.length > 0`, neither screen exposed any create entry point.
`AccountsScreen.tsx:99-106` already has the right pattern (an always-visible header row with a `Plus`
icon, gated on `permissions.canWrite`). **Fixed**: added a `ListHeaderComponent` to each `FlatList`
with the same icon-button pattern, so the whole list (not just the empty state) has an add
entry point once there's a wallet write permission.

### 4. Investigated, not a real bug — Button.tsx contrast

Checked all five variants (`primary`/`secondary`/`danger`/`danger-outline`/`ghost`) against both dark
(Obsidian) and light-mode token values in `colors.ts`. `secondary`/`ghost` fills are deliberately subtle
in Obsidian dark mode (`surfaceMuted #1B1B20` close to `background #09090B`) — consistent with this
session's own `DESIGN_GUIDELINES.md` ("gray carries most of the UI, ~90% neutral"), and label text
always renders in `theme.colors.text`/`danger`, which contrasts strongly against either background
regardless. No genuine invisible-button case found; not changed, to avoid touching working color
tokens on a hunch.

### 5. NativeWind decision — acted on, then reverted after finding a live conflict

`HANDOFF.md` Step 4 asks to resolve NativeWind's dead-config status, recommending Option A (remove it —
zero `className=` usage anywhere, confirmed again before acting). Removed the deps
(`nativewind`/`tailwindcss`/`prettier-plugin-tailwindcss`), the babel/metro/tsconfig wiring, and the
three config files, then ran `npm install` and `npm run typecheck -w @sora/mobile`.

**That typecheck (after the removal) failed for a real reason**: `mobile/src/app/providers/
ThemeProvider.tsx:12` imports `useColorScheme` from `nativewind` — a genuine runtime dependency added
to the tree concurrently with this pass, not dead config. Removing NativeWind would have broken that.
**Reverted immediately**: `git checkout --` on every file the removal touched (all still uncommitted, so
nothing was lost), reinstalled, and re-confirmed a clean typecheck. NativeWind and its config are back
exactly as committed in `56688e0`. The underlying decision (Option A vs B) is still open — it just isn't
this pass's call to make unilaterally anymore, since real code now depends on the package. Recorded as
a follow-up rather than re-attempted here.

## Fixes Applied

1. [TransactionListScreen.tsx](../mobile/src/features/transactions/components/TransactionListScreen.tsx) —
   render `<Fab>`, gate it on non-empty/non-loading/non-error, widen scroll padding.
2. [HomeScreen.tsx](../mobile/src/features/dashboard/screens/HomeScreen.tsx) — `fabBottomOffset={0}`
   instead of `TAB_BAR_HEIGHT + insets.bottom` (removed the now-unused `useSafeAreaInsets`/
   `TAB_BAR_HEIGHT` imports too).
3. [GoalsScreen.tsx](../mobile/src/features/goals/screens/GoalsScreen.tsx) — header add-icon via
   `ListHeaderComponent`, gated on `permissions.canWrite`.
4. [BudgetsScreen.tsx](../mobile/src/features/budgets/screens/BudgetsScreen.tsx) — same pattern.

Re-verified after all four: `npm run typecheck -w @sora/mobile` clean, `npm run typecheck -w
@sora/server` clean, `npm run build -w @sora/contracts` clean, `npm test -w @sora/contracts` 63/63,
`node scripts/check-contract-parity.mjs` 31/31, `npm test -w @sora/server` 11/11 (up from 3 — picks up
tests from concurrently-landed work, unrelated to this pass).

One transient environment issue during verification: `tsc --noEmit` on `@sora/mobile` hit a native V8
out-of-memory crash twice in a row (8 concurrent `node.exe` processes observed, ~5-6GB free of 32GB
system RAM) — not caused by any change here (`@sora/contracts`' own build succeeded throughout, and a
short wait before retrying let it complete cleanly). Noted in case it recurs for a later pass.

## Follow-ups

- **NativeWind Option A vs B is still an open decision**, now with an added wrinkle: something already
  depends on `nativewind`'s `useColorScheme` in `ThemeProvider.tsx` even though nothing yet uses
  `className=`. Whoever resolves this needs to look at what that `useColorScheme` integration is for
  before choosing — removing NativeWind now requires migrating that usage too, not just deleting config.
- Button contrast (Finding 4) — no action needed, but flagging that `HANDOFF.md`'s "invisible buttons"
  framing conflated two things: the real bug was the *missing* FAB/add-actions (Findings 1/3), not the
  existing buttons' color contrast.
- HANDOFF.md's own Definition-of-Done checklist item "NativeWind decision clarified" is not checked off
  by this pass — see above.
