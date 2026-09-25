# Test coverage audit, whole repository: gap map before changes

**Date:** 2026-09-25T02:43:13Z
**Method:** ad hoc (three read-only mapping agents: server/contracts/db, mobile logic, mobile UI; each finding re-checked before it drives a test)
**Verdict:** SKIP for this section (analysis only). The results of the pass are in "Final audit" at the end of this file.
**Scope:** every package — `packages/contracts`, `server`, `db`, `scripts` and `mobile` — mapped behaviour by behaviour against the tests that exist today. Not just recent changes.
**Files touched:** this report, until the implementation sections below.
**Related reports:** `2026-09-25-pre-ownership-queue-rows.md`, `2026-09-25-kysely-0.28-scratch-probe.md`, `2026-09-25-offline-totals-saved-note-encryption.md`

## Test architecture as found

- **Runner:** `node --test` everywhere.
  - Contracts: `packages/contracts/test/*.test.ts`, 3 files.
  - Server: `server/test/*.test.ts`, 5 files. They compile to `dist/`, and `setup.ts` preloads a `fetch` that throws.
  - Mobile: `mobile/src/**/*.test.ts`, 27 files, run by bare Node type stripping. They cannot import `@/` paths or react-native/expo.
- **Database:** `db/tests/001_constraints.sql`, about 40 reject/accept probes, run by `node scripts/migrate.mjs --constraints` against real Postgres 17 in CI.
- **Not present:** any E2E framework (Detox/Maestro), any React Native component-test library, Jest, or a coverage tool.
- **CI:** the server job already migrates a real `sora_test` Postgres and exports `DATABASE_URL`. **No server test uses it**, so no service, guard, SQL query or authorization rule runs against a database in CI.
- **Fixtures:**
  - mobile: `services/sync/testSupport.ts` (memory `QueueDb`, adapters);
  - guest tests: their own in-memory persistence;
  - contracts `calc.test.ts`: mirrors the SQL fixture ledger.
- **Missing infrastructure:** no factory or auth helper exists for the server, because nothing ever needed one.

## Gap map

Priority is implementation order only. **Critical** means money correctness, authorization, ownership or data loss.

