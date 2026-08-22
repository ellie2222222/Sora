# Feature Specification: Multi-currency reporting (cross-cutting)

> **Feature:** Cross-cutting — not an SRS §7 Feature
> **Traceability:** SRS BR-07, BR-07a, FR-10, FR-13a, FR-13b, §1.6
> **Roles:** ALL (change of reporting currency: OWNER)
> **Plan:** [plan.md](plan.md)

---

## Why this is specified separately

Every money feature depends on these rules, and they are heavy enough to be
misread if scattered: two supported currencies, a rate stored on every row, a
reporting currency per workspace, an external rate source, and an operation that
restates the lot. Accounts, transactions, and the dashboard each reference this
document rather than restating it.

---

## User Scenarios & Testing *(mandatory)*

### MC-01: Hold money in a currency other than the one I report in

**As a** workspace member, **I want to** keep an account in a currency my bank actually uses, **so that** its balance matches my statement while my totals still make sense.

### MC-02: Never be asked for an exchange rate

**As a** workspace member, **I want** the system to determine rates itself, **so that** I am not asked for a number I would have to look up and could get wrong.

### MC-03: Trust that history does not move

**As a** workspace member, **I want** past months to keep the figures they had, **so that** a report I read last week still says the same thing today.

### MC-04: Change what currency I am reported in

**As a** workspace OWNER, **I want to** change the currency my figures are reported in, **so that** the dashboard speaks the currency my money is actually in.

---

## Acceptance Criteria

**AC-01 — Only supported currencies exist**
**Given** any currency outside the supported set,
**When** it is submitted anywhere,
**Then** it is refused as unsupported.

**AC-02 — A workspace declares one reporting currency**
**Given** a workspace is created,
**When** its currency is chosen,
**Then** every total, subtotal, series and report for that workspace is expressed in it.

**AC-03 — An account declares the currency its money is in**
**Given** an account is created,
**When** its currency is chosen,
**Then** its balance and opening balance are denominated in that currency, independent of the reporting currency.

**AC-04 — A transaction inherits its account's currency**
**Given** a transaction is recorded,
**When** its currency is determined,
**Then** it is the account's currency, and the member is never asked to choose one.

**AC-05 — A rate is never entered by a person**
**Given** any form that records money,
**When** it is filled in,
**Then** no exchange rate is requested; the member chooses currencies only.

**AC-06 — Matching currencies need no rate at all**
**Given** a row whose currency equals the reporting currency,
**When** its rate is determined,
**Then** it is exactly one, with no lookup and no external call.

**AC-07 — A rate is captured at the moment of recording**
**Given** a row whose currency differs from the reporting currency,
**When** it is recorded,
**Then** the prevailing rate is stored on that row and used for calculation only.

**AC-08 — A stored rate is never revised**
**Given** rates move after a row was recorded,
**When** any figure involving that row is computed,
**Then** the rate stored on the row is used, so the figure does not change.

**AC-09 — A rate that cannot be obtained refuses the write**
**Given** a rate is needed and none can be obtained,
**When** the member submits,
**Then** nothing is recorded, and they are told the rate is unavailable and may retry.

**AC-10 — A brief outage does not stop work**
**Given** the rate source is temporarily unreachable but a recent rate is known,
**When** a rate is needed,
**Then** the recent rate is used and the substitution is recorded in the system's logs.

**AC-11 — A member can see what a foreign amount converts to before committing**
**Given** a member is recording an amount in a currency other than the reporting one,
**When** they enter the amount,
**Then** the rate the system will apply and the resulting reported amount are shown.

**AC-12 — An account's currency cannot be changed**
**Given** an existing account,
**When** a member looks for a way to change its currency,
**Then** none is offered, because the balance, the opening balance and the stored rate are all denominated in it and none of them can be restated.

**AC-13 — Changing the reporting currency is explicit**
**Given** an OWNER wants figures reported in the other currency,
**When** they make the change,
**Then** it is a deliberate, separate action — not a field they can alter while renaming the workspace — and they are warned what it does before it happens.

**AC-14 — Changing the reporting currency restates every stored rate**
**Given** the reporting currency changes,
**When** the change is applied,
**Then** the stored rate on every account and transaction is re-determined against the new currency, in one indivisible operation.

