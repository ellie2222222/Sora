# Transaction screen: continuous layout + calendar-window date picker

**Date:** 2026-09-15T00:00:00Z
**Method:** ad hoc (user request)
**Verdict:** PASS
**Scope:** `TransactionListScreen` (Home tab + Transactions stack, both render through this shared
component) and `DatePickerModal`'s day grid. No data model, SQLite/offline-sync, navigation
architecture, or `TransactionRow`/FAB/bottom-nav changes — all explicitly preserved per the request.
**Files touched:** mobile/src/features/transactions/components/TransactionListScreen.tsx,
mobile/src/components/DatePickerModal.tsx, mobile/src/utils/date.ts
**Related reports:** [2026-09-15-fab-money-avatar-settings-polish.md](2026-09-15-fab-money-avatar-settings-polish.md),
[2026-09-15-nativewind-migration.md](2026-09-15-nativewind-migration.md) — this pass continues work
on the same screen.

## Interpretation (stated up front, per the ambiguity in the request)

The request's ASCII mockups describe a day-level "calendar window" with muted, tappable
previous/next-month overflow days. The only day-grid UI in this codebase is `DatePickerModal`'s
month grid (opened from the compact `‹ 15 Sep 2026 ›` selector, which already shows day+month+year
— matching the request's "Current Month Context" example as-is, no change needed there). There is
no separate always-visible inline day-strip on the main screen today. Read the request as: enhance
that existing grid (the app's one real calendar surface) rather than build a new, separate
persistent strip widget — the smaller, more consistent change, and the one that satisfies every
concrete ask (muted overflow days, tap-to-jump-month, selected/today distinction, immediate header
update) without inventing new UI surface area.

## Changes

**1. Continuous layout (request §1, §6, §8)**
- `TransactionListScreen`'s date-nav row: dropped `theme.colors.surfaceMuted` background and
  `border-b` — it now sits flush against `WalletContextBar`'s background instead of reading as a
  separate banner/card.
- List `contentContainerStyle`: split `padding` into `paddingHorizontal: spacing.md` +
  `paddingTop: spacing.sm` (was `spacing.md` on all sides) — tighter gap between the date row and
  the first transaction group. `paddingBottom` (FAB clearance) unchanged. All values are existing
  spacing tokens, no arbitrary numbers introduced.
- `TransactionRow`, `Fab` sizing/position, and bottom navigation: untouched (request §7, §8, §9).

**2. Calendar-window day grid (request §2–§5, §12)**
- `utils/date.ts`: `monthGrid()` changed from padding leading/trailing blanks with `null` to real
  adjacent-month `CalendarDay` values via the existing `addDays()` (already handles month/year
  rollover correctly — reused, not reimplemented), each tagged `{ day, inCurrentMonth }`. Only
  consumer is `DatePickerModal`, so the shape change is contained.
- `DatePickerModal`: every cell is now a real, tappable day. Overflow (adjacent-month) cells render
  in `theme.colors.textFaint` instead of `theme.colors.text`; selected/today styling (solid
  `primary` fill / `primaryMuted` ring — never opacity alone) takes priority over the muted
  treatment, so a selected or today cell stays clearly distinguished even in the overflow region.
  No new colors — reused `primary`/`primaryMuted`/`textFaint`/`onPrimary`.

**3. Month jump on tap (request §3)**
- No new wiring needed: `handleSelectDayInternal` already calls `onSelectDay(day)` with whatever
  day was tapped, and `TransactionListScreen` already derives `dateFrom`/`dateTo` from
  `startOfMonth(selectedDay)`/`endOfMonth(selectedDay)` — tapping an adjacent-month day was already
  going to move the whole screen to that month once the day itself became tappable. The arrows
  (`onPrev`/`onNext` via `addMonths`) are untouched and still work independently.

**4. No skeleton flash on month change (request §10)**
- `TransactionListScreen` now tracks `displayedItems` + a `scopeKey` (`walletId|accountId|categoryId`
  — "whose money," not "which month"). A `scopeKey` change (switching wallet, or the account/
  category filter) clears `displayedItems` immediately, since showing a moment of one wallet's
  transactions under another's context would be a real correctness issue, not just a UX rough edge.
  A month change alone (`scopeKey` unchanged) keeps the previous month's rows on screen — the
  `useEffect` only *replaces* `displayedItems` once `transactions.data` for the new month actually
  resolves, so there is no intermediate empty/skeleton state for a plain date-picker interaction.
  The full-screen skeleton only ever shows on a genuine first load (`isLoading` with nothing
  displayed yet), exactly as before.

**5. Offline / local data (request §11)**
- No changes to `transactionsApiSlice`/`services/sync` — date navigation already goes through the
  same `useListTransactionsQuery` the month arrows always used, which already reads from
  guest/offline local data when offline (`services/guest`) and RTK Query's cache otherwise. Nothing
  new triggers a network request; the ask here was already satisfied by the existing architecture.

## Findings

- Confirmed via read of `transactionsApiSlice.ts` that `listTransactions` already falls back to
  local/guest data when offline or on a network error — no change needed to satisfy "don't require
  a network request merely to navigate."
- Confirmed `monthGrid`'s only consumer is `DatePickerModal.tsx` before changing its return shape.
- Confirmed `MonthSelector`'s existing label (`formatDay(selectedDay)`) already renders
  "15 Sep 2026" — matches request §5's example verbatim; no change made there.

## Fixes Applied

All changes described above; re-verified with `npm run typecheck -w @sora/mobile` (clean) and
`npm test -w @sora/mobile` (139/139 passing) after.

## Follow-ups

- **Not visually verified** — no Expo runtime available in this pass. Worth confirming on-device:
  the muted overflow-day contrast in both light/dark and at least one non-default palette, and that
  the tightened header spacing doesn't crowd `WalletContextBar` on a small screen.
- The "keep last month visible while the next loads" behavior only smooths a *month* change; a
  wallet/account/category switch still clears and shows the skeleton/empty state immediately by
  design (see Changes §4) — flagging in case that reads as inconsistent rather than intentional.
- Scroll position on month change was not explicitly addressed — `RefreshableScrollView` remounts
  its content per render but is not itself remounted (no `key` change), so native scroll position
  is expected to persist by default; not independently verified on-device.
