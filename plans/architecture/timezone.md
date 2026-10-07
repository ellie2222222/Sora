
# Wallet Timezone — Master Implementation Prompt

You are implementing a cross-layer architecture change in an existing finance application.

The goal is to eliminate inconsistent UTC-vs-local calendar-day behavior while preserving the existing `TIMESTAMPTZ` model for moments in time.

Do NOT blindly implement the design below. First inspect the repository, understand the existing architecture, identify all affected code paths, and then implement the smallest coherent change that satisfies the requirements.

---

# 1. Core Architecture Decision

The system must distinguish between:

## A. Moments in time

These represent an actual instant and must remain timezone-independent.

Examples:

- `transaction_date`
- `contribution_date`
- `created_at`
- `updated_at`
- other event timestamps

Database type:

```text
TIMESTAMPTZ
```

These values represent an absolute instant.

Example:

```text
2026-10-31T23:30:00Z
```

The system must NOT introduce a separate persisted "local transaction date" column.

---

## B. Calendar dates

These represent a date without a time.

Examples:

- budget `start_date`
- budget `end_date`
- goal `target_date`

Database type:

```text
DATE
```

These must remain timezone-free calendar dates.

---

## C. Wallet calendar timezone

Introduce a wallet-level IANA timezone.

Example:

```text
Asia/Ho_Chi_Minh
```

This timezone is the authoritative timezone used to interpret calendar days and calendar months for that wallet.

The wallet timezone is NOT the transaction's storage timezone.

It is the timezone used when converting an absolute instant into a wallet calendar date.

---

# 2. Required Wallet Timezone Behavior

Add:

```text
wallets.time_zone
```

using an appropriate database string/text type consistent with the existing schema conventions.

Store an IANA timezone identifier, for example:

```text
Asia/Ho_Chi_Minh
America/Los_Angeles
Asia/Tokyo
Europe/London
```

Do not store:

```text
UTC+7
GMT+7
+07:00
```

Use IANA timezone names because they correctly represent timezone rules and DST where applicable.

---

# 3. Wallet Timezone Source

When creating a wallet:

1. Detect the creator's device timezone.
2. Use it as the initial/default wallet timezone.
3. Allow the creator/owner to confirm or change it.
4. Persist the confirmed timezone on the wallet.

The phone timezone is only a DEFAULT.

It is NOT the authoritative timezone after wallet creation.

Do not use GPS/location permission merely to determine the timezone.

The client should use the device's configured timezone, preferably through the existing platform/runtime APIs.

For JavaScript/React Native environments, investigate whether the existing runtime can use:

```ts
Intl.DateTimeFormat().resolvedOptions().timeZone
```

before introducing a new dependency.

Validate the timezone before persisting it.

---

# 4. Shared Wallet Rule

All members of a shared wallet must use the wallet's timezone for wallet-level calendar calculations.

Do NOT use each member's device timezone for:

- transaction grouping
- daily budgets
- monthly budgets
- dashboard periods
- reports
- "today"
- date-based transaction filtering

Example:

```text
Wallet timezone:
Asia/Ho_Chi_Minh
```

A member currently located in Japan may have:

```text
Asia/Tokyo
```

on their phone.

That must NOT cause the same wallet to calculate different budget totals for different members.

The wallet timezone is authoritative.

---

# 5. Important Example

A transaction is stored as:

```text
2026-10-31T23:30:00Z
```

Wallet timezone:

```text
Asia/Ho_Chi_Minh
```

The transaction's wallet-local time is:

```text
2026-11-01 06:30
```

Therefore the transaction belongs to:

```text
November 1
```

for that wallet.

The stored `TIMESTAMPTZ` must remain unchanged.

Do NOT rewrite the transaction timestamp.

---

# 6. Current Bug To Eliminate

The existing system incorrectly treats UTC as the calendar timezone in several places.

Known examples include:

```ts
new Date(`${dateFrom}T00:00:00.000Z`)
```

in transaction filtering.

