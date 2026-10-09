# Comment audit: readability-audit and tab bar changes

**Date:** 2026-10-09T07:55:29Z
**Method:** ad hoc (comment-audit skill, run after the double-check skill)
**Verdict:** PASS
**Scope:** comments in the files named for this pass:

- the readability call sites;
- `Text.tsx`, `sizes.ts`, `ConfirmDialog.tsx`, `TrendBarChart.tsx`, `MainTabNavigator.tsx`, `DateStrip.tsx`, `DatePickerModal.tsx`, `AppearanceSection.tsx`;
- `utils/date.ts`, `utils/date.test.ts`, `YearlyReport.tsx`;
- `design-system/readable-text.test.ts`, `colors.test.ts`.

Policy: CLAUDE.md Part 7 rule 11 (why, not what; 1–2 lines; no debug journal).
**Files touched:** `mobile/src/components/TrendBarChart.tsx`, `mobile/src/app/navigation/MainTabNavigator.tsx`
**Related reports:** `2026-10-09-readability-and-tab-bar-double-check.md`, `2026-10-09-comment-audit-dashboard-redesign.md`

## Method

- Read the diff and the full current text of each scoped file's changed regions.
- `grep "<TrendBarChart\|Five fixed columns\|Twelve fixed"` in `mobile/src` to test the count claims.
- Checked the ICU output for the Vietnamese month claims; see the double-check report, finding 5.

## Findings

1. **`TrendBarChart.tsx:49`** said "Twelve fixed columns: …". `TrendBarChart` takes any number of points, and twelve holds only for its one caller, `YearlyReport`. Pattern 7 (a count that rots). Reworded; the reason it stays xs is kept.
2. **`MainTabNavigator.tsx:124`** said "Five fixed columns: xs keeps "Einstellungen" whole…". Five is the current tab count, which nothing ties to the comment. Pattern 7. Reworded to "A fixed column per tab".
3. **`MainTabNavigator.tsx:45`** said "…the bar can cross four tabs…". Same count problem. Reworded to "several tabs".
4. **Kept, each a real why:**
   - `Text.tsx:28`: why `caption` is not `xs`.
   - `MainTabNavigator.tsx:27-28`: why the position lives only on the UI thread.
   - `colors.test.ts:208`: textFaint is real text.
   - `readable-text.test.ts:9-13`: the rule and the test's limit.
   - `date.ts:146` and `date.ts:163-166`: `monthStyle` and `monthTick`, each correct for its own case.
   - `DateStrip.tsx:18-24`: still accurate; out-of-month day numbers are still faint.
5. **Flag, not fixed (fragile cross-file references, both still resolve):**
   - `MainTabNavigator.tsx:45` contrasts with `SlideSwap`'s easing; `SlideSwap.tsx:69` still uses `Easing.out(Easing.cubic)`.
   - `Text.tsx:28` names the DESIGN_GUIDELINES "Type size and tone" section, at line 364.

   Nothing keeps either in sync.
6. **Missing comments:** none owed. The `faint` → `muted` swaps and the dropped overrides are self-evident against the guidelines rule.

## Fixes Applied

- `TrendBarChart.tsx:49` → "A fixed column per point, a year's worth across a phone: an axis tick stays xs to fit, and xs text reads only at full strength."
- `MainTabNavigator.tsx:124` → "A fixed column per tab: xs keeps "Einstellungen" whole, and xs text reads only at full strength."
- `MainTabNavigator.tsx:45` → "…the bar can cross several tabs, and leaving at full speed reads as a jump."

Comment-only: each edit replaced text inside an existing `//` or `{/* */}` comment and touched no code token.

Re-verified:
- `npm run typecheck -w @sora/mobile`: exit 0.
- `npm run test -w @sora/mobile`: 693/693 pass.

## Follow-ups

- The two fragile references in finding 5, carried forward.
