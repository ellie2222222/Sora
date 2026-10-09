# Dashboard Feature Roadmap

A brainstorm (pasted by the user, 2026-09-22) of what a "full finance command center"
dashboard could include, triaged against **this repo's actual current schema, contracts,
and SRS.md §1.6 (Out of Scope)** — not a spec, not a commitment. See
[dashboard-current-state.md](dashboard-current-state.md) for what
`DashboardScreen`/`DashboardService.summary()` actually do today.

> **Status (2026-09-22): Phases 0-6 of the Tier A breakdown below are built.** Tier B and
> Tier C remain untouched and still need what each says it needs — a migration, or a
> product decision to amend SRS.md §1.6. See
> [verifications/2026-09-22-dashboard-tier-a-phases.md](../../verifications/2026-09-22-dashboard-tier-a-phases.md)
> for what was verified and what was deliberately left out.

**Do not build this end-to-end from this document alone.** It spans three very different
kinds of work — UI-only additions, new columns/queries on existing entities, and net-new
entities/scope reversals — and several items directly conflict with decisions already
recorded in [SRS.md §1.6](../../SRS.md#16-out-of-scope). Pick a tier/section to implement
next; each one needs its own plan and SRS/API-spec update before code, per this repo's
spec-driven-development rule.

## How to read the tiers

| Tier | Meaning | Before building |
|---|---|---|
| **A — buildable now** | Derivable from data the schema already captures (transactions, accounts, categories, budgets, goals, wallet members). Mostly query + UI work. | Normal feature work: SRS user story, API spec section, contract types, tests. |
| **B — needs a schema addition** | Requires a new column, enum value, or entity that doesn't conflict with any documented scope decision (e.g. a `merchant` field, a `payment_method` field, a `tags` table). | A migration + contract change + SRS §2/§4 update, same as any new field — no scope reversal needed. |
| **C — conflicts with SRS §1.6** | The SRS already lists this as deliberately deferred, with a reason. Building it means *amending the spec*, not just writing code — a product decision, not an implementation one. | Explicit go-ahead to reopen that SRS line, then amend SRS.md §1.6 in the same change that adds the feature. |

## Tier A — buildable now

No new entities, columns, or migrations — everything needed is already captured by
`transactions`, `accounts`, `categories`, `budgets`, `goals`, `wallet_members`. Most items are
pure aggregation-query and UI work; a few (marked below) need a small new field on
`DashboardResponse`/`CategorySpendSlice` and the server query that fills it — still no schema
change, but not zero backend touch either. See the phased breakdown below for which is which.

| # | Feature | Note |
|---|---|---|
| 2 | Core KPI cards (balance, income, expense, net, savings, savings rate, available balance) | Already computed in `DashboardResponse`; savings rate is client-side math in `IncomeExpenseSummary` today |
| 3 | Cash flow chart at day/week/quarter granularity | Today only supports monthly/yearly (`DashboardScreen`'s `Period` type) |
| 4 | Category ranking, trends, top N, change detection | `spendingByCategory` + historical queries; "biggest expense changed by X%" already exists in `buildMonthlyInsights` |
| 5 | Income trends, consistency (avg/median/high/low/volatility) | Pure math over existing income transactions; "income source" breakdown works via category today, a dedicated source field is Tier B |
| 6 | Spending trend (daily/weekly/monthly averages, growth rate) | Pure aggregation |
| 7 | Budget dashboard (overall + by-category + status) | `DashboardScreen`'s own query already returns `activeBudgets` in full (`spent`/`remaining`/`usagePercentage`) — it's fetched every render and simply not rendered. Cheapest item on this whole list. The "forecast" sub-item is **Tier C**, see below |
| 8 | Savings analytics (rate, trend, best/worst month, consistency) | Pure math over income/expense |
| 9 (partial) | Net worth using existing `Account.balance` (incl. negative `CREDIT_CARD` balances as liabilities) | A distinct Asset/Investment/Loan entity is Tier B — see below |
| 10 | Account analytics (balances, activity, history, comparison) | All derivable from existing accounts/transactions |
| 11 | Transaction analytics (count, size, frequency, timeline) | Pure aggregation |
| 15 | Goals dashboard (progress, contribution rate, required monthly, remaining) | Same as §7 — `activeGoals` is already in `DashboardScreen`'s own response, unused today. "Estimated completion date" is a simple linear projection, not the forecasting SRS defers — judgment call, flag before building |
| 16 (partial) | Financial health ratios (savings rate, expense ratio, cash runway) | Pure math; "fixed-cost ratio" needs Tier B category classification |
| 17 | Cash runway (liquid balance ÷ avg monthly expense) | Simple ratio, not the "forecasting" SRS excludes |
| 22 | Transfer analytics (transferred-in/out totals, volume) | BR-06 already excludes transfers from income/expense; a dedicated `transferredIn`/`transferredOut` pair isn't in `DashboardResponse` yet — needs adding |
| 23 | Currency analytics (per-currency breakdown, valuation) | Largely already built (`totalBalance` is per-currency, `valuation` exists) |
| 24 | Shared wallet member contribution/spending | `transactions.created_by_user_id` already exists and is already selected in `recentTransactions`, but `periodActivity`'s income/expense aggregation sums by currency only, not by member — needs a genuine new server aggregation and a new `DashboardResponse` field (e.g. `spendingByMember`), not just a column |
| 25 | Category analytics (total/%/avg/count/trend/variance) | All derivable from `spendingByCategory` + historical queries |
| 25 (hierarchy) | Grouping the dashboard's category breakdown by parent/child | `categories.parent_id`/`CategoryResponse.parentId` exist end-to-end, but `CategorySpendSlice` (the dashboard's own per-category shape) does **not** carry `parentId` — needs a one-field addition to the contract + the `spendingByCategory` SQL query, not a migration. Smaller than Tier B, but not zero-touch either |
| 29 (partial) | Deterministic insights ("X was your biggest expense") | Already exists (`buildMonthlyInsights`); statistical anomaly detection is **Tier C** |
| 32 | Comparison analytics (period vs period, YoY, actual vs budget) | Month-over-month already partially exists; extending to YoY/category-vs-category is aggregation work |
| 33–34 | New chart types on existing data (stacked bar, waterfall, sparkline) | Frontend-only once §22's transfer figures are exposed |
| 35 | Financial calendar view | Existing `transactionDate` is enough; no screen exists yet |
| 36 (partial) | "Duplicate transaction" quick-create | UI shortcut only; "split transaction" is Tier B/C, see below |
| 37 | Quick actions (add expense/income/transfer, contribution, budget) | Already substantially built via `ModalProvider`/FAB; "scan receipt" is **Tier C** |
| 38 (partial) | Filter by date/account/wallet/category/type/amount | Partly built: the Home tab filters by account (chips, plus a sheet past three accounts), by type, and by a category opened from the dashboard (`MainTabParamList.Home: { walletId; accountId?; categoryId? }`); there is no amount or date-range filter yet. Building one is aggregation/UI work, no schema change — genuinely Tier A, just not "mostly done" |
| 39 | Sync/data-quality status | **Already done, not a task.** `ConnectionSyncStatus` (offline / server connected / server unreachable + syncing/pending/failed + pending count + retry) already renders inside `WalletContextBar`, which `DashboardScreen` already wraps its content in |
| 40 | Dashboard customization (widget picker, hide balances, default period/wallet) | Pure mobile-side preference storage, no backend |

## Implementation breakdown (Tier A, phased)

Tier A is still 20+ items — too much for one change. This groups it into independently
shippable phases, ordered by effort (cheapest first) rather than by the roadmap's numbering,
and separates **mobile-only** phases (no server/contract touch, so no `check-contract-parity.mjs`
risk) from phases that need a small, additive `DashboardResponse`/`CategorySpendSlice` field.
Each phase follows this repo's normal workflow — [SRS.md](../../SRS.md) user story →
[docs/API_SPECIFICATION.md](../../docs/API_SPECIFICATION.md) section → `@sora/contracts` types →
service → RTK Query hook → screen → tests — not a shortcut around it. None of this is scheduled;
it's here so picking a phase in the future doesn't require re-deriving these steps.

### Phase 0 (built) — Render what `DashboardScreen` already fetches (§7, §15)

**Mobile-only.** `DashboardResponse.activeBudgets`/`.activeGoals` are already in the object
`useGetDashboardSummaryQuery` returns on this exact screen; nothing renders them today.

1. Add `BudgetSummaryCard`/`GoalSummaryCard` (or one combined widget) under
   `mobile/src/features/dashboard/screens/DashboardScreen.tsx` — reuse the existing shared
   `ProgressBar` component (`<ProgressBar percentage={...} danger={...} />`, already driving
   `BudgetDetailScreen.tsx:83` off `usagePercentage`/`isOverBudget`, and `GoalDetailScreen.tsx`'s
   equivalent off `progressPercentage`) rather than re-deriving the bar; don't force a bigger
   shared card component between the two if their layouts actually diverge.
2. Wire tap-through: a budget/goal card navigates to `BudgetDetail`/`GoalDetail`
   (`AppStackParamList` already has both routes).
3. Empty state: `activeBudgets`/`activeGoals` can legitimately be `[]` — render nothing or a
   "no active budgets" prompt per MB-07, not a blank gap.
4. Tests: a component test asserting the cards render from a fixture `DashboardResponse` and
   are absent when the arrays are empty.
5. Docs: none needed — no contract or endpoint change, `docs/API_SPECIFICATION.md` §14.1 already
   documents these fields.
6. Verify: `npx tsc --noEmit -p mobile/tsconfig.json`, `npm run test -w mobile`. No
   `check-contract-parity.mjs` run needed — nothing it checks changed.

### Phase 1 (built) — Period granularity: day/week/quarter (§3, §6)

**Mobile-only.** `dashboardQuerySchema.dateFrom`/`dateTo` are already free-form ISO dates
(`packages/contracts/src/schemas.ts:391-396`) — the server places no monthly/yearly assumption
on them. Today's `daily`/`weekly`/`quarterly` gap is entirely in what the mobile app *asks for*.

1. Add `startOfWeek`/`endOfWeek`/`startOfQuarter`/`endOfQuarter`/`startOfDay`/`endOfDay` to
   `mobile/src/utils/date.ts`, matching the existing `startOfMonth`/`endOfMonth` shape. `date.ts`
   has no test file today (confirmed — no `date.test.ts` exists, nothing else tests it); add one
   using the plain `node --test` style `calculatorEngine.test.ts` already establishes, covering
   both the new functions and, ideally, the existing untested ones while touching the file.
2. Extend `DashboardScreen.tsx`'s `Period` type from `'monthly' | 'yearly'` to include
   `'daily' | 'weekly' | 'quarterly'`; extend the period-selector `Button` row.
3. Reuse the existing `useGetDashboardSummaryQuery({ walletId, dateFrom, dateTo })` call with the
   new windows — no new hook needed, `MonthlyReport`'s shape already generalizes.
4. Verify: `npm run test -w mobile`, plus a manual check that switching periods doesn't break the
   existing monthly/yearly views (regression, not just the new ones).

### Phase 2 (built) — Category ranking, trends, top N (§4)

**Mobile-only**, reusing the existing two-period-fetch pattern `MonthlyReport` already uses for
month-over-month insights (`current`/`previous` queries).

1. Fetch the comparison period (previous week/month/quarter/year, matching Phase 1's granularity)
   the same way `buildMonthlyInsights` already does.
2. Compute ranking/top-N/% change client-side from the two `spendingByCategory` arrays — no new
   server work, this is the same shape `buildMonthlyInsights` already consumes.
3. Add a "Top categories" list view (reuse `CategoryLegendRow`'s pattern) with a change-vs-prior
   indicator per row.
4. Verify: `npm run test -w mobile` (add cases for the ranking/% change helper function).

### Phase 3 (built) — Category-hierarchy-aware grouping (§25, hierarchy sub-item)

**Contract + server + mobile**, small. This is the one part of §25 that isn't already exposed by
the dashboard endpoint.

1. `packages/contracts/src/responses.ts` — add `parentId: string | null` to `CategorySpendSlice`.
2. `server/src/dashboard/dashboard.service.ts`'s `spendingByCategory()` — select `parent_id` in
   the existing `categories` lookup (already queries `id, name, icon, color`; one more column)
   and thread it into the returned slice.
3. `docs/API_SPECIFICATION.md` §14.1 — document the new field on `CategorySpendSlice`.
4. `node scripts/check-contract-parity.mjs` — run after the contract change (response-shape
   changes aren't part of what it checks today, but confirm nothing it does check regressed).
5. Mobile: group `spendingByCategory` by `parentId` before rendering the donut/legend, same
   pattern the existing flat list uses today, one level of grouping added.
6. Tests: `server/test` — a fixture asserting a child category's slice carries its parent's id;
   `calculatorEngine`-style unit test for the mobile grouping helper.

### Phase 4 (built) — Transfer analytics (§22, needed by §33-34's waterfall chart too)

**Contract + server + mobile**, small, and a prerequisite for the waterfall chart (Phase 6).

1. `packages/contracts/src/responses.ts` — add `transferredIn`/`transferredOut: CurrencyTotal[]`
   to `DashboardResponse` (same shape `income`/`expense`/`net` already use).
2. `server/src/dashboard/dashboard.service.ts`'s `periodActivity()` — currently filters
   `type IN (INCOME, EXPENSE)` only (line ~132); add a second aggregation over `TRANSFER` rows
   within the same account set, split by whether the wallet's own accounts are the `to_account_id`
   (in) or `from_account_id` (out) side — BR-06 still applies, this is a *separate* figure, never
   folded into `income`/`expense`/`net`.
3. `docs/API_SPECIFICATION.md` §14.1 — document the two new fields.
4. Mobile: render alongside the existing KPI row; this is also what unblocks a waterfall chart
   (`starting → +income → −expense → ±transfers → ending`) without inventing a client-side
   transfer computation that could drift from BR-06.
5. Tests: server-side fixture with a cross-wallet transfer, asserting it lands in
   `transferredIn`/`Out` and *not* in `income`/`expense`/`net` — this is the one place BR-06
   regressions are most likely, so the test should be adversarial, not just a happy path.

### Phase 5 (built) — Shared wallet member contribution/spending (§24)

**Contract + server + mobile**, the largest Tier A phase — genuine new aggregation logic, not a
field rename.

1. `packages/contracts/src/responses.ts` — new `MemberSpendSlice { userId, displayName, income:
   CurrencyTotal[], expense: CurrencyTotal[] }[]` field on `DashboardResponse` (name TBD against
   `docs/API_SPECIFICATION.md`'s existing conventions before committing to it).
2. `server/src/dashboard/dashboard.service.ts`'s `periodActivity()` — group by
   `created_by_user_id` in addition to currency; needs a `users` join for `display_name` (the
   query doesn't currently join `users` — `recentTransactions()` does, `periodActivity()`
   doesn't).
3. Access check: confirm this doesn't leak a `VIEWER`-role member's identity/spend to someone who
   shouldn't see it — per AC-02/AC-03, if wallet-level `VIEWER` access already permits seeing all
   transactions (it does, per the existing role table), member-level attribution is not a new
   information leak, but confirm before shipping rather than assuming.
4. Mobile: a "who spent what" widget on `DashboardScreen`, gated to wallets with more than one
   active member (skip rendering for a solo wallet — an empty/trivial "1 member: you, 100%" row
   is noise).
5. Tests: server fixture with two members creating transactions on the same wallet, asserting the
   split adds up to the wallet-level `income`/`expense` totals (a reconciliation check, not just
   presence).

### Phase 6 (built, except §35) — Chart types on top of Phases 0-5's data (§33-34, §35)

> Built: the stacked/label-less variants of `TrendBarChart` (a `variant` prop, not a second component).
> The waterfall chart was built and later replaced by `IncomeExpenseSummary`: income and expenses on one
> shared scale, each with the previous period beneath, then the net they come to.
> **Not built: the financial calendar view (§35).** It shares no data or component surface with
> the rest of this phase — it is a whole new screen and route, and belongs in its own phase.

**Mobile-only**, deliberately last — depends on Phase 4's transfer figures for the waterfall
chart specifically, and is otherwise pure frontend work against data already flowing by this
point.

1. Waterfall chart component (starting balance → income → expense → transfers → ending) —
   needs Phase 4 shipped first, uses `totalBalance` + the new transfer figures.
2. Stacked bar / sparkline variants of `TrendBarChart`/`DonutChart` — check whether the existing
   chart components can take a `variant` prop before writing new ones from scratch (this repo's
   "reuse existing abstractions" rule).
3. Financial calendar view (§35) — new screen, `transactionDate` is already enough data; no
   dependency on the earlier phases.
4. Tests: chart components render from a fixed data fixture without crashing on an empty array
   (every chart here has a legitimate zero-data case — a new wallet, a period with no activity).

### Not phased here

§5 (income trends), §8 (savings analytics), §9-partial (net worth from account balances), §10-11
(account/transaction analytics), §16-17 (financial health/cash runway), §32 (comparison
analytics), §38 (filter UI), §40 (dashboard customization) are all real Tier A work but don't
share enough backend surface with Phases 0-6 to batch naturally — each would get its own
single-phase breakdown the same way, once actually scheduled.

## Tier B — needs a schema/contract addition (no scope conflict)

| # | Feature | What's needed |
|---|---|---|
| 1 (partial) | Filter by tag, merchant, payment method | Each needs its own field/entity below |
| 9 (full) | Net worth with distinct Asset/Investment/Liability entities (beyond account balance) | New entity or `AccountType` extension |
| 12 | Merchant analytics | A `merchant` field on `Transaction` |
| 20 | Fixed vs. variable expense split | A classification attribute on `Category` or `Transaction` |
| 21 | Essential vs. discretionary split | Same — a new classification attribute |
| 26 | Tags / custom dimensions | A new `tags` table + join table |
| 27 | Payment method analytics | A `payment_method` field on `Transaction` |
| 28 | Location analytics | A `location` field on `Transaction` |
| 36 (split transaction) | Splitting one transaction across categories | Needs its own design, not just a column: one transaction would carry several categories and amounts |

## Tier C — conflicts with an explicit SRS §1.6 decision

Building any of these means amending `SRS.md` §1.6 in the same change, with a reason — not
silently reversing it.

| # | Feature | SRS §1.6 line it reopens |
|---|---|---|
| 7 (forecast sub-item) | "At current spending rate you'll spend ~$X this month" | "Automated analysis, forecasting, categorisation suggestions — needs history the product does not yet have" |
| 13 | Recurring transactions | "Bills and recurring-payment reminders" |
| 14 | Subscription analytics | Same — subscriptions are recurring transactions |
| 18 | Financial forecasting (income/expense/balance projections) | "Automated analysis, forecasting..." |
| 29 (anomaly detection) | Unusual transaction / duplicate / anomaly flags | Same |
| 30 | Alerts & notifications | "Notifications (push, email, in-app)" |
| 31 | Reports with CSV/Excel/PDF export | "Export (CSV / PDF), report generation" |
| 37 (scan receipt) | Receipt capture | "Receipt capture and OCR — depends on file storage, which v1 does not have" |

## Not triaged individually

- **§41 (recommended layout hierarchy)** — a design suggestion for how to arrange whichever
  widgets end up getting built, not a feature itself. Worth revisiting once a Tier A phase
  is actually scoped, so the layout is designed around real widgets instead of speculative
  ones.
- **§33 (chart type inventory)** — a reference list, not a triage item; charts get tiered
  by the data they need, not by chart type itself.

## Suggested next step

Phases 0-6 are done (§35's calendar view excepted). The cheapest remaining Tier A work is in
**Not phased here** above — §5/§8/§16-17 are pure client-side math over figures the endpoint
already returns, so they need no contract or server change at all; §38's filter UI and §40's
customization are the larger mobile-only pieces.

Anything in **Tier B** needs a migration first, and anything in **Tier C** needs a product
decision to reopen an [SRS.md §1.6](../../SRS.md#16-out-of-scope) line before code — neither is
a "just build it" item, and neither was touched by the Phase 0-6 work.
