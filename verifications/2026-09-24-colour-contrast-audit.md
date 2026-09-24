# Colour contrast audit — status, flow and every button/control pair, all palettes and modes

**Date:** 2026-09-24T04:36:04Z
**Method:** ad hoc
**Verdict:** PASS (computed contrast + tests); not viewed on a device
**Scope:** every semantic colour token and every foreground/background pair a control renders
(`Button` variants incl. destructive `danger-soft` "Clear data", `ConfirmDialog`, keypad, FAB, date
picker/strip, period bar, tab bar, selected-row tints, toasts), 5 palettes × 2 modes. Requested after
the toast colour review; extended to all buttons mid-task.
**Files touched:** `mobile/src/design-system/colors.ts`, `mobile/src/design-system/colors.test.ts`,
`mobile/src/components/Button.tsx`, `mobile/src/components/ConfirmDialog.tsx`, `docs/DESIGN_GUIDELINES.md`
**Related reports:** none

## Method

- Scratch script importing `getThemeColors` for every `THEME_NAMES × THEME_MODES`, WCAG relative
  luminance, text pairs at 4.5:1, borders/icons at 3:1.
- `grep` for fills: `backgroundColor: … theme.colors.(primary|danger|success|warning|income|expense|transfer|info)`
  and every `*Muted` use in `mobile/src/**/*.tsx`, then read each site's foreground colour.
- `grep` for literal `#hex`/`rgba(` in `mobile/src/**/*.tsx` outside `design-system`.
- `npx tsc --noEmit` (mobile); `npm run test -w @sora/mobile`.

## Findings

Before (failures only; dark mode passed every pair except the selected-row tint):

1. `danger-soft`/`danger-outline` label (Settings "Clear all data", guest "Clear data") — `#DC2626`
   on `#FBE3E7` = 3.97, light, all palettes. FAIL.
2. Primary button label — white on `#0D9488` (sage) 3.74, on `#EA580C` (terracotta) 3.56, light.
   Same for FAB, keypad date/confirm keys, date picker/strip/period-bar selections, primary text/tabs. FAIL.
3. Income/expense/transfer as text on white — 1.91 / 3.03 / 3.53; on their tints 1.69 / 2.57. FAIL.
4. Selected-row muted caption on `primaryMuted` — 3.66–4.46 in both modes, every palette;
   obsidian light primary-on-tint 4.24. FAIL.
5. Warning on its tint — 4.48, light. FAIL.
6. Danger button label used `onPrimary` (correct colour by coincidence, wrong token); ConfirmDialog
   `info` variant used `primary`/`primaryMuted`. Token misuse, no contrast failure.
7. Literals: `ThemeToggle` sun/moon illustration, shadows, `CollapsibleSection` overlays — decorative,
   not status or control colours. Left as-is.

## Fixes Applied

- `STATUS_COLORS` light danger → `#B91C1C`; new `FLOW_COLORS` {dark, light}: light income `#15803D`,
  expense `#B91C1C`, transfer `#BE185D` (dark unchanged).
- Light tints → 50-level (`#F0FDF4`, `#FEF2F2`, `#FDF2F8`, `#FFFBEB`, `#EFF6FF`); new `infoMuted`,
  `successMuted` in both modes; `buttonDangerDisabledBackground` light follows `dangerMuted`.
- Sage/terracotta light accent (ramp `600` slot) → teal-700 `#0F766E`, orange-700 `#C2410C`.
- Light `textMuted` `#64748B` → `#475569` (was 4.76 on white, <4.5 on any tint).
- `primaryMuted` = ramp 900/100 blended 50% toward the mode's surface (`mixHex`).
- New `onDanger` token; `Button` danger label/spinner use it; other variants' spinner follows the label colour.
- `ConfirmDialog` info → `info`/`infoMuted`.
- `RENDERED_PAIRS` in `colors.test.ts`: 40 pairs asserted in every palette and mode.
- Re-verified: scratch matrix → `all pass`; `npx tsc --noEmit` clean; tests 278/278.

## Follow-ups

- ~~Light `textFaint` `#94A3B8` is 2.56:1 on white~~ — resolved the same day: `textFaint` is real
  text in ~30 places (placeholders, empty states, captions, inactive tab labels), and dark `#71717A`
  also failed (3.51–4.12). Now dark `#84848D` (worst 4.58), light `#627085` (worst 4.59), still below
  `textMuted` (6.62 / 6.92). `RENDERED_PAIRS` gained text/textMuted/textFaint × 4 neutral surfaces and a
  hierarchy test (text > textMuted > textFaint). Verified: tsc clean, tests 291/291.
- Visual change in light mode (deeper reds/greens, lighter tints, darker sage/terracotta accent) not
  reviewed on a device.
