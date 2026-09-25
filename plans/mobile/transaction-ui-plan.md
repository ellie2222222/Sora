# Transaction List UI — Refinement Plan

Originating brief: an external design review proposing a "Clean Ledger / Premium Finance UI"
direction for the transaction list (denser-than-needed rows, heavy icon backgrounds, saturated
red/green, no abbreviated summaries). That review assumed a single fixed dark palette (hardcoded
hex values) and a component structure that doesn't match this codebase. This revision keeps the
review's genuinely good calls, drops the ones already shipped or already correct, and replaces
every hardcoded color with this app's actual token system — [mobile/src/design-system/colors.ts](../../mobile/src/design-system/colors.ts),
5 themes (`obsidian`/`quartz`/`sage`/`terracotta`/`violet`) × 2 modes, selected at runtime. A
fixed hex palette can't survive that; every recommendation below is expressed as a semantic token
(`theme.colors.*`) so it holds across all 10 palette/mode combinations, not just one.

## Status: what the original review flagged that's already fixed

Most of the review's specific complaints were addressed earlier in this pass. No action needed:

- **"Icons are visually heavy (dark circular background + strong colored icon)"** — fixed.
  [CategoryAvatar.tsx](../../mobile/src/components/CategoryAvatar.tsx) is a borderless, neutral
  `theme.colors.surfaceMuted` circle with only the icon/initial tinted — exactly the review's own
  recommended shape (36×36 default, icon at `size * 0.5`). `TransactionRow` uses `size={34}`,
  close enough to the review's 36 that it's not worth a special case.
- **"Transfer shouldn't be colored like income"** — already correct.
  [money.ts:182](../../mobile/src/utils/money.ts#L182) `directionOf()` maps `TRANSFER` to
  `'neutral'`, and [Money.tsx:30](../../mobile/src/components/Money.tsx#L30) colors `neutral` as
  plain `theme.colors.text` — never `theme.colors.income`.
- **"Sign and currency symbol should read as one unit"** — already correct (a separate, earlier
  fix in this session). `Money.tsx` fuses the sign via `Intl`'s `signDisplay: 'exceptZero'` rather
  than a separate `+`/`-` glyph.
- **"Don't repeat the account name when it adds nothing"** — already handled.
  [TransactionRow.tsx:39-46](../../mobile/src/components/TransactionRow.tsx#L39-L46) only adds the
  category name to the subtitle when a user-written description exists as the title; otherwise the
  category *is* the title and the subtitle is just the account.
- **"Date groups should read as sections, not divided by a border per row under a heading"** —
  done: `TransactionDayHeader` in [TransactionListSection.tsx](../../mobile/src/components/TransactionListSection.tsx)
  shows a day heading with `TransactionTotals` (income + expense, color-coded) beside it,
  and the only divider is the one between the heading and the first row (see below).

## Done — removed the border between individual transaction rows

Rows inside a day group are separated by whitespace only (`TransactionRow`'s own
`paddingVertical`). The one remaining rule is the section divider under the day heading —
`border-t` in [TransactionListSection.tsx:42](../../mobile/src/components/TransactionListSection.tsx#L42)
(`TransactionDayHeader`), which the review agreed to keep. Since 2026-09-24 the list renders
through a virtualized `RefreshableSectionList` with `TransactionDayHeader` as the section header
and the memoized `TransactionListRow` per row, instead of one `TransactionListSection` per day.

## Open item 2 — abbreviate the day/month summary totals

The review's other concrete, still-open call: the day heading and month header should show
`+₫2.32M` rather than the full `+₫2,321,213`, while the row itself keeps full precision. The
plumbing for this already exists and is unused for this case —
[money.ts:60-68](../../mobile/src/utils/money.ts#L60-L68) `MoneyFormatOptions.compact` maps
straight to `Intl`'s `notation: 'compact'`.

**Change:** in [TransactionTotals.tsx](../../mobile/src/components/TransactionTotals.tsx), pass
`formatOptions={{ compact: true }}` on both `Money` calls (lines 25 and 28). `TransactionRow`'s
own `Money` (full-precision) is untouched — this only affects the day-heading and month-header
summary rows that already use `TransactionTotals`, which is exactly the hierarchy the review
wanted: **summary = compact, transaction = precise.**

## Done — softened `income`/`expense` saturation

Shipped: [colors.ts:115-122](../../mobile/src/design-system/colors.ts#L115-L122) `SEMANTIC_BASE`
now uses the review's softer values (`income`/`success: '#32D583'`, `expense`/`danger:
'#FF5C5C'`, replacing Tailwind's `green-500`/`red-500`). This is shared across all 5 themes and
both modes, so it changed everywhere at once — transaction amounts, success/danger buttons and
banners, everywhere `theme.colors.income`/`expense`/`success`/`danger` is read. `transfer` and
`warning` were left untouched; the review never asked to change those.

## Not adopting

- **The review's hex palette wholesale** (`#08090B` background, `#15161A` card, etc.) — this app
  already has 5 background/surface pairs, one per theme; a single fixed pair would either replace
  the theme system or silently only apply to one theme. Not something a UI-polish pass does.
- **Retyping the row/icon/spacing pixel values as new tokens** — the review's spacing suggestions
  (12/16/3/28px) land close enough to the existing scale
  ([spacing.ts](../../mobile/src/design-system/spacing.ts): `xs=4, sm=8, md=12, lg=16, xl=24,
  xxl=32`) that the open item above is the only layout change needed; nothing here
  justifies adding a new spacing token for a one-off value.

## Reference layout (current structure, token names instead of hex)

```text
TODAY · 15 SEP                                    [income]+₫2.32M  [expense]−₫1.11M

  (icon, theme.colors.surfaceMuted circle)  Bills                    −₫111,111
                                             Cash

  (icon)                                     Transfer                 ₫100,000
                                             Cash → CC                              [colors.text, neutral]
```

No border between the two rows above (done); totals row uses `compact: true` (open item 2);
row amounts stay full precision; transfer amount stays `theme.colors.text`, never colored as
income.