**AC-15 — Switching to the currency the money is already in is exact**
**Given** all rows are held in the currency being switched to,
**When** the change is applied,
**Then** every rate becomes exactly one and no value is approximated.

**AC-16 — Restatement of foreign rows is approximate, and said to be**
**Given** rows held in the other currency,
**When** the reporting currency changes,
**Then** their rates are re-determined at the current rate — the rate that applied on their original date was never recorded — and the member is told this before confirming.

**AC-17 — Only an OWNER may change the reporting currency**
**Given** a MEMBER attempts the change,
**When** the request is processed,
**Then** it is refused as not permitted.

**AC-18 — Rates are readable on their own**
**Given** a client needs to display a conversion,
**When** it asks for the rate between two supported currencies,
**Then** the rate the system would store at that moment is returned, and it is never accepted back as input to a write.

---

### Edge Cases

- **EC-001**: The rate source returns a syntactically valid but wildly wrong rate.
- **EC-002**: The reporting currency is changed twice in quick succession.
- **EC-003**: The rate source is unreachable and no recent rate is known — the first cross-currency write after a restart.
- **EC-004**: A rate is needed for a transaction dated years ago.
- **EC-005**: The reporting currency is changed while another member is recording a transaction.
- **EC-006**: The reciprocal rate needs more precision than the other direction (one unit of the small currency is a tiny fraction of the large one).

---

## Requirements

### Functional Requirements

- **FR-001**: The system MUST support exactly two currencies and refuse all others.
- **FR-002**: The system MUST hold one reporting currency per workspace and express every aggregate in it.
- **FR-003**: The system MUST let an account hold either supported currency, independent of the reporting currency.
- **FR-004**: The system MUST take a transaction's currency from its account.
- **FR-005**: The system MUST NOT accept an exchange rate from any client on any write.
- **FR-006**: The system MUST use exactly one as the rate when a row's currency equals the reporting currency, without any external lookup.
- **FR-007**: The system MUST determine the prevailing rate itself when they differ, and store it on the row.
- **FR-008**: The system MUST compute every aggregate from stored rates, never from a current rate.
- **FR-009**: The system MUST refuse a write, storing nothing, when a needed rate cannot be determined.
- **FR-010**: The system MUST prefer a recently known rate over refusing a write when the rate source is unreachable, and record that it did so.
- **FR-011**: The system MUST expose the current rate for reading so a client can preview a conversion.
- **FR-012**: The system MUST prevent an account's currency from changing.
- **FR-013**: The system MUST allow an OWNER, and only an OWNER, to change the reporting currency.
- **FR-014**: The system MUST make the reporting-currency change a separate operation from other workspace edits.
- **FR-015**: The system MUST re-determine the stored rate on every account and transaction of the workspace when the reporting currency changes, as one indivisible operation.
- **FR-016**: The system MUST use exactly one for rows already held in the new reporting currency.
- **FR-017**: The system MUST warn, before the change is applied, that rows in the other currency are restated at the current rate.
- **FR-018**: The system MUST hold rates with enough precision that both directions are exact to the minor unit of the amounts they convert.

### Key Entities

- **Reporting currency**: The single currency a workspace's figures are expressed in.
- **Snapshot rate**: The rate stored alongside an amount, converting that amount's own currency into the reporting currency at the moment it was recorded. Used for calculation only.
- **Reported amount**: An amount multiplied by its own snapshot rate — the only quantity that may be added across rows.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: No write path anywhere accepts a rate from a client, verified by inspection of every request contract.
- **SC-002**: A rate movement changes no already-recorded figure, verified by recomputing a month's totals before and after a rate change.
- **SC-003**: Switching the reporting currency to the currency all rows are held in produces rates of exactly one for every row.
- **SC-004**: A workspace whose currency equals every account's currency makes no external rate call at all.
- **SC-005**: Both rate directions round-trip an amount to within one minor unit.
- **SC-006**: When no rate can be obtained, no partial row exists — verified by checking that the count of transactions is unchanged after a refused write.

---

## Assumptions

- Two currencies only; a third would change the restatement design, because the reciprocal shortcut no longer covers every pair.
- A historical rate archive is not kept, which is precisely why restating foreign rows is approximate.
- The rate source is a free public one; no contract or availability guarantee is assumed, hence the fallback chain.
- Rate movements between recording and reporting are accepted as normal and are not corrections.
- Members reason in one currency at a time; a per-member display currency is not required.