The dashboard has similar behavior.

Budget spending has similar behavior.

The current `todayUtc()` behavior also treats UTC as the calendar definition of "today".

The shared calculation logic currently contains behavior equivalent to:

```ts
instant.slice(0, 10)
```

which extracts the UTC date directly from an ISO timestamp.

This is incorrect for wallet calendar calculations.

Example:

```text
Vietnam:
2026-11-01 06:30

UTC:
2026-10-31 23:30
```

The current system incorrectly files this under October 31.

The corrected system must file it under November 1 when the wallet timezone is `Asia/Ho_Chi_Minh`.

---

# 7. Centralize Instant → Wallet Date Conversion

Do NOT scatter timezone conversion logic throughout the application.

Find the existing shared date/calculation utilities and extend/refactor them so there is one clear concept for:

```text
instant + timezone → calendar date
```

Conceptually:

```ts
dayOfInstant(instant, timeZone)
```

or the equivalent naming consistent with the project.

Timezone should be explicit.

Avoid APIs where timezone is silently assumed to be UTC.

For example, prefer:

```ts
dayOfInstant(transactionDate, wallet.timeZone)
```

over:

```ts
dayOfInstant(transactionDate)
```

if the latter silently means UTC.

Likewise, functions that calculate periods, dates, or "today" should receive the relevant timezone explicitly or operate on an object that contains the wallet timezone.

Do not create multiple competing timezone utilities.

---

# 8. Shared Contract / Calculation Requirements

Audit all shared date/calculation functions.

Search for:

```text
slice(0, 10)
toISOString()
new Date(...)
getDate()
getUTCDate()
getMonth()
getUTCMonth()
todayUtc
startOfDay
endOfDay
startOfMonth
endOfMonth
calendar day
date range
```

Do not assume every occurrence is wrong.

Classify each occurrence:

1. Absolute instant operation
2. Calendar-date operation
3. Wallet-local calendar operation
4. Display-only operation
5. Intentionally UTC operation

Only change behavior where the business meaning requires wallet-local calendar semantics.

Avoid unnecessary refactoring.

---

# 9. Server Requirements

Audit every server-side operation that converts or compares transaction timestamps against calendar dates.

At minimum inspect:

- transaction list filters
- dashboard calculations
- budget spending calculations
- daily budget calculations
- monthly budget calculations
- reports
- "today"
- date range filtering
- transaction grouping
- any recurring/periodic calculations
- any API endpoint accepting `dateFrom` / `dateTo`
- any service that compares `TIMESTAMPTZ` against `DATE`

The SQL/database logic should use the wallet timezone when deriving a calendar date.

PostgreSQL supports the required conversion with:

```sql
(transaction_date AT TIME ZONE w.time_zone)::date
```

Use the appropriate existing query/join structure.

Do not blindly duplicate this expression everywhere if the project architecture has a better abstraction.

The important requirement is that all wallet calendar calculations use the same semantic rule.

---

# 10. Transaction Date Filtering

Audit existing transaction filtering.

The current pattern:

```ts
new Date(`${dateFrom}T00:00:00.000Z`)
```

is not acceptable for wallet-local calendar filtering.

A request such as:

```text
dateFrom = 2026-11-01
dateTo   = 2026-11-01
```

must mean:

> All transactions occurring during November 1 in the wallet's timezone.

For:

```text
Asia/Ho_Chi_Minh
```

that means the local interval corresponding to:

```text
2026-11-01 00:00
through
2026-11-01 23:59:59.999
```

converted to absolute instants for querying.

Prefer an appropriate half-open interval:

```text
[startOfLocalDay, startOfNextLocalDay)
```

rather than relying on `23:59:59.999`.

The exact implementation must follow the existing database/query architecture.

---

# 11. Dashboard Requirements

Dashboard date calculations must use:

```text
wallet.time_zone
```

for:

- today
- current day
- current month
- daily statistics
- monthly statistics
- transaction grouping
- period comparisons

A transaction near UTC midnight must not accidentally move to another wallet day/month.

