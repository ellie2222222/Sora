# Theme tokens for every static design value in mobile/src, plus day cards and Planning FABs

**Date:** 2026-10-04T15:52:19Z
**Method:** ad hoc
**Verdict:** PASS (static checks, tests, bundles). Not checked on a device or visually.
**Scope:**
- The "Enforce theme-based styling" request: every `.tsx` under `mobile/src`, design-system excluded.
- Two UI requests made during the work:
  - transaction day groups as shadowed cards;
  - a FAB for budgets and goals in place of the in-screen `+`.

**Files touched:**
- 88 files under `mobile/`.
- `docs/DESIGN_GUIDELINES.md` and `CLAUDE.md` (MB-06).

**Related reports:** [2026-10-04-wallet-rename-account-currency.md](2026-10-04-wallet-rename-account-currency.md)

## Method

- **Scanner:** `audit.mjs` (scratchpad), a line scanner over all 134 `.tsx` files. It flags:
  - numeric style values, including inside ternaries;
  - visual props (`size`, `strokeWidth`, `width`, `height`, `radius`, `hitSlop`);
  - colour literals;
  - NativeWind arbitrary `-[..]`, numeric-scale and bare `border` classes;
  - module-level numeric constants;
  - numeric default parameters.
  - Run before the refactor and after it.
- **Tokens first.** Tokens were added to `mobile/src/design-system/` before any file changed.
- **Five parallel agents.** Each owned an exclusive file list and followed one written guide:
  - pick by meaning;
  - derive geometry from other tokens;
  - snap off-scale values to the nearest token (≤2px, ties down);
  - report anything that doesn't fit.
- **I resolved the reported leftovers myself.**
- **Commands:**
  - `npx tsc -p mobile --noEmit`
  - `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` in `mobile/`
  - `npm run test -w @sora/mobile`
  - `node --test mobile/src/design-system/*.test.ts`
  - `npx expo export --platform android` and `--platform web`
  - a grep for function `style` on `Pressable` in changed files (rule 15)

## Findings

**Before:** 521 flagged lines in 84 files. Categories:

| Category | Examples |
|---|---|
| Sizes | 44 / 48 / 32 / 36 / 40 boxes; 360 / 220 / 420 list caps |
| Skeleton dimensions | about 300 `width` / `height` / `radius` props |
| Icon sizes | 121, from 12 to 42 |
| Icon strokes | 1.5 / 1.75 / 2 / 2.2 / 2.25 / 2.5 |
| Border widths | 1 / 1.5 / 3 |
| Font sizes | 10 / 12 / 14 / 16 off the scale |
| Line heights and letter spacing | 18 / 22; 0.1 / 0.2 / 0.3 / 1 |
| Opacities | 0.3 / 0.4 / 0.5 / 0.55 / 0.6 / 0.8 / 0.85 |
| Inline shadows | 4 hand-written copies |
| Colours | dark-mode-only rgba in `CollapsibleSection` |
| NativeWind | `h-[48px]`, `p-[3px]`, `opacity-80`, … |

**Tokens added.** All are mode-independent unless noted, typed through `Theme`, and read via `useTheme()`.

- **`sizes`:**
  - Controls and holders: `touchTarget`, `controlHeight`, `badge`, `dot`, `checkbox`.
  - Rows and fields: `listRowMinHeight`, `currencyField`.
  - Sheets: `sheetHeaderAction`, `sheetHandle`, `sheetBodyMinHeight`, `listMaxHeight`.
  - Floating and navigation: `fab`, `tabBar`, `swipeAction`.
  - Charts and bars: `progressBar`, `chart` (`height`, `largeHeight`, `barWidth`, `minBarHeight`, `ringWidth`).
  - Text and previews: `chipLabelMaxWidth`, `readableWidth`, `swatch`, `toggle`.
  - Placeholders: `skeletonLine` (keyed by the `Text` variant they imitate), `skeletonWidth`, `skeletonBlock`.
  - `hitSlop`.
- **Other groups:** `iconSize` (xs 12 → hero 40), `iconStroke`, `borderWidth`, `opacity`, `lineHeight`, `letterSpacing`.
- **Additions to existing scales:**
  - `radius.xs` (4, used 21×; mirrored in `tailwind.config.js`).
  - `shadows.xs` (elevation 1, for segmented-control thumbs).
  - `colors.surfaceInset`: dark `#0F0F11`, light `#F1F5F9`, added to every palette through `getThemeColors`. The contrast tests now include text on it.

**After:** 75 flagged lines in 36 files. Each one was reviewed, and every one is an allowed exception:
- Animation and gesture values: durations, springs, `SKIRT`, `OPEN_THRESHOLD`, `FRICTION`, `TRAVEL_RATIO`, interpolation.
- Counts and limits: `MAX_LENGTH`, `COLUMNS`, `PREVIEW_LIMIT`, DateStrip `RADIUS` (a day count), `6 * lineHeight`.
- `0` (including inside ternaries) and the neutral `1` in `cond ? theme.opacity.* : 1`.
- Percentages.
- Proportions:
  - `size * 0.5` / `0.4` / `0.44`;
  - placeholder bars as fractions of `chart.height`;
  - pseudo-random placeholder heights as fractions of the bar area.
