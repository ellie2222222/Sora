# Test plans

One plan per product feature, keyed to the SRS §9 user stories. Each plan breaks a story's
acceptance criteria and error cases into test cases, names the automated test that proves each one
(file and line), and marks what nothing proves yet.

The plans **do not restate requirements**. The SRS story is the requirement; the plan says how it is
tested and where. When a story changes, update its plan in the same change.

| Plan                                                   | Stories                                    |         Cases |       Covered |      Partial |          Gap | Pending spec |
| ------------------------------------------------------ | ------------------------------------------ | ------------: | ------------: | -----------: | -----------: | -----------: |
| [Authentication &amp; session](auth.md)                 | AUTH-US-01..04                             |            30 |            30 |            0 |            0 |            0 |
| [Wallets, members &amp; invitations](wallets.md)        | WAL-US-01..13                              |            35 |            35 |            0 |            0 |            0 |
| [Accounts](accounts.md)                                 | ACC-US-01..05                              |            18 |            18 |            0 |            0 |            0 |
| [Transactions](transactions.md)                         | TXN-US-01..08                              |            34 |            34 |            0 |            0 |            0 |
| [Categories](categories.md)                             | CAT-US-01..04                              |            17 |            17 |            0 |            0 |            0 |
| [Budgets](budgets.md)                                   | BUD-US-01..04                              |            20 |            20 |            0 |            0 |            0 |
| [Saving goals](goals.md)                                | SAV-US-01..06                              |            23 |            23 |            0 |            0 |            0 |
| [Dashboard &amp; exchange rates](dashboard.md)          | DASH-US-01..04                             |            22 |            22 |            0 |            0 |            0 |
| [Guest mode](guest.md)                                  | GST-US-01..02                              |            18 |            15 |            1 |            2 |            0 |
| [AI assistant](ai.md)                                   | AI-US-01..03                               |            13 |            12 |            1 |            0 |            0 |
| [Offline sync (mobile, cross-cutting)](offline-sync.md) | — (`plans/mobile/offline-sync-plan.md`) |            20 |            19 |            0 |            1 |            0 |
| **Total**                                        |                                            | **250** | **244** |  **3** |  **3** |  **0** |

Counts are as of 2026-10-03 (`verifications/2026-10-03-backend-audit-followups.md`).

## Where to start

The open cases, in order of risk. All need a device or an emulator; none is a known defect.

1. [ ] No device-level test of going offline and syncing ([offline-sync.md](offline-sync.md) TC-SYNC-20).
2. [ ] Guest sign-up with existing data — choose the wallet, finish or decline ([guest.md](guest.md) TC-GST-18) — and relaunching as a guest (TC-GST-09).
3. [ ] The per-endpoint guest routing in `app/store/api/*Api.ts` ([guest.md](guest.md) TC-GST-08) and the guest sign-in prompt in the assistant tab ([ai.md](ai.md) TC-AI-12) are render or slice code that bare-node tests cannot load.

E2E itself is failing in CI on `main` in its "Run flows" step, from before this work (see `verifications/2026-10-02-test-suite-audit.md`). Fix that first, or new flows will fail with it.

## Test layers

| Layer              | Where                                                  | Runner                                                        | Proves                                                                                                 | Needs                                                                          |
| ------------------ | ------------------------------------------------------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Contract unit      | `packages/contracts/test/`                           | `npm run test -w @sora/contracts`                           | Money math, derivations (`calc.ts`), Zod schemas, error-code statuses                                | nothing                                                                        |
| Server unit        | `server/test/*.test.ts` (no `integration.` prefix) | `npm run test -w @sora/server`                              | Pure server helpers, exception filter, route mounting                                                  | nothing                                                                        |
| Server integration | `server/test/integration.*.test.ts`                  | same command, with`DATABASE_URL` set                        | HTTP behaviour against the booted app and real Postgres 17: authorization, side effects, derived reads | a**disposable** database (name contains `test`, `scratch` or `ci`) |
| Database probes    | `db/tests/*.sql`                                     | `npm run db:test`                                           | Each CHECK, unique index and exclusion constraint rejects what it must, for any writer                 | Postgres 17                                                                    |
| Mobile unit        | `mobile/src/**/*.test.ts`, next to the code          | `npm run test -w @sora/mobile`                              | App logic: guest ledger, offline queue and sync, session, formatting, form rules                       | nothing. Cannot load files importing`@/`, react-native or expo               |
| E2E                | `mobile/e2e/flows/*.yaml`                            | `maestro test mobile/e2e …` (see `mobile/e2e/README.md`) | Real journeys on an Android emulator against a real API                                                | emulator, release APK, seeded disposable database                              |
| Contract parity    | `scripts/check-contract-parity.mjs`                  | `node scripts/check-contract-parity.mjs`                    | Enums ↔ CHECK constraints, routes ↔ API spec, codes ↔ statuses                                      | nothing                                                                        |

Without `DATABASE_URL`, the integration suites skip locally and print one `[integration] SKIPPED` warning
each (the `node --test` summary would otherwise say `skipped 0`). In CI they fail instead of skipping.

## Case format

Every plan uses the same table:

| Column                    | Meaning                                                                           |
| ------------------------- | --------------------------------------------------------------------------------- |
| **ID**              | `TC-<FEATURE>-NN`. Stable within the plan; never reused after a case is removed |
| **Story**           | SRS §9 story ID, or the API spec § when no story covers it                      |
| **Scenario**        | The condition and action, in one line                                             |
| **Type**            | Unit · Integration · DB probe · Mobile unit · E2E                             |
| **Expected result** | Observable outcome: status + error code, the row read back, the derived figure    |
| **Automated by**    | `file:line` of the test that asserts it (several when layers overlap)           |
| **Status**          | see below                                                                         |

| Status                 | Meaning                                                                                                                |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Covered**      | An automated test asserts the expected result at the layer that matters (HTTP for an API rule, probe for a constraint) |
| **Partial**      | Asserted only at a lower layer (schema, guest copy), or only part of the expected result is asserted                   |
| **Gap**          | Nothing automated asserts it                                                                                           |
| **Pending spec** | Code exists but the SRS doesn't describe it yet. Spec first, then the test                                             |

## Conventions

- **Rule IDs in test titles follow CLAUDE.md Part 3/4** (BR-01..08, AC-01..05). SRS §4 numbers its
  rules differently (SRS BR-04 is CLAUDE.md BR-06). Plans cite CLAUDE.md numbers unless marked
  "SRS".
- **New tests should put the story ID in the title**, e.g.
  `it('SAV-US-02: refuses a transaction-backed contribution without a category', …)`, so
  `grep -rn "SAV-US-02" server/test mobile/src packages/contracts/test` finds every test for a story.
- **Test data** is created through the public API with a unique probe identity
  (`server/test/support/probe-data.ts`: `probe+<tag>-<uuid>@example.invalid`, names `probe-<uuid>`),
  and never cleaned up. The guard in `server/test/support/integration.ts` refuses any database whose
  name doesn't mark it disposable. SQL probes use fixed ids inside one transaction that rolls back.
- **Fixed dates** (`2026-05-10`, `2026-08-01`) keep period figures independent of when the suite runs.
  Don't use `new Date()` for anything a figure depends on.
- **Prove writes by reading them back**: the SQL row, or the derived figure on the next `GET`, not just
  the response status.

## Keeping these current

A plan that stops matching the tests is worse than none (CLAUDE.md rule 9). When you add, move or
delete a test, update the line reference in its plan. When you close a gap, flip its status. The line
numbers are checkable: every `Automated by` link must point at a line whose `it(`/`describe(`/probe
label matches the scenario.