---

# 12. Budget Requirements

Budget calculations must use the wallet timezone.

For example:

```text
Wallet timezone = Asia/Ho_Chi_Minh

Budget:
2026-11-01 → 2026-11-30
```

A transaction at:

```text
2026-11-30 23:30 Vietnam
```

must count toward November.

Its UTC timestamp is:

```text
2026-11-30 16:30Z
```

A transaction at:

```text
2026-12-01 00:30 Vietnam
```

must NOT count toward November.

Its UTC timestamp is:

```text
2026-11-30 17:30Z
```

This boundary must be tested.

---

# 13. Date Picker Behavior

Do not rely on the existing behavior of storing a selected date at:

```text
12:00 UTC
```

as a timezone workaround.

Investigate how the date picker currently creates timestamps.

A user-selected calendar date should be interpreted in the wallet timezone.

Conceptually:

```text
Selected date:
2026-11-01

Wallet timezone:
Asia/Ho_Chi_Minh

↓
wallet-local calendar date
↓
appropriate instant representation
```

Do not change the fundamental meaning of `TIMESTAMPTZ`.

The exact implementation must preserve existing transaction semantics and avoid introducing accidental time shifts.

---

# 14. "Today"

Replace any wallet-related concept equivalent to:

```ts
todayUtc()
```

with wallet-timezone semantics.

"Today" must mean:

> The current calendar date in the wallet's configured timezone.

For example, at:

```text
2026-11-01 06:30 Vietnam
```

the wallet's today must be:

```text
2026-11-01
```

even though UTC is still:

```text
2026-10-31
```

Do not make "today" depend on the current user's device timezone for wallet-level business logic.

---

# 15. App Requirements

Audit the mobile app's date/time handling.

Known current behavior includes:

```text
today() → device local date
dayOfInstant() → UTC date
formatTimeOfDay() → local time
```

These semantics are inconsistent.

Establish clear separation:

### Wallet calendar operations

Use:

```text
wallet.time_zone
```

### Pure timestamp display

Use the appropriate display timezone according to the product UX.

For transaction times, determine the existing intended behavior before changing it.

Do not automatically change every visible time to wallet timezone without checking the existing product requirement.

The key mandatory requirement is that **calendar grouping and wallet-level calculations use wallet timezone**.

---

# 16. API Contract Changes

Update the API contracts wherever necessary.

The wallet response/object must expose:

```text
time_zone
```

using the project's existing naming conventions.

Update:

- wallet schemas
- DTOs
- request/response types
- validation
- OpenAPI/API specification
- API documentation
- create wallet request
- update wallet/settings request if applicable

If the API currently defines:

```text
today = UTC today
```

change that contract to explicitly define:

> `today` is the current calendar date in the wallet's configured timezone.

Do not leave ambiguous language such as "today" without specifying the timezone semantics.

---

# 17. Database Schema

The current `001_schema.sql` is uncommitted.

If practical, add:

```text
wallets.time_zone
```

directly to the initial schema instead of creating a migration solely for this change.

Follow the existing schema conventions.

Choose an appropriate default/NOT NULL strategy based on the existing wallet lifecycle.

Do not invent a migration strategy if the repository's actual migration workflow dictates otherwise.

First inspect the existing schema and migration conventions.

---

# 18. Existing Wallets / Seed Data

Audit all seed data and fixtures.

Every wallet must have a valid timezone.

For existing development/test data, use the appropriate timezone based on the project's existing intended locale.

Do not silently assign arbitrary timezones without checking the project's test assumptions.

Update factories/builders/fixtures so new wallets always have a valid timezone.

---

# 19. Timezone Validation

The server must validate wallet timezone values.

Use IANA timezone identifiers.

Reject invalid timezone identifiers.

Do not create a homegrown list such as:

```text
["UTC", "GMT+7", "Vietnam"]
```

unless the project already has a proper timezone validation abstraction.

Prefer the runtime/platform's existing timezone database or a reliable existing library if required.

