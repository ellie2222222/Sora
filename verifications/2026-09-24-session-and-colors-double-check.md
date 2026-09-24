# Double-check of this session's later work + full audit of colors.ts

**Date:** 2026-09-24T04:39:51Z
**Method:** double-check skill
**Verdict:** PASS
**Scope:** as named by the user — everything since the last double-check (gesture-handler pull-to-refresh,
icon→spinner crossfade fix, keypad date key, toast spacing, status/flow colours, contrast audit) plus a
line-by-line audit of `mobile/src/design-system/colors.ts`.
**Files touched:** `mobile/src/design-system/colors.ts`, `mobile/src/design-system/colors.test.ts`
**Related reports:** [2026-09-24-colour-contrast-audit.md](2026-09-24-colour-contrast-audit.md),
[2026-09-24-pull-to-refresh-gesture-handler.md](2026-09-24-pull-to-refresh-gesture-handler.md)

## Method

- Read `colors.ts` in full; `grep -rn "colorsByTheme\|PALETTE_RAMPS\|THEME_LABELS"` repo-wide;
  per-token `grep -rn "colors\.<token>\b" mobile/src` for every token; `grep -rnE "colors\[|theme\.colors\)"`
  for dynamic access.
- `npx tsc --noEmit` (mobile); `npm run test -w @sora/mobile`; scratch contrast matrix over all
  palettes × modes; `npx expo export --platform android` to scratchpad.
- `grep` for removed symbols (`colorsByTheme`, `THEME_LABELS`, `buttonDisabled{Background,Border,Text}`,
  `key-today`, `SEMANTIC_BASE`), rule 15 (`style={({`), hardcoded `'Today'` in the keypad path.

## Findings

1. `colorsByTheme` — exported, zero references anywhere; also mixed modes (obsidian dark, rest light). FAIL (dead) → removed.
2. `THEME_LABELS` — exported, zero references. FAIL (dead) → removed.
3. `buttonDisabledBackground/Border/Text` — zero component references (Button reads only the
   variant-specific set); kept alive only by the tokens-present test. FAIL (dead) → removed with the test entries.
4. Duplicated literals — surface hex repeated in the `mixHex` tint calls; `buttonDangerDisabledBackground`
   restated the `dangerMuted` hex that a test requires it to equal. FAIL (drift risk) → `DARK_SURFACE` /
   `LIGHT_SURFACE` constants; disabled-danger background references `SEMANTIC_MUTED_*.dangerMuted`.
5. Header comment — said "300/600/900" ramps (there are four) and implied slot = shade, which sage/terracotta
   `600` no longer are. FAIL (stale) → corrected.
6. Unused-by-components but kept: `transfer`, `incomeMuted`/`expenseMuted`/`transferMuted`, `successMuted` —
   documented palette tokens (DESIGN_GUIDELINES: every semantic colour has a `*Muted`) and asserted by
   `RENDERED_PAIRS`. No dynamic `colors[...]` access exists. Not dead config; noted only.
7. Session work: no references to removed symbols; no function `style` on Pressable; no hardcoded
   `'Today'` left in the keypad/modal; `spinnerVisible` still used (a11y busy). PASS.
8. Typecheck clean; tests 278/278; contrast matrix `all pass`; Android bundle exported (7.4MB, no errors). PASS.

## Fixes Applied

#1–#5 as above in `colors.ts` and `colors.test.ts`; re-verified by the typecheck, test, contrast and
export runs in Method (all after the edits).

## Follow-ups

- ~~Carried: light `textFaint` 2.56:1 on white~~ — resolved; see the contrast audit report.
- Carried: none of the gesture/colour changes viewed on a device; dev-client builds need one native rebuild
  for `react-native-gesture-handler`.
- `transfer` colour has no component using it — transfers render without their semantic colour today.
