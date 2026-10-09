# Readability audit: text below its tone's size floor

**Date:** 2026-10-09T04:51:51Z (pass 1), completed 2026-10-09 after the user approved the `caption` change
**Method:** ad hoc (readability-audit skill)
**Verdict:** PASS
**Scope:** every text-rendering element in `mobile/src`, against "Type size and tone" in `docs/DESIGN_GUIDELINES.md`
**Files touched:**

- `Text.tsx`, `sizes.ts`, the new `readable-text.test.ts`, and a comment in `colors.test.ts`;
- `TrendBarChart.tsx`, `MainTabNavigator.tsx`, `ConfirmDialog.tsx`;
- the 17 call-site files from pass 1, listed below.

**Related reports:** none (first run)

## Method

1. **Rule inputs, read from the code:**
   - `typography.ts`: `fontSize` xs 11, sm 13, md 15.
   - `Text.tsx`: `VARIANT_SIZE`, with `caption` at xs before this pass.
   - The `Text` tone map: muted→`textMuted`, faint→`textFaint`.
2. **Scan** of every `<Text>`/`<Money>`/`<Animated.Text>` opening tag:
   - effective size: the variant, or a `fontSize` override if present;
   - effective tone: the `tone` literal or each branch of a `tone={…}`, plus a `color: theme.colors.textMuted|textFaint` override.

   The same logic is now the test `mobile/src/design-system/readable-text.test.ts`, which reads `VARIANT_SIZE` live from `Text.tsx`.
3. **Greps:**
   - `fontSize.(xs|sm)` outside design-system;
   - `placeholderTextColor`;
   - shrink and scale flags;
   - `textFaint` held in style variables, read by hand.
4. **Checks:** `npm run typecheck -w @sora/mobile` and `npm run test -w @sora/mobile`.
5. **Emulator (Medium_Phone, dark theme):** English, Russian and German. Russian and German were switched with the device offline (`airplane-mode enable`), so `authApi.updatePreferences` never reached the API. The emulator's `font_scale` was set to 1.3 for one round, then back to 1.0.

## Findings

1. **Before:**
   - faint below `md`: 17 sites (13 faint `caption`, 1 faint `label`, the tab bar, 2 style colours, 2 runtime-chosen);
   - muted at `xs`: 57 sites;
   - explicit `fontSize.xs` overrides: 3.
2. **Shared default:** `variant="caption"` mapped to `xs`, and it had 108 callers, `SectionLabel` among them. It caused every muted-at-`xs` violation.
3. **After mapping `caption` to `sm`**, two tight fixed grids no longer fit:
   - **TrendBarChart month ticks in Russian:** февр., март, июнь, июль, сент. and нояб. wrapped onto two lines, 91 px instead of 47 px. That pushed the bars up into the section heading.
   - **German tab bar:** the selected "Einstellungen" truncated to "Einstellung…".
4. **Pass items:**
   - placeholders draw at `md`;
   - the only shrink flag is the default-tone net worth figure;
   - faint text at `md`+ is allowed;
   - no `allowFontScaling={false}` or `maxFontSizeMultiplier` anywhere.

## Fixes Applied

- **Shared default, with the user's go-ahead** ("go ahead", after choosing `sm` over `md`):
  - `Text.tsx:29`: `caption: 'xs'` → `'sm'`, with a why-comment.
  - `sizes.ts:50`: `skeletonLine.caption` 12 → 14, to match `label`.
  - `ConfirmDialog.tsx:129`: dropped its now-redundant `fontSize.sm` override.
- **Tight grids:** both keep `xs` and switch to full-strength text, which the rule allows for xs.
  - `TrendBarChart.tsx:49`: month tick at `fontSize.xs`, default tone, `numberOfLines={1}`.
  - `MainTabNavigator.tsx:170`: tab label at `fontSize.xs`. Inactive tabs use `text` and the active tab stays `primary`. Icons keep `textMuted`.
- **Call sites from pass 1:**
  - **Faint → muted:** `OtherCurrencies`, `LoginScreen`, `ActionProposalCard` (×2), `ConversationHistorySheet`, `AiChatScreen`, `BudgetGoalSummary` (×2), `CategoryBreakdown` (×2), `IncomeExpenseSummary` (×2), `MemberSplit`, `UploadProgressPanel`, `AccountsOverview` (`PositionFigure`), `UploadStepsCard` (queued count), `DateStrip` (month label; `mutedColor` removed), `DatePickerModal` (out-of-month days).
  - **Overrides:** `AppearanceSection` lost its two `fontSize.xs` overrides. `DatePickerModal`'s Back badge is now `variant="label" weight="bold"`.
- **Lock-in:** `readable-text.test.ts`.
  - **Negative check:** a throwaway file, `components/ZzReadabilityProbe58c6710d.tsx`, held three violations. The test reported "faint text at sm (13), below md" and "opacity on muted text", and failed. Its faint-at-body line passed, which is correct. The file was then deleted by its exact name, and `ls` confirmed it gone.
  - `colors.test.ts:208`: the comment no longer lists captions or tab labels as faint text.
- **Re-verified:**
  - `npm run typecheck -w @sora/mobile` exits 0.
  - `npm run test -w @sora/mobile` passes 691/691, including both `readable text` tests.
  - **Emulator:**
    - English Home, Dashboard and yearly chart: captions are 13 px, with no clipping.
    - Russian yearly ticks are one line, 39 px tall.
    - The German tab bar shows "Einstellungen" whole.
    - The German Day-view date strip fits.
    - At 1.3× font scale, the Dashboard wraps and ellipsizes cleanly.
  - **API access log:** 0 `PATCH`/`preferences` lines across both offline rounds, from baseline lines 1794 and 2711.

- **Chart month ticks** (follow-up round):
  - **Problem:**
    - Russian "февр." still truncated to "фев…" at 11 px.
    - Vietnamese uses the long month name on purpose ("tháng 10", `monthStyle` in `utils/date.ts`), which cannot fit twelve across.
  - **Fix:**
    - New `monthTick` in `utils/date.ts`: the short name with a trailing `.` or `॰` removed, and Vietnamese as the `Intl` numeric month.
    - `YearlyReport.tsx` uses it.
    - `monthName` and `monthTick` share new `clampMonth`/`formatMonth` helpers.
    - The tick text is still produced by `Intl`; none is hand-written.
  - **Tests:** `monthTick` cases in `date.test.ts`.
  - **Re-verified:**
    - `npm run test -w @sora/mobile` passes 693/693.
    - Emulator, offline: the Russian ticks read янв, февр, март … нояб, дек, all on one line with nothing truncated. The Vietnamese ticks read 1 … 12.
- **Further device checks, offline from baseline line 2783:**
  - light theme: Vietnamese Dashboard and Home, with muted captions clear;
  - the Russian Day-view date strip on 26–30 Sept: "сент." fits at 13 px;
  - afterwards everything was restored to dark theme, English and the Month view.

  The API log has 0 `PATCH`/`preferences` lines.

## Follow-ups

- **Native-speaker check:** chart ticks without the period ("февр", "févr") and numeric Vietnamese months.
- **Not checked on the device:** the date picker's Back badge, a size change in place covered by the scan test.
- **Guest upload card:** checked through the dev-only "Preview the upload screen" (`UploadPreview.tsx`, a local simulation that imports no API code). The queued step counts render muted and readable.
