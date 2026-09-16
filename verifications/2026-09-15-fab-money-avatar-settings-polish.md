# FAB sizing, currency sign spacing, transaction avatars, settings borders

**Date:** 2026-09-15T00:00:00Z
**Method:** ad hoc (design review feedback)
**Verdict:** PASS
**Scope:** Mobile UI polish from design review comments — FAB size/shadow, Money component sign
formatting, transaction row/detail avatars, Settings section borders. No API, contract, or schema
changes.
**Files touched:** mobile/src/components/Fab.tsx, mobile/src/components/Money.tsx,
mobile/src/components/CategoryAvatar.tsx (new), mobile/src/components/TransactionRow.tsx,
mobile/src/components/index.ts, mobile/src/utils/categoryIcons.ts (new), mobile/src/utils/index.ts,
mobile/src/features/transactions/components/TransactionDetailModal.tsx,
mobile/src/features/transactions/components/TransactionListScreen.tsx,
mobile/src/features/settings/screens/SettingsScreen.tsx,
mobile/src/features/settings/components/CollapsibleSection.tsx
**Related reports:** none

## Method

Read the review feedback, traced each complaint to its source component, fixed at the source
rather than per-screen, then ran `npm run typecheck -w @sora/mobile` and `npm test -w @sora/mobile`.

## Findings

- **FAB too large / overlaps list content.** `Fab.tsx` defaulted `size=56` with `theme.shadows.lg`.
  Reduced default to `size=48`, icon ratio 0.46→0.44, shadow `lg`→`md`. `TransactionListScreen.tsx`
  already reserved bottom scroll padding for the FAB's footprint (`fabBottomOffset + 96`); recomputed
  to `+ 88` to match the smaller size and updated the comment. Fixed.

- **Inconsistent currency sign spacing ("- ₫111,111" vs "₫100,000").** Root cause: `Money.tsx`
  rendered a separate Lucide `Minus`/`Plus` glyph next to the amount text (`gap: 2` in a flex row),
  while the text itself carried no sign (`signDisplay: 'never'`). The visual gap between icon and
  text read as a space; rows with no `type` (plain totals) had no icon at all, so they looked
  unsigned by comparison — same underlying cause the reviewer's `- ₫1` vs `-₫1` question pointed at.
  Fixed by removing the icon path entirely: `transaction.amount` is always positive (VL-04 — sign
  lives in `type`, never in the amount), so EXPENSE is now negated via `negate(parseMoney(amount))`
  before formatting, and `signDisplay: 'always'` (mapped to Intl's `exceptZero`) fuses a real `+`/`-`
  into the one formatted string. Verified with `Intl.NumberFormat` directly:
  `-₫1`, `-₫111,111`, `+₫3,321,213`, `₫100,000` (no sign for a neutral/no-type total) — exactly the
  format requested, one string, no gap. `showIcon` prop renamed to `showSign`; no call site passed
  it explicitly, so no other file needed updating.

- **Transaction avatars too noisy (large circle, colored border, initial letter, separate
  colored amount).** Extracted the duplicated initial-letter logic from `TransactionRow.tsx` and
  `TransactionDetailModal.tsx` into a new `CategoryAvatar` component: no border (was 1.5–2px tinted
  border on both), smaller (34px row / 48px detail, was 38px / 54px), and renders the category's
  actual lucide icon (`category.icon`, e.g. `"utensils"`, `"shopping-bag"` — already present on
  every starter category, see `packages/contracts/src/starter-categories.ts`) via a new
  `categoryIconFor()` map in `mobile/src/utils/categoryIcons.ts`, falling back to the first-letter
  initial only for categories outside that set or with no icon. TRANSFER rows always get an
  `ArrowLeftRight` icon regardless of category. The "separate colored amount" half of the complaint
  was resolved as a side effect of the Money fix above (icon glyph removed, amount is one coloured
  text run).

- **Settings section borders.** Removed the `borderWidth`/`borderColor` around the grouped
  Appearance/Language/Sync/About `Card` in `SettingsScreen.tsx` (was 1px in light mode, already 0 in
  dark) and the `borderTopWidth` on `CollapsibleSection`'s expanded panel — both are now delimited by
  the existing elevated shadow and background-tint contrast alone, no hard border line. Left the
  `SettingsDivider` hairlines between sibling sections (structural separators, not a wrapping
  border) and the small decorative borders on `AppearanceSection`'s theme swatches and
  `AboutSection`'s app-icon circle, since neither is part of the section container the request
  targeted.

## Fixes Applied

All of the above applied directly (see Files touched); re-verified via `npm run typecheck -w
@sora/mobile` (clean) and `npm test -w @sora/mobile` (139/139 passing) after every edit.

## Follow-ups

- `categoryIconFor()` only maps the six starter-category icon names. A custom category created
  with an icon name outside that set (or `null`) falls back to its initial letter — fine for now,
  but if a category icon picker ships later, the map should grow with whatever icon set that picker
  offers.
- Not visually verified on-device/simulator — no Expo runtime available in this pass. Typecheck and
  existing unit tests are the verification; a real render check is a reasonable next step before
  calling this done end-to-end.