| Area | Important behaviour | Existing coverage | Missing coverage | Test type | Priority |
|---|---|---|---|---|---|
| Server access | AC-01 404-vs-403 on every wallet-scoped resource; VIEWER write 403; audit log OWNER-only | none (scratch probe only, manual) | Whole matrix over HTTP | Integration (HTTP + real PG) | Critical |
| Transactions | BR-02 cross-wallet transfer needs EDITOR on both; both balances move; audited once per wallet | DB probe accepts the row | Authorization on both sides, balances, 2 audit rows | Integration | Critical |
| Transactions | BR-03 immutability; delete = status change; balance restored | none | PATCH amount/type/accounts → 409; delete keeps row; re-delete 409 | Integration | Critical |
| Transactions | BR-07 currency match; archived account | Zod only | 422 / 409 over HTTP | Integration | High |
| Dashboard | BR-06 aggregation (income/expense/net, transfer flow, category split, per-currency) | pure calc only | `DashboardService` over real rows | Integration | Critical |
| Accounts | Balance derivation over real rows (DELETED/PENDING ignored, cross-wallet leg) | pure calc only | `BalanceService` SQL | Integration | Critical |
| Auth | Refresh rotation, replay revokes family, concurrent refresh single winner | none (scratch probe only) | Automated | Integration | Critical |
| Auth | Register seeding, identical 401 for unknown/wrong password, lockout 429 (+`Retry-After`, spec §2.9) | rate-limit sweep only | Whole flow; `Retry-After` suspected missing | Integration | High |
| Members | Ownership transfer demote-before-promote; concurrent transfer race suspected | none | Sequential + concurrent | Integration | Critical |
| Invitations | Token hash, masked preview, email match 403, expiry 410, reuse 409 | DB probes (uniqueness) | Lifecycle over HTTP | Integration | High |
| Budgets | Overlap 409 over HTTP; spent derived | DB probe + pure calc | Mapping + spent ignoring currency (suspected BR-07 gap) | Integration | High |
| Goals | Contribution `recordAsTransaction` writes EXPENSE atomically; archived account suspected accepted | none | Atomicity, archived checks, delete → backing tx DELETED | Integration | Critical |
| Audit | Savepoint (rule 16): failed audit insert must not roll back the write | scratch probe only | Automated | Integration | High |
| Exchange rate | Snapshot upsert `onConflict`, fresh/stale/unavailable, service failure | unit with stubbed DB + fetch; scratch probe (manual) | Real-PG upsert and stale-from-snapshot, automated | Integration | High |
| Server infra | Every non-public route returns 401 without a bearer | none | Route-table sweep | Integration (no DB) | High |
| Contracts | `roleSatisfies` matrix; `ERROR_STATUS` for 410/409/403 codes; `STARTER_CATEGORIES` unique names | none | Unit | Unit | High |
| Contracts | A number amount with more than 4 decimals is rounded, not rejected (rule 1 says reject) | string amounts only | Unit; suspected bug | Unit | High |
| DB suite | "Derived reads" section prints figures but asserts nothing | prints only | RAISE on mismatch; probes for `CANCELLED` rejected (004), credential check | DB probe | High |
| Mobile sync | Offline create then offline edit/cancel of the same record sends the local id to the server (suspected) | none | Engine test | Unit | Critical |
| Mobile sync | Owner switch during a sync pass; row stuck in `syncing` after app kill; 5xx blocking the queue | none | Engine tests | Unit | Critical |
| Mobile auth | Refresh racing logout resurrects the session (suspected) | single-flight covered | Race test | Unit | Critical |
| Mobile guest | Concurrent `hydrate()` overwriting a mutation (suspected) | sequential only | Race test | Unit | Critical |
| Mobile guest | Upload resume duplicates an account (no pinned idempotency key, suspected) | resume without kill-after-commit | Kill-after-commit test | Unit | Critical |
| Mobile money | `utils/money.ts` formatting (VND rounding, negatives, fallback), `sumByTransactionType` counts PENDING/DELETED | none | Unit | Unit | Critical |
| Mobile errors | `toApiError` with server body, `isUnauthenticated`, `messageOf` offline-first | `isNetworkError` only | Unit | Unit | High |
| Mobile adapters | `buildEntityAdapters` routing (goalId into URL, cancel reason) | none | Unit | Unit | High |
| Mobile guest | `guestDashboardApi.summary`, `guestCategoriesApi` rules | none | Unit | Unit | High |
| Mobile i18n | en/vi key and `{{placeholder}}` parity; every error-code key exists | dev-only warning | Unit (CI enforcement) | Unit | Medium |
| Mobile store | `selectSyncStatus` priority, `selectQueueEntryFor` | none | Unit | Unit | Medium |
| Mobile roles | `permissionsFor`, `canTransferBetween` | none | Unit | Unit | Medium |
| Mobile UI | Date picker year change keeps an invalid day (Feb 29 → `2025-02-29`, suspected) | `monthGrid` only | Extract `withYear` + unit | Unit (extraction) | High |
| Mobile UI | Edit transaction diff-only PATCH | none | Extract `buildUpdateBody` + unit | Unit (extraction) | High |
| Mobile UI | ConfirmDialog typed-word match, StateView error suppression, sync indicator state, root routing, active wallet fallback | none | Extract + unit | Unit (extraction) | Medium |
| Mobile UI | Slide/bottom sheets, pull-to-refresh gesture, date picker taps, calculator taps, add/edit/delete flows, session restore on relaunch, guest upload, offline → sync | `pullMath`, `calculatorEngine` pure logic only | Real device flows | E2E | High, **blocked: no E2E framework** |

## Intentionally not tested this pass

- **E2E and component tests.** No framework exists. Adding Detox or Maestro is a new dependency and a native build step, which CLAUDE.md says to ask about first. The flows it should cover are listed under "Final audit" below.
- **Trivial UI helpers** (tab indicator offset, modal routing switch): too thin to catch a regression.
- **Google sign-in over the network:** needs a real OAuth client. It can be unit-tested with a stubbed `verifyIdToken` later.

