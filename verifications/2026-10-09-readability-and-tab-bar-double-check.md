# Double-check: readability audit, chart month ticks, tab bar motion

**Date:** 2026-10-09T07:55:29Z
**Method:** double-check skill
**Verdict:** PASS
**Scope:** everything changed after `2026-10-09-dashboard-tabs-double-check.md`:

- the readability-audit call sites and the `caption` → `sm` default;
- `readable-text.test.ts`;
- `monthTick` and `YearlyReport`;
- the tab bar's motion: `MainTabNavigator.tsx` and the DESIGN_GUIDELINES Motion section.

**Files touched:** `mobile/src/components/TrendBarChart.tsx`, `mobile/src/app/navigation/MainTabNavigator.tsx` (comments only, see the comment-audit report)
**Related reports:** `2026-10-09-readability-audit.md`, `2026-10-09-dashboard-tabs-double-check.md`, `2026-10-09-comment-audit-readability-and-tab-bar.md`

## Method

- `git diff -U2` over the readability call-site files, `utils/date.ts`, `utils/date.test.ts`, `YearlyReport.tsx` and `MainTabNavigator.tsx`, read line by line.
- `node scratchpad/vi-month.mjs`: prints `toLocaleDateString('vi', { month })` for `short`/`long`/`numeric`.
- `grep` for `<TrendBarChart`, `TabIconBounce`, `stretch`, "icon dips", "indicator stretches" in `mobile/src`, `docs`, `AGENTS.md`, `.agents/rules`, `SDS.md`.
- `npm run typecheck -w @sora/mobile`, `npm run test -w @sora/mobile`, `npm run agents:check`.
- Emulator burst: `input tap` on the Settings tab while running six `screencap -p` back to back on the device. The tab bars were cropped into one strip with System.Drawing.

## Findings

1. **Call-site tone/size swaps** (19 files): each is a `faint` → `muted` swap, a dropped `fontSize.xs` override, or the Back badge moving to `variant="label"`. None changes copy, layout or data. PASS.
2. **`DateStrip`:** removing `mutedColor` left `inCurrentMonth` in use. It still makes another month's day number `textFaint`, at body size (15), which the faint ≥ `md` floor allows. Out-of-month days stay distinct. PASS.
3. **`UploadStepsCard`:** queued and done counts now share `muted`. The row's own step state still distinguishes them; the count's tone was the only change. PASS.
4. **`readable-text.test.ts`:** `textVariants()` parses `VARIANT_SIZE` past the new comment line in `Text.tsx`. The comment has no `word: 'word'` shape, and the first test asserts the parsed map is complete. PASS.
5. **`monthTick`:** exported through `utils/index.ts` (`export * from './date.ts'`); its one caller is `YearlyReport`.
   - ICU gives `short "Tháng 10"`, `long "Tháng 10"`, `numeric "10"`, so the docblock's "short form is still tháng 10" holds.
   - The `monthStyle` comment ("thg 10") is about the abbreviation inside a full date, a different case.

   PASS.
6. **Tab bar:**
   - `TabIconBounce`, `stretch`, `withSequence` and `withSpring` are gone, and no imports or references are left behind.
   - The DESIGN_GUIDELINES Motion section was updated in the same change. `AGENTS.md`, `.agents/rules` and `SDS.md` never described the bounce.
   - The burst caught one frame mid-slide under Planning, at the same indicator width as the settled frames; the icons are level in all six. PASS.
7. **Docs:** `Text.tsx` cites DESIGN_GUIDELINES "Type size and tone"; the heading exists at `docs/DESIGN_GUIDELINES.md:364`. PASS.
8. **Checks:**
   - typecheck: exit 0;
   - tests: 693/693 pass;
   - `agents:check`: "agent skills in sync: 11 skills in .agents/skills".

   PASS.
9. **Rules learned from past bugs** (CLAUDE.md Part 7):
   - no function `style` on a `Pressable` was added (rule 15);
   - no cross-directory deep import was added (MB-10);
   - every new colour and size is a `useTheme()` token (MB-06).

   PASS.

## Fixes Applied

Comment wording only, in `TrendBarChart.tsx:49` and `MainTabNavigator.tsx:45,124`. Detail in `2026-10-09-comment-audit-readability-and-tab-bar.md`. Re-verified by the typecheck and test runs above.

## Follow-ups

- **Date picker Back badge:** checked after this report on the emulator (Home → Pick a date → year view, dark theme, English). "Back" renders at `label` size in bold `onPrimary` on the primary badge, whole and readable.
- Native-speaker check of the chart ticks ("февр", "févr", numeric Vietnamese), carried from `2026-10-09-readability-audit.md`.
- Nothing committed.
