# Feature Specification: Dashboard & Reports (DASH-US)

> **Feature:** SRS §7 DASH-US
> **Traceability:** CDM §2.2 (Transaction, Account), BR-07a, Flows §8.8
> **Roles:** ALL (reports: OWNER)
> **Plan:** [plan.md](plan.md)

---

## User Scenarios & Testing *(mandatory)*

### DASH-US-01: View Financial Dashboard

**As a** workspace member, **I want to** see where my money stands and how it has moved, **so that** I understand my financial health without adding anything up myself.

### DASH-US-02: Generate Financial Reports

**As a** workspace OWNER, **I want to** produce and export period reports, **so that** I can analyse and share our finances.

### DASH-US-03: Search Transactions

**As a** workspace member, **I want to** search what has been recorded, **so that** I can find a specific movement.

---

## Acceptance Criteria

**AC-01 — Every figure is in one currency**
**Given** a workspace whose accounts hold more than one currency,
**When** any total, subtotal, or series is shown,
**Then** it is expressed in the workspace reporting currency, with each contributing transaction converted at the rate stored when it was recorded.

**AC-02 — Income, expense and net travel together**
**Given** any period the dashboard reports on,
**When** it renders,
**Then** income, expense, and their net are shown together — a period is never summarised by one figure alone.

**AC-03 — Four grains**
**Given** a member opens the dashboard,
**When** it renders,
**Then** income, expense, and net are available for all recorded history, for the current month, for today, and for each individual account.

**AC-04 — Position versus flow**
**Given** the dashboard shows a total balance,
**When** it is computed,
**Then** it reflects the accounts' opening balances plus every recorded movement — a position, distinct from the flow figures.

**AC-05 — The parts agree with the whole**
**Given** the per-account figures and the headline total balance,
**When** both are shown on the same screen,
**Then** the per-account reported balances sum to the headline total, save for stated rounding.

**AC-06 — Per-account balance in the account's own currency**
**Given** an account whose currency differs from the reporting currency,
**When** its row renders,
**Then** its balance appears in its own currency — the figure a member can check against their bank — with the reported equivalent alongside.

**AC-07 — Transfers do not inflate flows**
**Given** money is moved between two accounts of the same workspace,
**When** income and expense are reported,
**Then** neither side of the transfer is counted, because the workspace's position did not change.

**AC-08 — Transfers still affect the accounts they touch**
**Given** the same transfer,
**When** each account's own figures are reported,
**Then** the source is reduced and the destination increased.

**AC-09 — Trend over time**
**Given** a member wants to see direction of travel,
**When** they view the trend,
**Then** income against expense is shown per month over recent months and per day over recent days, switchable between the two.

**AC-10 — Quiet periods are visible as quiet**
**Given** a month or day in the reported window with no transactions,
**When** the series renders,
**Then** that period appears with zero rather than being omitted, so a gap reads as a gap.

**AC-11 — Cancelled transactions do not count**
**Given** a cancelled transaction,
**When** any figure is computed,
**Then** it contributes nothing.

**AC-12 — An empty workspace says so**
**Given** a workspace with nothing recorded,
**When** the dashboard renders,
**Then** it explains that figures appear once transactions exist, rather than presenting zeros as if they were findings.

**AC-13 — Figures a member cannot yet have are not faked**
**Given** a metric the system cannot compute because the data it needs is not modelled yet,
**When** the dashboard renders,
**Then** that metric is shown as unavailable rather than as zero.

**AC-14 — Recent activity**
**Given** a member opens the dashboard,
**When** it renders,
**Then** the most recent transactions are listed with their date, classification, account, and amount.

**AC-15 — Large figures stay readable**
**Given** a figure long enough to overflow its tile,
**When** it renders,
**Then** digits align across figures and the full value remains obtainable rather than being silently clipped.

**AC-16 — Reports** *(not yet implemented)*
**Given** an OWNER selects a report type and period,
**When** they generate it,
**Then** a summary, a by-category breakdown, and the underlying detail are produced in the reporting currency, exportable.

**AC-17 — Search** *(not yet implemented)*
**Given** a member enters search text,
**When** results return,
**Then** matching transactions are listed with the same filters available as on the transaction list.

---

### Edge Cases

- **EC-001**: The reporting currency is changed after transactions were recorded.
- **EC-002**: An account is archived — its balance and history must still be accounted for.
- **EC-003**: A transaction is dated in the future.
- **EC-004**: All transactions in the window are cancelled.
- **EC-005**: A cross-currency transfer where the two sides round differently.
- **EC-006**: A workspace with a single account and no transactions.

---

## Requirements

### Functional Requirements

- **FR-001**: The system MUST express every reported figure in the workspace reporting currency.
- **FR-002**: The system MUST convert each contributing transaction at the rate stored on that transaction, never at a current rate.
- **FR-003**: The system MUST report income, expense, and net together for every period it summarises.
- **FR-004**: The system MUST report those figures for all history, the current month, today, and each account.
- **FR-005**: The system MUST compute total balance as opening balances plus every recorded movement.
- **FR-006**: The system MUST ensure the per-account reported balances sum to the reported total balance.
- **FR-007**: The system MUST state each account's balance in that account's own currency, with the reported equivalent alongside.
- **FR-008**: The system MUST exclude transfers from workspace income and expense.
- **FR-009**: The system MUST include transfers in the figures of the accounts they touch.
- **FR-010**: The system MUST provide a monthly series over recent months and a daily series over recent days.
- **FR-011**: The system MUST include every period in a series window, zero-filled where there is no activity.
- **FR-012**: The system MUST exclude cancelled transactions from every figure.
- **FR-013**: The system MUST distinguish "no data yet" from "zero".
- **FR-014**: The system MUST list the most recent transactions with date, classification, account, and amount.
- **FR-015**: The system MUST keep long figures readable, with aligned digits and the full value obtainable.
- **FR-016**: The system MUST restrict report generation to an OWNER.

### Key Entities

- **Flow figures**: Income, expense, and net for one grain — a period, a day, or an account — always in the reporting currency.
- **Series point**: One period in a trend, carrying its flow figures and the period it covers.
- **Account summary**: One account's balance in its own currency, its reported equivalent, and its flow figures.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: The sum of per-account reported balances equals the reported total balance, within one minor unit, for every tested workspace.
- **SC-002**: A transfer between two accounts changes no workspace income or expense figure at all.
- **SC-003**: A rate movement after recording changes no historical figure.
- **SC-004**: Every period in a series window is present, verified by count, including empty ones.
- **SC-005**: A cancelled transaction's contribution to every figure is exactly zero.
- **SC-006**: The dashboard renders in under two seconds for a workspace with 10,000 transactions.
- **SC-007**: No figure on the dashboard is silently truncated; the full value is always obtainable.

---

## Assumptions

- Reporting is read-only; the dashboard never writes.
- "Recent months" and "recent days" are bounded windows, not the whole history — the series exist to be drawn.
- Net worth requires assets and liabilities to be distinguished, which the account model does not yet do, so it is reported as unavailable.
- Savings progress requires saving goals, which are not implemented, so it is reported as unavailable.
- Budget and bill panels depend on features not yet built and are empty until then.
- Category-level breakdowns, year-over-year comparison, and export are stated in the SRS but not yet built.
