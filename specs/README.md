# Specs

One folder per Feature in [SRS.md](../SRS.md) §7, numbered in the order the SRS
declares them. Each folder holds:

| File | Contents |
|---|---|
| `spec.md` | WHAT and WHY — user scenarios, per-story acceptance criteria, edge cases, functional requirements, key entities, success criteria, assumptions |
| `plan.md` | HOW — pre-flight spec review findings, architecture, business rules and where they are enforced, API surface, data model, sequence, task list |
| `test_cases.md` | Per-story AC classification (`[API]`/`[UI]`/`[BOTH]`), a coverage matrix mapping every AC and edge case to case numbers, then Given/When/Then cases |

A spec never contains technology names, endpoint paths, or column names — those
belong in `plan.md` and in [SDS.md](../SDS.md). The SRS remains the source of
truth for domain language; these folders elaborate one feature at a time.

## Index

| # | Feature | SRS | Status | Spec depth |
|---|---|---|---|---|
| [001](001-authentication/) | Authentication & Authorization (Auth-US) | §7 Auth-US | Implemented | 60 AC · 89 TC |
| [002](002-workspace-management/) | Workspace Management (WS-US) | §7 WS-US | Implemented | thin — not yet expanded |
| [003](003-account-management/) | Account Management (ACC-US) | §7 ACC-US | Implemented | thin — not yet expanded |
| [004](004-transaction-management/) | Transaction Management (TXN-US) | §7 TXN-US | Implemented except TXN-US-03 UI; 2 open defects | 130 AC · 165 TC |
| 005 | Budget Management (BUD-US) | §7 BUD-US | Not started | **no folder yet** |
| 006 | Saving Goals (SAV-US) | §7 SAV-US | Not started | **no folder yet** |
| [007](007-category-management/) | Categories & Configuration (CAT-US) | §7 CAT-US | Implemented | thin — not yet expanded |
| 008 | Bills & Reminders (BILL-US) | §7 BILL-US | Not started | **no folder yet** |
| [009](009-dashboard-reporting/) | Dashboard & Reports (DASH-US) | §7 DASH-US | DASH-US-01 implemented | thin — not yet expanded |
| [010](010-multi-currency/) | Multi-currency reporting (cross-cutting) | BR-07, BR-07a, FR-10, FR-13a/b | Implemented | thin — not yet expanded |

**Spec depth** records whether a folder has been through the acceptance-criteria
expansion pass. A *thin* spec has roughly 15–20 criteria for a whole feature,
which is about a quarter of the density a story-by-story reading produces, and no
`test_cases.md`. Expanding one is not editorial work: the 004 pass turned up two
defects (an unrestricted edit path and an unserialised cancellation) that the
thin version had no criterion to catch.

010 is not an SRS §7 Feature. It is a cross-cutting capability that every money
feature depends on, and it carries enough design weight — snapshot rates, an
external provider, a restatement operation — to be specified on its own.

## Status vocabulary

- **Implemented** — endpoints, UI and audit logging exist and are wired end to end.
- **Partially implemented** — some stories in the feature are done; the folder says which.
- **Not started** — SRS stories exist; no endpoint or UI yet. The plan records the intended design so it is not re-derived later.

Nothing here is verified by a passing test suite. The backend test suite is
currently red for reasons predating these specs (see each plan's Open Risks).