## Final audit (second pass)

**Verdict:** PASS for everything automated below; E2E BLOCKED on a framework decision.

### Commands and results

| Command | Result |
|---|---|
| `npm run test -w @sora/contracts` | 114 pass, 0 fail |
| `node scripts/check-contract-parity.mjs` | 31/31 parity checks passed |
| `node scripts/migrate.mjs --constraints` on `scratch_itest_7e3a` (postgres:17, container `scratch-itest-7e3a`, 127.0.0.1:55434) | 6 migrations applied, `001_constraints.sql` PASS |
| server: `tsc -p tsconfig.json`, then `node --import ./dist/test/setup.js --test dist/test/*.test.js` with `DATABASE_URL` on that DB | 73 pass, 0 fail, 0 skipped (16 suites, 11 files) |
| `integration.auth` + `integration.members` (concurrent refresh, concurrent ownership transfer) × 5 | 16/16 pass every run |
| mobile `npm run test` | 526 tests: 522 pass, 0 fail, 4 todo |
| `npm run typecheck` (root, every package) | clean |
| `npx expo export --platform android` | bundle exported |
| teardown: `docker rm -f scratch-itest-7e3a`, `docker ps -a`, port probe | container gone, list matches pre-run, 55434 closed |

Without `DATABASE_URL` the integration suites skip locally; with `CI=true` and no usable test database the harness throws, so CI (`sora_test`, `.github/workflows/ci.yml:131-135`) cannot go green by skipping.

### Tests added / updated

- **Server integration (new, real Postgres):** `server/test/integration.{auth,access,ledger,members,planning,persistence}.test.ts` — 39 tests; harness `server/test/support/integration.ts`. `transaction-category.test.ts` +1 (hidden category → 404).
- **Contracts:** new `enums.test.ts`, `responses.test.ts`, `starter-categories.test.ts`; additions to `money.test.ts`, `schemas.test.ts`, `calc.test.ts` (BR-07 budget currency).
- **Mobile:** new `utils/money.test.ts`, `utils/roles.test.ts`, `app/i18n/localeParity.test.ts`, `app/store/offlineQueueSlice.test.ts`, `services/sync/entityAdapters.test.ts`, `services/guest/guestDashboard.test.ts`, `services/guest/guestCategories.test.ts`; additions to `syncEngine.test.ts` (offline create→edit→cancel id resolution, edit held behind unsynced create, interrupted `syncing` resend, owner switch mid-pass), `session.test.ts` (3 refresh/logout races), `guestStore.test.ts` (3 hydrate overlaps), `guestUpload.test.ts` (pinned keys for every create after a lost response), `errors.test.ts`, `dashboardPeriod.test.ts`, `date.test.ts`.

### Bugs found by the new tests and fixed

Lockout 429 lacked `Retry-After`; hidden category leaked existence (403 instead of 404) on transactions, budgets and category parents; BR-03 `409 TRANSACTION_IMMUTABLE` unreachable (Zod stripped the fields first); concurrent ownership transfer let a demoted owner win; budget spent summed other currencies; `recordAsTransaction` accepted an archived account/wallet; number amounts with >4 decimals were rounded; sync sent a local id for an offline-created record's edit/cancel; rows stuck in `syncing` after a kill; owner switch mid-pass kept sending; queueId collisions and `createdAt` ties; refresh racing logout restored the old session; concurrent guest `hydrate()` and mutate-before-hydrate lost writes; guest upload resume duplicated accounts/categories/budgets/goals. API spec updated for the 404 and `*_ARCHIVED` rows.

### High-risk list from the brief — second-pass check

