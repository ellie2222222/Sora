# Plan: Dashboard & Reports (DASH-US)

> **Feature:** SRS §7 DASH-US
> **Spec:** [spec.md](spec.md)
> **SDS:** [§4.10 Dashboard & Reports](../../SDS.md), [§6.1 API Index](../../SDS.md)
> **Status:** DASH-US-01 implemented. DASH-US-02 (reports) and DASH-US-03 (search) not started

---

## Pre-flight: Spec Review Findings

Reviewed `spec.md` against `dashboard_service.py` and the dashboard UI.

| ID | Type | AC | Finding | Resolution |
|----|------|----|---------|------------|
| G1 | **Gap** | AC-14 | The recent-transactions panel was hardcoded to an empty array — it never fetched anything — and its outflow test compared against title-case type names while the API returns upper case, so every amount would have rendered as an inflow | Resolved: the dashboard loads the transaction list alongside the summary; the type union now matches the API |
| G2 | **Gap** | AC-05 | Per-account reported balance was computed as `current balance × the account's opening rate`, which disagrees with the headline total for any workspace whose rates have moved | Resolved: per-account balance is now `opening reported balance + the signed sum of that account's movements`, and the headline total is the same construction summed, so the two agree by definition |
| G3 | **Gap** | AC-08 | Per-account movement could not include transfers, because a transfer leg's direction was not stored | Resolved in [004](../004-transaction-management/plan.md) by adding a direction column; this feature consumes it |
| G4 | **Gap** | AC-02/03 | Only four flat metrics existed: total balance, monthly income, monthly expense, cash flow. No all-time, no daily, no per-account, no series | Resolved: four grains plus two series |
| G5 | **Gap** | AC-10 | A series built only from rows present would omit quiet periods | Resolved: the window is generated first and filled from the data |
| A1 | Ambiguity | AC-02 | Archived accounts: are they inside or outside the totals? | Resolved: inside. Their transactions are already counted, so excluding their opening balance would make the total disagree with its own rows |
| A2 | Ambiguity | AC-09 | Window lengths unspecified | Resolved: 6 months and 30 days, both configurable in one constant each |
| A3 | Ambiguity | AC-13 | Which metrics are "unavailable" rather than zero | Resolved: net worth (needs asset/liability classification) and savings progress (needs saving goals) |

---

## Architecture

```text
backend/app/
├── api/routes.py                        # GET /workspaces/{id}/dashboard
├── services/dashboard_service.py        # DashboardService.get_summary — all aggregation
└── models/__init__.py                   # Reads Transaction and Account only

frontend/src/app/app/workspaces/[id]/dashboard/
├── page.tsx                             # Loads summary + recent transactions, maps to the read model
└── _components/
    ├── metric-card.tsx                  # Position tiles
    ├── flow-stats-card.tsx              # Income / expense / net for one period
    ├── flow-trend.tsx                   # Monthly and daily bars, no charting dependency
    ├── account-breakdown.tsx            # Per-account table
    ├── recent-transactions.tsx          # Latest rows
    ├── budget-progress.tsx              # Empty until budgets exist
    ├── upcoming-bills.tsx               # Empty until bills exist
    └── quick-actions.tsx
```

**Read model** (`types/dashboard.ts`): `FlowStats`, `FlowPoint`, `AccountStats`, `DashboardSummary`.

---

## Aggregation design

Three grouped queries cover every figure. Nothing is queried per account or per day.

| # | Query | Feeds |
|---|---|---|
| 1 | `SUM(base_amount)` grouped by `type` | All-time income, expense, net |
| 2 | `SUM(base_amount)` grouped by `(account_id, type, direction)` | Per-account flows, and the signed per-account movement used for reported balance |
| 3 | `SUM(base_amount)` grouped by `(date, type)`, restricted to the series window | Both series, plus this month and today, folded in the service |

Design notes:

- **`base_amount`, never `amount`.** `base_amount` is the generated column `amount × exchange_rate` — the amount already converted at the rate stored when the row was written. Summing raw `amount` across currencies would be meaningless, and re-converting at a current rate would restate history (BR-07a).
- **Windowing over grouping in SQL.** Month and day buckets are folded in Python from the windowed rows rather than with `date_trunc`, keeping the query engine-agnostic and the window bounded.
- **`TRANSFER` excluded from flow buckets, included in movement.** The flow buckets skip it (a transfer changes no workspace position); the signed movement includes it via `direction`, so each account's own balance is right.
- **Series are generated then filled.** The window is produced first — six month starts, thirty dates — and populated from the grouped data, so an empty period is a zero row rather than a missing one.
- **Archived accounts are included** (A1), which is what makes the parts sum to the whole.

---

