# Text contrast and tab selection states across every palette

**Date:** 2026-10-16T10:41:34Z
**Method:** ad hoc
**Verdict:** PASS (token math and tests); on-device look not checked
**Scope:** `textMuted`/`textFaint` against every rendered background; `SegmentedControl` (transaction type filter, Dashboard, Planning); bottom tab bar
**Files touched:** `mobile/src/design-system/colors.ts`, `mobile/src/design-system/colors.test.ts`, `mobile/src/components/SegmentedControl.tsx`, `mobile/src/app/navigation/MainTabNavigator.tsx`, `docs/DESIGN_GUIDELINES.md`
**Related reports:** none

## Method

- Ran `contrastRatio` (`design-system/contrast.ts`) on every token in `THEME_NAMES` × `THEME_MODES` against background, surface, surfaceElevated, surfaceMuted, surfaceInset, primaryMuted, the semantic tints and each `ACCOUNT_TINTS` surface.
- Read `SegmentedControl.tsx`, `MainTabNavigator.tsx` and `TransactionItem.tsx` for which token each state renders.
- `npm run test -w @sora/mobile`, `npm run typecheck -w @sora/mobile`.

## Findings

- Dark `textFaint` #84848D: 4.09–4.43:1 on the teal, purple, forest and charcoal tints, and 3.74:1 on sage `primaryMuted`. **FAIL** AA. The tint test only covered `text`/`textMuted`.
- Light `textFaint` #627085: 4.23–4.40:1 on every light tint. **FAIL** AA.
- Dark `textMuted` #A1A1AA: lowest 5.41:1 (sage `primaryMuted`), 7.17:1 on `surface`. Passes AA, but the lowest of any palette was on selected rows.
- `SegmentedControl` selected segment: `surface` on a `surfaceMuted` track, 1.07:1 (dark) / 1.10:1 (light). The `shadows.xs` lift doesn't show on dark. Selection read only through bold vs muted text. **FAIL** 1.4.11.
- Bottom tab bar: inactive icon `textMuted`, inactive label `text`, so the two parts of one tab disagree. Active `primary` in dark (ramp 300) is close in brightness to `text`, so the state was carried mostly by hue plus a 3px bar.
- Transaction rows: metadata `caption` + `muted`; amounts use `<Money>` flow colours (already covered by `RENDERED_PAIRS` at 4.5:1). Unchanged.

## Fixes Applied

- `colors.ts`:
  - Dark `textMuted` #A1A1AA→#B0B0B8 (lowest 6.44:1, 8.53:1 on surface).
  - Dark `textFaint` #84848D→#93939C (lowest 4.56:1).
  - Light `textFaint` #627085→#5C6A7F (lowest 4.62:1).
  - Disabled-button text tokens are unchanged, so disabled now reads dimmer than muted.
- `colors.test.ts`: tint test now includes `textFaint`. New pairs:
  - faint on `primaryMuted`
  - unselected segment label on its track
  - selected segment border on its track (3:1)
  - inactive tab `text` on `surface`
  - active tab icon on its pill (3:1)
- `SegmentedControl.tsx`: selected = `primaryMuted` fill + thin `primary` border + bold `primary` label. The border width is kept on every segment (transparent when unselected), so selecting never shifts the row. The selected-only shadow was removed. The control is 2px taller than before.
- `MainTabNavigator.tsx`: inactive icon and label are both `text`. The active icon sits on a `primaryMuted` pill whose padding is cancelled by negative margins, so the layout is unchanged.
- Worst-case ratios after the change (all palettes):

  | Pair | Dark | Light |
  |---|---|---|
  | selected border on track | 8.60:1 | 4.72:1 |
  | active icon on pill | 7.56:1 | 4.70:1 |

- Re-ran `npm run test -w @sora/mobile`: 754 pass, 0 fail. `npm run typecheck -w @sora/mobile`: 0 errors.

## Follow-ups

- The `primaryMuted` selected fill is only 1.14:1 (dark) / 1.00:1 (light) against the track: it differs in hue, not lightness. The border and label carry the 3:1 state, so the fill is decoration.
- Not checked on a device: the pill's fit under the 56px tab bar, the look at low brightness, and the 2px-taller segmented control.