Avoid adding dependencies unless necessary.

---

# 20. Timezone Changes

Changing the wallet timezone must:

- NOT modify stored transaction timestamps
- NOT rewrite historical transaction records
- NOT create a local-date column
- potentially change which calendar day/month a transaction belongs to
- potentially change budget/dashboard/report results

Determine who is authorized to change the wallet timezone based on the existing wallet permission model.

If changing timezone is available to the wallet owner/admin, provide appropriate confirmation UX because it can affect financial reporting.

Do not implement destructive data migration.

---

# 21. DST and IANA Timezones

Do not implement timezone math manually using fixed offsets.

For example, do NOT assume:

```text
America/New_York = UTC-5
```

because DST changes this.

Use IANA timezone identifiers and the runtime/database timezone facilities.

Vietnam:

```text
Asia/Ho_Chi_Minh
```

is a useful test case because it has no DST, but the implementation must work for DST-observing timezones too.

---

# 22. Testing Requirements

This change must include tests.

Do not only test normal daytime transactions.

At minimum add tests for:

## Vietnam UTC boundary

Wallet:

```text
Asia/Ho_Chi_Minh
```

Transaction:

```text
2026-10-31T23:30:00Z
```

Expected wallet date:

```text
2026-11-01
```

This is the critical regression case.

---

## Before local midnight

```text
2026-10-31 23:59 Vietnam
```

Must belong to:

```text
October 31
```

---

## After local midnight

```text
2026-11-01 00:00 Vietnam
```

Must belong to:

```text
November 1
```

---

## Early morning

```text
2026-11-01 06:59 Vietnam
```

Must belong to:

```text
November 1
```

---

## UTC boundary

Verify that crossing UTC midnight does NOT automatically change the wallet calendar day.

---

## Month boundary

Test:

```text
October 31 23:xx local
November 1 00:xx local
```

and ensure monthly budget/dashboard calculations use the wallet timezone.

---

## Different timezone

Include at least one timezone with a negative UTC offset.

For example:

```text
America/Los_Angeles
```

This prevents accidentally implementing a solution that only works for UTC+7.

---

## DST timezone

If practical, test an IANA timezone with DST.

Verify that local-day boundaries still work around a DST transition.

---

## Shared wallet

Create:

```text
Wallet timezone = Asia/Ho_Chi_Minh
```

with members whose devices have different timezones.

Verify that wallet-level calculations produce identical results for both members.

---

## Date picker

Verify that selecting a calendar date does not accidentally move the transaction to the previous/next wallet day.

---

# 23. Search Strategy

Before modifying code, systematically search the repository for timezone/date assumptions.

Search for at least:

```text
todayUtc
slice(0, 10)
T00:00:00
T00:00:00.000Z
toISOString
getUTC
getDate
getMonth
startOfDay
endOfDay
startOfMonth
endOfMonth
transaction_date
contribution_date
dateFrom
dateTo
target_date
start_date
end_date
calendar day
```

Also inspect:

- shared contracts
- date utilities
- calculation utilities
- API schemas
- database queries
- repositories
- services
- hooks
- state management
- date picker components
- transaction list/grouping
- dashboard
- budget calculations
- reports
- tests
- seed data
- factories
- fixtures

Do not modify unrelated date behavior merely because it looks different.

---

# 24. Implementation Order

Use this implementation order unless repository constraints require otherwise:

## Phase 1 — Repository audit

Understand:

- database schema
- wallet model
- API contracts
- date utilities
- server services
- client date handling
- tests
- seed data

Produce a concise impact map before implementation.

---

## Phase 2 — Database

Add:

```text
wallets.time_zone
```

Update schema/seed/factories.

---

## Phase 3 — Shared contracts

Implement consistent timezone-aware calendar functions.

Remove implicit UTC behavior from wallet calendar calculations.

---

## Phase 4 — Server

Update:

- transactions
- dashboard
- budgets
- reports
- today
- date filtering
- other affected calendar calculations