| Area | Covered by | Happy + failure |
|---|---|---|
| Exchange-rate cache / `onConflict` / fresh-stale-failure | `integration.persistence` (FRESH → in-place upsert → STALE, UNAVAILABLE) + `exchange-rate` unit | yes |
| Offline queue ownership, pre-upgrade rows, session restore, orphaned rows, startup assignment failure | `offlineQueue.test.ts` (see `2026-09-25-pre-ownership-queue-rows.md`) | yes |
| Sync after auth | `syncEngine.test.ts` owner-switch and ownership tests | yes |
| Calculator | `calculatorEngine.test.ts` (pure engine) | yes; taps not covered |
| Date picker | `date.test.ts`, `monthGrid` | logic only; year-switch Feb 29 bug open |
| Slide modals, pull-to-refresh | none | not testable without a component/E2E framework |

### Intentionally not tested

- **E2E / component flows** — no framework in the stack; adding Maestro or Detox needs your decision. Flows to cover first: sign in → session restore on relaunch; offline add transaction → reconnect → synced; guest ledger → sign up → upload; slide sheet open/close + submit; pull-to-refresh; date picker month/year switch; calculator keypad entry into an amount. testIDs already exist in 76 `.tsx` files, but many predate NC-04 naming (`add-account-name`, not `input-account-name`).
- Google sign-in over the network (needs a real OAuth client).

### Follow-up fixes (same day, after the second pass)

| Finding | Fix | Test |
|---|---|---|
| 5xx poison row blocked the queue | `mobile/src/services/sync/syncEngine.ts` `classifyFailure` → `'server'`: backed off like `failed`, pass continues, never parked as `conflict` | `syncEngine.test.ts` poison-row (was todo) + "never parks … server errors alone" |
| Display lost cents past 2^53 minor units | `mobile/src/utils/money.ts`: `Intl.NumberFormat.format` gets an exact, pre-rounded decimal string (`roundToDecimals`); `scaledToDisplayNumber` removed (no other callers) | `money.test.ts` (was todo) |
| Fallback formatter padded but never rounded | `fallbackFormat` rounds with `roundToDecimals` first | `money.test.ts` (was todo) |
| `sumByTransactionType` summed PENDING/DELETED | filters `TransactionStatus.COMPLETED`, matching balances and `pendingTotals` | `money.test.ts` (was todo) |
| DatePicker year switch produced `YYYY-02-29` in a non-leap year | `mobile/src/utils/date.ts` `withYear` (clamps via `addMonths`), used by `DatePickerModal.handleSelectYear` | `date.test.ts` `withYear` |
| Expired open invitation blocked re-invite | `server/src/wallets/invitations.service.ts` `create`: in one transaction, revokes an expired open offer for the same (wallet, email) — audited `INVITATION_REVOKED` — then inserts. A partial index can't test expiry (`now()` is not immutable), so no migration | `integration.members` "lets an expired invitation be replaced…" |
| DB "Derived reads" asserted nothing | relabelled as printed-only in `db/tests/001_constraints.sql`; the real SQL is asserted in `integration.ledger`/`integration.planning` | — |
| BudgetDetail empty PATCH | not reproducible: Save is disabled unless a field differs | — |

Docs: `docs/API_SPECIFICATION.md` §invitations (expired offer replaced, old token → 404); `plans/mobile/offline-sync-plan.md` failure table (5xx row).

Re-run after these fixes: mobile `tsc --noEmit` clean, `npm run test` 528/528, 0 todo; server 74/74 on `scratch_itest_5b91` (container `scratch-itest-5b91`, 127.0.0.1:55435, removed afterwards; `docker ps -a` matches the pre-run list, port closed), race suites 17/17 × 3; contracts 114/114; parity 31/31; `expo export --platform android` exported.

### Remaining risks

- `selectQueueEntryFor` returns the oldest row for a record; behaviour pinned by test, intent undecided.
- `migrate.mjs --reset` name guard has no automated test (`scripts/` has no runner).
- On an engine whose `Intl.NumberFormat` lacks the ES2023 string overload, huge totals still format through a float (no worse than before); the fallback path is exact.
- No automated check of any gesture, sheet or navigation flow until an E2E framework lands.

**E2E decision (2026-09-25):** Maestro — see `plans/mobile/e2e-framework-decision.md`. First Maestro flows now pass 3/3 locally (session restore, add expense via sheet/keypad/date picker, pull-to-refresh); the CI job is added but has not run on GitHub yet.
