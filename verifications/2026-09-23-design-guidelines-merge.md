# Merge of UI design rules into docs/DESIGN_GUIDELINES.md

**Date:** 2026-09-23T14:26:35Z
**Method:** double-check skill
**Verdict:** SKIP
**Scope:** docs-only change — `docs/UI_DESIGN_RULES.md` + `mobile/DESIGN_GUIDELINES.md` merged into `docs/DESIGN_GUIDELINES.md`, CLAUDE.md MB-11 pointer. No code, so no typecheck/runtime; checked references and the doc's claims against the code.
**Files touched:** docs/DESIGN_GUIDELINES.md, CLAUDE.md
**Related reports:** none

## Method

- `grep -rn "UI_DESIGN_RULES\|mobile/DESIGN_GUIDELINES" . --exclude-dir=node_modules`
- `grep -n "^\*\*MB-\|^\*\*NC-04\|^15\. \|^\*\*BR-0[67]" CLAUDE.md` — every rule ID cited in the doc
- grep in `mobile/src` for each named symbol: `StateView`, `SkeletonList`, `Skeleton`, `AnimatedScreen`,
  `WalletContextBar`, `Card`, `Button`, `Text`, `Money`, `spacing`, `radius`, `colors.border`,
  `income`/`expense`/`transfer`/`warning`/`danger`/`success`/`primary` tokens, `numericFontVariant`,
  `MoneyFormatOptions`
- `grep -rn "export function formatMoney" packages/contracts/src mobile/src`

## Findings

- Dangling references to either removed path → none. PASS
- Rule IDs MB-03/05/06/08/09/11, NC-04, BR-06/07, Part 7 rule 15 → all exist in CLAUDE.md. PASS
- Component/token names → all exist; spacing scale 4/8/12/16/24/32 and radius scale match
  `spacing.ts`/`radius.ts`. PASS
- Money rendering claim → FAIL as written. The doc said "render through `formatMoney`/`formatMoneyCompact`",
  but those (`packages/contracts/src/money.ts:71,80`) return a plain `MoneyString`, not display text.
  Display goes through `<Money>` (`mobile/src/components/Money.tsx`) or `formatMoneyString`/`formatScaled`
  (`mobile/src/utils/money.ts:96,119`); tabular figures are `<Text numeric>` → `numericFontVariant`.

## Fixes Applied

- `docs/DESIGN_GUIDELINES.md:50-54, 56, 435` — money lines now name `<Money>`, `formatMoneyString`/`formatScaled`,
  `signDisplay: 'always'`, `compact: true` and `<Text numeric>`. Re-verified: grep for `formatMoney\b` /
  `tabular-nums` in the doc returns nothing; `MoneyFormatOptions` (`money.ts:60-68`) has `compact` and `signDisplay`.

## Follow-ups

- CLAUDE.md MB-08 has the same stale claim (`formatMoney`/`formatMoneyCompact`). Not changed this pass
  because it's a governing rule; it should name `<Money>`/`formatMoneyString`.