- Token-derived expressions: hit slops `(touchTarget - iconSize.*) / 2`, toggle padding, circles `x / 2`.
- `'transparent'` and `StyleSheet.hairlineWidth`.

**Day cards.**
- `TransactionDayCard` replaces `TransactionDayHeader`. Each day is one `surface` card with `radius.lg` and `shadows.sm`.
- The list renders one card per day (`RefreshableFlatList` replaces `RefreshableSectionList`).
- Rows keep their swipe actions and `row-transaction-<id>` test IDs.
- Clipping sits on an inner view, because iOS drops a shadow on a view that clips.

**Planning FAB.**
- The inline `+` buttons and their skeleton stand-ins are removed.
- One `Fab` adds a budget or a goal depending on the segment. It keeps the `btn-add-budget` / `btn-add-goal` test IDs and has a screen-reader label.
- It shows only when rows exist, as on the transaction list.
- The new `fabListPaddingBottom` helper replaces the transaction list's hardcoded `+ 88`.

**Rule 15:** no function `style` on a `Pressable` in any changed file.

**Unused locals:** none introduced. Eleven were already there at `HEAD`: `AppNavigator`, `Input`, `TransactionTotals`, `YearlyReport`, `GuestUploadScreen` ×2, `NoWalletState`, `WalletActivityPanel` (`ActivityItem`), and `date.ts` ×2.

## Snaps (visual changes, all small)

- **±1–2px, spacing / font / icon:**
  - segmented-control padding 3→2;
  - font 14→13, 16→15, 10/12→11;
  - icons 13→12, 15→14, 17→16, 42→40;
  - paddings 6→4, 10→8, 14→12;
  - tab bar label nudges 3→2.
- **Larger, by decision:**
  - Chat field 46→48 (`controlHeight`); its padding and send margin re-derive from it.
  - Button `lg` 46→48 and its horizontal padding 20→24, so `lg` stays bigger than `md`.
  - Button `sm` 30→32.
  - Sync status target 30→32.
  - Goal-detail progress bar 10→12, to match budget detail.
  - Transaction list bottom padding 88→84.
  - `SkeletonList` row 64→58.
  - Transaction-row skeleton amount width 50–89 → 40–79.
- **Opacity:**
  - 0.3 / 0.4 → `disabled` (0.5);
  - 0.55 → `muted` (0.6);
  - 0.8 → `pressed` (0.85);
  - sheet handle `opacity-80` → `muted` (0.6).
- **Stroke and letter spacing:** stroke 1.75→1.5, 2.2/2.25→2; letter spacing 0.1/0.3 → 0.2.
- **Dark mode only:**
  - the `CollapsibleSection` divider is now `border`;
  - the open header is `surfaceMuted`, so open and pressed now match;
  - the expanded body is `surfaceInset`;
  - light mode is unchanged.
- **Skeleton placeholders:** widths snapped by up to 10px and heights by up to 4px to the token scales.

## Fixes Applied

- `mobile/src/design-system/sizes.ts` (new) plus additions to `typography.ts`, `radius.ts`, `shadows.ts`, `colors.ts`, `index.ts` and `colors.test.ts`; `tailwind.config.js` gains `radius.xs`.
- 84 component and screen files refactored, as listed in `git diff --stat -- mobile`.
- `SettingsDivider`'s `inset` option is removed: no caller passed it, and it hardcoded 56.
- `docs/DESIGN_GUIDELINES.md`:
  - a new "Design tokens" section;
  - the ledger, Shadows, Cards and Lists rules updated for day cards and the FAB create action;
  - the Part 4 checklist item updated.
- `CLAUDE.md` MB-06 now requires tokens for every static design value, not only colours.

**Re-verified (after the last edit):**
- `tsc` exit 0.
- Mobile tests 597/597.
- Design-system tests 78/78 (run after the colour change).
- `expo export` for android (3816 modules) and web (3522 modules) both bundled.
- Final scanner run: 75 lines, all exceptions as above.

## Follow-ups

- **Not checked visually.** Day cards (shadow in both themes, swipe clipping at the card's rounded corners), the Planning FAB, and the snapped sizes need a look on a device. No E2E flow taps `btn-add-budget` or `btn-add-goal`.
- **`mobile/src/app/navigation/tabBarMetrics.ts` is now unused:**
  - `TAB_BAR_HEIGHT` became `sizes.tabBar.height`;
  - it is still re-exported from `app/navigation/index.ts`;
  - deleting it and that re-export needs your go-ahead.
- **`ToastProvider`'s module-level `StyleSheet`** imports `spacing` from the design system directly rather than through `useTheme()`. It is the same token value; left as is.
- **`DatePickerModal` Back button** sets `fontWeight: 'bold'` beside the Mulish family. Per `Text.tsx`, Android then falls back to the system font. This predates the refactor and is not fixed here.
- **The eleven unused locals listed above** predate this change.
