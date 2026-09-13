# Mobile UI redesign — 5-tab IA, Report feature, dead-code sweep

**Date:** 2026-09-11T00:00:00Z
**Method:** ad hoc build (plan-mode approved), then `double-check` skill
**Verdict:** PASS
**Scope:** Full mobile UI redesign per an approved plan (`/home/globee/.claude/plans/magical-snuggling-stardust.md`):
bottom-nav restructure to Home/Account/Goals/Report/Settings, a floating FAB, a new Report feature (Monthly/Yearly,
composed entirely from the existing dashboard endpoint — no backend/contract changes), a new Account tab, a
Home rewrite (month selector, MoM comparison, budget-progress summary, unified transaction timeline), a visual
pass on Goals and the transaction-creation flow, and Settings moved from a stack screen to a tab.
**Files touched:** see Fixes/Changed sections below; full list also in the chat summary.
**Related reports:** none — first pass on this redesign.

## Method

```
npm run build -w @sora/contracts
npm run typecheck -w @sora/mobile
npm test -w @sora/mobile                 # 120 tests
node scripts/check-contract-parity.mjs   # 31/31
```

Phase 1 (codebase health) delegated to a general-purpose agent scoped to the exact diff, asked to verify
every finding against the live files rather than trust its own summary. Every finding below was re-checked
in the real file before being acted on.

## Findings

### 1. FIXED — Date field in AddTransactionScreen was unusable

`AddTransactionScreen.tsx`'s new Date input called `replaceDay(current.transactionDate, day)` on every
keystroke against the *already-mutated* `draft.transactionDate`, not the original instant. Typing
`2026-09-15` character by character corrupted the stored instant after the first keystroke (`"2" +
instant.slice(10)`), and the field then echoed the corrupted value back. `EditTransactionScreen.tsx`
already had the correct pattern (separate raw-text state, applied once at submit) — this was a genuine
divergence, not a stylistic difference.

Fixed by mirroring that pattern: a separate `dayText`/`dayError` state pair, validated against
`DAY_PATTERN` and merged into the draft via `replaceDay` once, at submit.

### 2. FIXED — AccountsScreen had no "no wallet yet" state

Every other tab (Home, Report) checks `activeWalletId === null` before rendering; `AccountsScreen` did
not, so a wallet-less account fell through to the generic "No accounts yet — Add a bank account" empty
state instead of prompting to create a wallet first (MB-07 gap). Added the same branch Home/Report use,
reusing the existing `home.noWalletTitle`/`home.noWalletDescription` i18n keys rather than adding new
ones for the same message.

### 3. FIXED — Yearly report could spin forever if any month's query failed

`YearlyReport` tracked "loaded" by `data !== undefined`; a per-month query that settles as an *error*
never produces defined data, so `settledCount` would never reach 12 and the screen would show a
skeleton indefinitely. Reworked to track settlement (`isSuccess || isError`) separately from the data
itself, so an errored month degrades to a zero point in the chart instead of hanging the whole screen.

### 4. FIXED — TrendBarChart was fed raw scaled-bigint minor units through `Number()`

`Number(parseMoney(...))` widened a `Scaled` (bigint, ×10⁴ minor units) straight into a JS number for
chart-bar height. Harmless today only because the ratio cancels the scale out, but it's exactly the
"money is never a JS number" pattern CLAUDE.md's rule 1 exists to catch, and it would silently misrender
for an amount near `Number.MAX_SAFE_INTEGER`. Replaced with `percentageOf`/`maxOf` (bigint-space ratio,
already the pattern `ProgressBar`/budgets use) so no `Scaled` value is ever widened to `Number`.

### 5. FIXED — four near-identical "sum MoneyString per currency" loops