## Business rules and where they are enforced

| Rule | Source | Enforcement |
|---|---|---|
| Membership required | — | `require_membership` before any read → 403 |
| Everything in the reporting currency | FR-001/002 | Only `base_amount` and `opening_base_balance` are summed |
| Income, expense, net together | FR-003 | `_Bucket.as_dict()` always emits all three |
| Four grains | FR-004 | `all_time`, `month`, `today`, `accounts` |
| Position from opening plus movement | FR-005 | `total_balance = Σ opening_base_balance + Σ signed movement` |
| Parts sum to the whole | FR-006 | Both figures use the same construction |
| Transfers out of flows, into accounts | FR-008/009 | `_Bucket.add` ignores `TRANSFER`; movement uses `direction` |
| Zero-filled series | FR-011 | Window generated before filling |
| Cancelled excluded | FR-012 | Every query filters `status = 'recorded'` |
| Unavailable is not zero | FR-013 | Null in the read model; the tile renders an em dash |

---

## Frontend

- **Position row** — total balance, cash flow, net worth, savings progress. Unavailable metrics render as an em dash, never as `0`.
- **Three flow cards** — all time, this month, today — each showing income, expense and net side by side, because any one alone is misleading.
- **Trend** — plain flexbox bars, one green and one red per period, scaled to the largest figure on show, with the exact figures in a tooltip. No charting library: two bars per period does not justify a dependency.
- **Account table** — balance in the account's own currency with the reported equivalent beneath, then income, expense and net in the reporting currency.
- **Readability** — every figure uses tabular numerals so columns align; metric tiles carry the full value as a title attribute because a large reported figure can outgrow its tile.

---

## Sequence — DASH-US-01

```mermaid
sequenceDiagram
    actor Member
    participant Frontend
    participant Controller
    participant Service
    participant Repository

    Member->>Frontend: Open the dashboard
    par Summary and recent activity load together
        Frontend->>Controller: Request the summary
        Controller->>Service: Delegate
        Service->>Repository: Confirm membership
        Service->>Repository: Totals grouped by type
        Service->>Repository: Totals grouped by account, type and direction
        Service->>Repository: Totals grouped by date within the window
        Service->>Repository: Accounts of the workspace
        Service->>Service: Fold month, today and both series; generate empty periods
        Service-->>Controller: Summary
        Controller-->>Frontend: Summary
    and
        Frontend->>Controller: Request recent transactions
        Controller-->>Frontend: Latest rows
    end
    Frontend-->>Member: Position, flows, trend, accounts, recent activity
```

---

## Tasks

| # | Task | Status |
|---|---|---|
| T1 | Summary endpoint with four grains and two series | Done |
| T2 | Three grouped queries; no per-row or per-account loops | Done |
| T3 | Per-account reported balance that sums to the headline total | Done |
| T4 | Transfers excluded from flows, included in per-account movement | Done |
| T5 | Zero-filled monthly and daily series | Done |
| T6 | Flow cards, trend, account table | Done |
| T7 | Recent transactions actually fetched | Done |
| T8 | Tabular numerals and non-clipping figures | Done |
| T9 | Category breakdown (pie), top spending categories, year-over-year | **Not started — stated in the SRS** |
| T10 | Budget progress and upcoming bills panels | **Blocked on features 005 and 008, neither yet specified** |
| T11 | Net worth — needs asset/liability classification on accounts | Not started |
| T12 | Savings progress — needs feature 006, not yet specified | Not started |
| T13 | Reports with export (DASH-US-02) | Not started |
| T14 | Transaction search (DASH-US-03) | Not started |
| T15 | Date-range, account and member filters | Not started |
| T16 | Integration tests: parts-sum-to-whole, transfer neutrality, zero-fill | **Blocked — see R1** |

---

## Open Risks

- **R1 — The backend test suite does not run**, so the invariant that matters most here (SC-001, the parts summing to the whole) is unverified by any automated check. It was reasoned from the construction, not observed.
- **R2 — Performance is unmeasured.** SC-006 claims two seconds at 10,000 transactions; no benchmark has been run. The three queries are indexed by `(workspace_id, date, status)` and `(account_id, direction, status)`, which is why the claim is plausible.
- **R3 — Cross-currency transfer rounding** means SC-001 needs its one-minor-unit tolerance; the two legs of a converted transfer need not cancel to the cent.
- **R4 — Changing the reporting currency restates history at today's rate** for rows in the other currency, so figures for past months can move after such a change. See [010](../010-multi-currency/plan.md).
- **R5 — The SRS still lists charts that do not exist** (expense pie, income pie, top categories, monthly comparison). The spec marks them out of the current scope; the SRS should not be read as a description of what is built.
