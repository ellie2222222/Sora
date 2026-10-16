# Net worth panel redesign on the accounts tab

**Date:** 2026-10-16T04:21:13Z
**Method:** ad hoc
**Verdict:** PASS (logic, contrast and tokens machine-checked). On-device look: BLOCKED, no emulator run.
**Scope:** The owner's brief to rework the Net Worth section's hierarchy, layout, colour and motion without changing any figure.

**Files touched:**
- mobile:
  - `features/accounts/{netWorth.ts, netWorth.test.ts}`;
  - `features/accounts/components/{NetWorthSummary.tsx, AccountsOverview.tsx}`;
  - `design-system/colors.test.ts`;
  - 10 locales.
- docs: `DESIGN_GUIDELINES.md` (Cards), `test-plans/accounts.md`, `README.md`.

**Related reports:** `2026-10-16-ai-reliability-chat-and-account-tints.md`

## Method

```
npm run typecheck
npm run test -w @sora/mobile
node --test mobile/src/features/accounts/netWorth.test.ts mobile/src/design-system/colors.test.ts
```

## Findings

1. **The USD and JPY lines are not conversions.**
   - `netWorthByCurrency` groups accounts by currency and never adds across currencies (BR-07).
   - The brief called them "equivalents". Labelling them that way would misstate the data, so they are labelled "Other currencies, held separately".
   - No conversion was added. The dashboard's optional converted valuation (`GET /dashboard?displayCurrency=`) is a separate, approximate figure.
   - → kept correct, PASS
2. **The line under "₫" is part of the glyph.**
   - U+20AB DONG SIGN is a "đ" with a bar below. It is not a text decoration, and removing it would mean changing the currency symbol.
   - At 34px the bar read as an underline. The headline now sets the symbol at 0.6× size in `textMuted`, floored at `fontSize.sm`, beside full-size digits.
   - `splitMoneyText` cuts the formatted string into parts that rejoin to the exact text; tested for VND, USD (negative), JPY and EUR.
   - → PASS
3. **The calculation is unchanged.**
   - `netWorthByCurrency` was moved verbatim to `netWorth.ts`, keeping the same currency order (assets' currencies first, then liabilities'), so the same currency stays the headline.
   - Tests:
     - the screenshot's mix: ₫81,814,100 − ₫3,299,000 = ₫78,515,100, with USD and JPY separate;
     - negative net worth: −150.5;
     - an all-zero wallet.
   - → PASS
4. **Layout.**
   - A `surface` panel (`radius.xl`, hairline) on the black background.
   - The headline steps display → xxl → xl by digit count (`headlineSizeFor`), so a long figure never clips.
   - An ISO code tag sits beside the headline.
   - Other currencies show as chips on `surfaceMuted`.
   - Assets and liabilities are two equal cards (`flex: 1`, `minWidth: 0`) on `incomeMuted`/`expenseMuted`, each with an inset `borderWidth.thick` accent bar, a TrendingUp/Down icon and a word label.
   - In a card, the first currency is `fontSize.lg` bold (allowed to shrink, never muted) and further currencies sit at label size. An empty side shows "—".
   - → PASS (on-device check pending)
5. **Contrast.** New `RENDERED_PAIRS`: `text` and `textMuted` on `incomeMuted`/`expenseMuted`, ≥ 4.5:1 in every palette and mode. → PASS
6. **Motion.**
   - The panel fades in (240 ms) only on a wallet's first show this session; a module-level set stops it replaying on tab switches.
   - The headline and each card's figures fade in (180 ms) only when their values change, never on first render. Values never tween.
   - Reanimated follows the system Reduce Motion setting.
   - → PASS

| Command | Result |
|---|---|
| `npm run typecheck` | 0 errors |
| mobile suite | 746 pass (tokens-usage, locale parity, contrast included) |

## Fixes Applied

As above. The old inline net-worth block and `PositionFigure` were removed from `AccountsOverview.tsx`, along with imports no longer used. The skeleton now mirrors the panel.

## Follow-ups

- On-device check (BLOCKED here): 320dp width, the longest locales (de/ru), both modes, all five palettes.
- Converting other currencies into the headline's currency would need the dashboard valuation endpoint. Not added: it is approximate, and the brief forbids changing figures.