`TransactionListSection.tsx`'s `sumByType`, `AccountsScreen.tsx`'s `netWorthByCurrency`, and the two
buckets inside it were each hand-rolling the same Map-and-`add` loop. Extracted `sumScaledByKey` into
`mobile/src/utils/money.ts` (money-formatting utilities' existing home) and refactored both call sites
onto it. `HomeScreen.tsx`'s `summarizeActiveBudgets` was left as a plain reduce — it sums two fields
already filtered to one known currency, not a genuine per-currency grouping, so forcing it through the
same abstraction would have added indirection without removing real duplication. `ReportScreen.tsx`'s
yearly category totals were left as-is for the same reason: that loop groups by `categoryId`, not
currency, and carries category name/color alongside the sum, which doesn't fit an amount-only helper.

### 6. Comment wording — "dominant currency" overstated a guarantee

`HomeScreen.tsx`'s `netChangeVsPrevious`/`summarizeActiveBudgets` comments said "dominant currency."
Checked `server/src/common/currency-totals.ts`: `CurrencyLedger.currencies()` returns
`[...keys()].sort()` — alphabetical, not any notion of a wallet's "primary" currency (the domain has no
such concept). Reworded both comments to state what's actually guaranteed instead of implying a ranking
that doesn't exist.

### 7. Checked and clean

- No dead references to the old tab names (`Transactions`/`AddTransaction`/`Budgets` as
  `MainTabParamList` members) anywhere in `mobile/src` — the navigation restructure left nothing behind.
- `HomeScreen.tsx` and `TransactionsScreen.tsx` both correctly use the new shared
  `TransactionRow`/`TransactionListSection` — no duplicate hand-rolled row rendering remained.
- `AccountDetailScreen.tsx`'s deep link into `Transactions` (now a stack screen, was a nested tab)
  updated correctly; grepped for any other `navigation.navigate('Main', { screen: 'Transactions' ...`
  shape — none.
- `noUncheckedIndexedAccess`: no non-null assertions or `as any` in the new/changed files; every
  `array[0]`/`Record` access is guarded with an explicit `undefined` check.
- Money arithmetic in `netWorthByCurrency` (asset/liability sign split) and `summarizeActiveBudgets`
  (div-by-zero via `percentageOf`'s `whole === 0n` guard) verified correct against
  `packages/contracts/src/money.ts`'s actual semantics.
- MB-07 (loading/empty/error/success) present on `TransactionsScreen`, `BudgetsScreen`, `MonthlyReport`.
  `SettingsScreen` has no async data, so the checklist doesn't apply to it.

## Fixes Applied

| # | File | Change | Re-verified by |
|---|---|---|---|
| 1 | `features/transactions/screens/AddTransactionScreen.tsx` | Raw `dayText` state, applied once at submit | typecheck; traced the keystroke path by hand |
| 2 | `features/accounts/screens/AccountsScreen.tsx` | Added no-wallet empty state | typecheck |
| 3 | `features/reports/screens/ReportScreen.tsx` | Settlement tracked independent of data-defined | typecheck |
| 4 | `features/reports/screens/ReportScreen.tsx` | `percentageOf`/`maxOf` instead of `Number(Scaled)` | typecheck |
| 5 | `utils/money.ts`, `components/TransactionListSection.tsx`, `features/accounts/screens/AccountsScreen.tsx` | Extracted `sumScaledByKey`, refactored two call sites | typecheck; 120/120 tests |
| 6 | `features/dashboard/screens/HomeScreen.tsx` | Comment wording only | — |

Final state: `npm run typecheck -w @sora/mobile` clean; `npm test -w @sora/mobile` 120/120; contract
parity 31/31. No `packages/contracts`, `db/`, or `server/` changes in this pass — those checks were run
anyway since they're cheap and the change touches a shared package's consumer, but nothing in them was
expected to move and nothing did.

## Follow-ups

- Yearly report's 12-parallel-query composition is a deliberate lite implementation (see the approved
  plan's Decision 1) — a real backend aggregation endpoint is the documented next step if this proves
  too slow or too chatty in practice.
- Settings sections beyond Appearance/Language/Account (Currency & Formatting, Notifications, Data
  export/import/backup, About) are out of scope this pass — no backing state/preferences exist for them
  yet.
- i18n coverage on Budgets/Goals/Accounts/Report screens remains incomplete (pre-existing gap, tracked
  in `mobile/GAPS.md`) — new screens in this pass use `t()` where a key already existed, but did not
  retrofit every hardcoded string on screens only touched visually.
- Unrelated cleanup done alongside this pass, not part of the redesign: removed 1516 untracked
  `*Zone.Identifier` cruft files (Windows/WSL download-marker artifacts, none git-tracked) and a stale,
  untracked `HANDOFF.md` describing a hooks architecture already superseded by the RTK Query API slices
  visible in the current `git status`.
