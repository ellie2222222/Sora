# Dashboard — Current State

A snapshot of what the dashboard actually is today: where it lives, what it computes, what it
doesn't, and what's known to be wrong with it. This is a status document, not a spec — the
authoritative contract is [docs/API_SPECIFICATION.md §14.1](../../docs/API_SPECIFICATION.md#141-get-dashboard);
this exists to answer "what state is this feature in right now" without having to reconstruct it
from the code and the verification reports below.

## What "dashboard" actually means in this codebase

**`GET /dashboard`** is a single aggregate endpoint answering "how much do I have, what came in,
what went out, where did it go" for one wallet over one period (API spec §14.1). One mobile screen
consumes it:

| Directory | What it actually shows | Consumes `/dashboard`? |
|---|---|---|
| `mobile/src/features/home/screens/HomeScreen.tsx` | The **Home tab** — a thin wrapper around `TransactionListScreen` (a transaction feed + FAB). Does not call the dashboard endpoint at all. | No |
| `mobile/src/features/dashboard/screens/DashboardScreen.tsx` | The **Dashboard tab** — monthly summary figures, the spending-by-category donut chart, a 12-month trend, and the deterministic "insights" lines. This is where `/dashboard`'s data actually renders. | Yes, via `useGetDashboardSummaryQuery` |

`features/dashboard/` previously held only the Home-tab wrapper while the real summary screen
lived under `features/reports/` — a naming mismatch fixed on 2026-09-22 by swapping the two
directories (`features/dashboard` → `features/home`, `features/reports` → `features/dashboard`,
`ReportScreen` → `DashboardScreen`) and renaming the tab label and `reports.*` i18n namespace to
match. The tab bar order is now Home | Account | Planning | **Dashboard** | Settings.

## Server: `DashboardService.summary()`

`server/src/dashboard/dashboard.service.ts`. One `VIEWER`-gated method, five queries run via
`Promise.all`:

1. **`totalBalance`** — delegates to `BalanceService.walletBalances()` (BR-05: derived from
   transactions on every read, never cached).
2. **`periodActivity`** — one pass over the period's `COMPLETED` rows producing income/expense,
   their per-category and per-member splits, and the wallet's transfer flow. Transfers stay
   **excluded from income/expense entirely** (BR-06 — the single most consequential rule this
   endpoint has to get right) and are reported as their own `transferredIn`/`transferredOut`
   figures instead; a transfer between two of the wallet's *own* accounts counts in neither,
   since it never crossed the wallet boundary. The BR-06 predicate itself
   (`countsAsPeriodActivity`) and the direction rule (`transferDirection`) live in
   `@sora/contracts`, shared with the guest-mode mirror rather than written twice.
3. **`recentTransactions`** — last 10, newest first.
4. **`activeBudgets`** — every `ACTIVE` budget in the wallet, each with `spent`/`remaining`/usage
   recomputed from its category's transactions.
5. **`activeGoals`** — every `ACTIVE` goal, each with `currentAmount`/progress recomputed from its
   contributions.

Plus, only when the request supplies `displayCurrency`: a sixth call to
`ExchangeRateService.calculateValuation()`, producing the optional `valuation` field (see below).

Every one of these is computed fresh per request — there is no dashboard-specific cache or
materialized view. The date window (`dateFrom`/`dateTo`) defaults to the current calendar month
when omitted (`resolvePeriod`), and is applied **in JavaScript** via `isWithinPeriod`, not as a
SQL `WHERE` clause — see Known Issues.

`spendingByCategory` reports one `amount`/`percentage` pair per category, not one per currency:
it scopes to whichever currency accounts for the most expense in the period (`dominant`), so a
wallet whose expenses genuinely span more than one currency gets an honest single-currency
breakdown rather than a silently-summed, meaningless number (BR-07). Each slice also carries its
category's `parentId`, so the app can roll the breakdown up one level without a second call to
`/categories`.

`spendingByMember` splits the same income/expense figures by `transactions.created_by_user_id`
— "who recorded this" is also "whose spending was it" on a shared wallet. It is filtered by the
same predicate as the wallet-level totals, so the split always reconciles against them, and it
exposes nothing new: any `VIEWER` can already read every transaction's `createdBy` via §11.1.

## Mobile consumption

- **`mobile/src/app/store/api/dashboardApi.ts`** — one RTK Query endpoint, `getDashboardSummary`,
  following the same guest/offline-fallback shape every other api slice in this app uses: guest
  mode or an already-known-offline session routes straight to `guestDashboardApi.summary()`
  (`mobile/src/services/guest/guestDashboard.ts` — a from-scratch reimplementation of the same
  math against the local guest store, not a call to the real endpoint); a real request that fails
  with a network error falls back the same way and flips the app into offline mode for subsequent
  calls.
- **`DashboardScreen.tsx`** — three tabs on a `SegmentedControl`, as Planning has: **Overview**
  (`IncomeExpenseSummary`, budget/goal preview, insights), **Spending** (category breakdown, member
  split) and **Accounts** (`AccountsOverview`: net worth and the account list, period-independent,
  so the period bar hides there). Five period granularities (day/week/month/quarter/year), with two
  call patterns: `PeriodReport` fetches the selected window plus the one before it (two direct
  hook calls) for the change-vs-previous indicators and the "insights" lines, and renders the
  Overview or Spending tab from that one response — Spending in the yearly view too, over the
  whole year's window; Overview's yearly view is `YearlyReport`, which fetches all 12 months via `MonthDataPoint`, one query
  component per month so hook-call count stays stable across a fixed-length list. Handles
  loading/error/empty per screen convention (MB-07); a month whose query errors still settles as
  a zero point in the trend rather than spinning forever. "Empty" is three distinct states
  (`emptyReasonFor` in `dashboardAnalytics.ts`) — no accounts, nothing ever recorded, or a window
  that happens to be empty — since each needs a different next step rather than one blank panel. The window arithmetic itself lives in
  `mobile/src/utils/dashboardPeriod.ts` and the ranking/grouping math in
  `dashboardAnalytics.ts`, both unit-tested — the screen is a `.tsx` file this repo's
  `node --test` runner cannot load, so anything worth testing lives outside it.
- Nothing else in the mobile app currently calls this endpoint.

## Multi-currency / exchange-rate integration

`valuation` is the one place this endpoint touches an external system. When `displayCurrency` is
requested, `ExchangeRateService` (`server/src/exchange-rate/`) attempts, in order: a live fetch
from `open.er-api.com` (12h in-memory cache) → an expired in-memory cache entry → the most recent
`exchange_rate_snapshots` row for that base currency. The response's `valuation.status` is
`FRESH`/`STALE`/`UNAVAILABLE` accordingly; an `UNAVAILABLE` valuation returns `amount: null` and
lists `missingCurrencies` rather than silently omitting a currency from the total. This value is
never stored, never summed into `totalBalance`/budget/goal figures, and a request with no
`displayCurrency` omits the field entirely (never sends `null`) — see
[exchange-rate-resilience-plan.md](exchange-rate-resilience-plan.md) and
[multi-currency-plan.md](multi-currency-plan.md) for the design reasoning behind this shape.

## Known issues (still open)

From [verifications/2026-09-21-infra-audit.md](../../verifications/2026-09-21-infra-audit.md)
(Tier 2, not yet fixed — the user explicitly chose "Tier 1 quick wins only" for that pass, so this
was deliberately left open, not missed):

- **Unbounded transaction-history scans.** `periodActivity` fetches *every* completed
  transaction ever recorded against the wallet's accounts, then filters to the requested date
  window in JavaScript (`isWithinPeriod`) rather than in SQL. **This got wider on 2026-09-22**:
  the query used to exclude `TRANSFER` rows in SQL and now has to read them too, for the
  `transferredIn`/`transferredOut` figures. Same unbounded shape, a larger row set. `activeBudgets`' expense lookup does
  the same for every `EXPENSE` transaction against the budgeted categories, unbounded by date at
  the SQL layer at all. Both scale with the wallet's total transaction count, not with the size of
  the requested period — a wallet with years of history pays the same query cost for "this month"
  as for "all time." Not currently a correctness bug (the JS-side filtering is correct), a
  performance one that gets worse the longer an account has been in use.

## Related documents

- [docs/API_SPECIFICATION.md §14.1](../../docs/API_SPECIFICATION.md#141-get-dashboard) — the authoritative request/response contract.
- [verifications/2026-09-21-infra-audit.md](../../verifications/2026-09-21-infra-audit.md) — source of the unbounded-scan finding.
- [exchange-rate-resilience-plan.md](exchange-rate-resilience-plan.md), [multi-currency-plan.md](multi-currency-plan.md) — design rationale for `valuation`.
- [dashboard-feature-roadmap.md](dashboard-feature-roadmap.md) — triaged brainstorm of what could be added on top of this.