Ensure all wallet-level date calculations use the wallet timezone.

---

## Phase 5 — API

Update:

- DTOs
- schemas
- wallet endpoints
- validation
- API documentation/specification

---

## Phase 6 — App

Update:

- wallet creation
- timezone detection
- timezone selection/confirmation
- wallet state
- transaction grouping
- date picker behavior
- dashboard
- budget displays
- "today"
- relevant date utilities

Do not unnecessarily change timestamp display semantics.

---

## Phase 7 — Tests

Add regression tests for:

- UTC/local midnight
- early morning
- month boundary
- negative offset
- DST
- shared wallet
- date picker
- dashboard
- budgets
- transaction filters

---

## Phase 8 — Verification

Run:

- type checks
- lint
- unit tests
- integration tests
- E2E tests
- database tests if available

Fix regressions caused by the timezone change.

---

# 25. Important Constraints

Do NOT:

- store a derived local transaction date
- replace `TIMESTAMPTZ` with `TIMESTAMP`
- use device timezone for shared wallet calculations
- assume UTC+7 globally
- hardcode timezone offsets
- use GPS merely to determine timezone
- silently reinterpret historical timestamps
- create multiple competing timezone utilities
- leave implicit UTC assumptions in shared calendar functions
- perform unrelated refactors
- change unrelated display formatting without a product reason
- add dependencies without checking whether existing APIs/libraries are sufficient

---

# 26. Definition of Done

The implementation is complete only when all of the following are true:

- [ ] Wallet has an IANA `time_zone`.
- [ ] Wallet creation defaults timezone from the creator's device.
- [ ] User can confirm/change the timezone according to existing wallet permissions/UX.
- [ ] Server validates timezone values.
- [ ] API exposes wallet timezone.
- [ ] Shared date calculations accept/use the relevant timezone.
- [ ] No wallet calendar calculation silently assumes UTC.
- [ ] Transaction timestamps remain `TIMESTAMPTZ`.
- [ ] Calendar dates remain `DATE`.
- [ ] No derived local-date database column is introduced.
- [ ] Transaction list filtering uses wallet timezone.
- [ ] Dashboard calculations use wallet timezone.
- [ ] Budget calculations use wallet timezone.
- [ ] "Today" uses wallet timezone.
- [ ] Monthly boundaries use wallet timezone.
- [ ] Transaction grouping uses wallet timezone.
- [ ] Date picker semantics are correct for wallet timezone.
- [ ] Shared wallets produce consistent calendar calculations for all members.
- [ ] Midnight regression test passes.
- [ ] Month-boundary regression test passes.
- [ ] Negative-offset timezone test passes.
- [ ] DST test passes if supported by the application's test environment.
- [ ] Existing tests continue to pass.
- [ ] New tests cover the critical timezone boundaries.
- [ ] API/spec documentation no longer defines wallet "today" as UTC.
- [ ] No unnecessary timezone/date refactoring remains.

---

# 27. Agent Behavior

Work as an agentic engineer, not as a code generator.

Before editing:

1. Inspect the repository structure.
2. Identify the relevant backend, frontend, contracts, schema, and tests.
3. Search systematically for timezone/date assumptions.
4. Understand existing abstractions before introducing new ones.
5. Produce an impact assessment.
6. Implement incrementally.
7. Run relevant tests after each major layer.
8. Review the final diff for unnecessary changes.

If an existing abstraction already solves part of the problem, extend it rather than creating a duplicate.

If the current architecture conflicts with this design, explain the conflict and adapt the implementation while preserving the core invariant.

Do not stop after making the schema change.

Trace the behavior end-to-end:

```text
device timezone
      ↓
wallet creation
      ↓
wallet.time_zone
      ↓
API
      ↓
shared contracts
      ↓
server date calculations
      ↓
database queries
      ↓
dashboard / budgets / transactions
      ↓
mobile grouping / display
      ↓
tests
```

The final result must have **one coherent definition of wallet calendar time** across the entire system.
