# Test suite audit: quality, coverage, organization, traceability

**Date:** 2026-10-02T02:53:29Z
**Method:** ad hoc (read-only review, then the database-free suites run)
**Verdict:** PASS after the fifth pass (E2E still BLOCKED, failing in CI before this work) — every finding F-01..F-16 and defect D-1..D-3 fixed except F-11 (resolved by `docs/test-plans/` instead of renaming titles) and E2E, which is BLOCKED here (no emulator; CI not reachable). First pass: FAIL (F-01, F-02)
**Scope:** every test layer (`packages/contracts/test`, `server/test`, `db/tests`, `mobile/src/**/*.test.ts`, `mobile/e2e`, `.github/workflows/ci.yml`), mapped against SRS §9 user stories and the API specification
**Files touched:** this report; `docs/test-plans/*.md`; second pass: `server/src/common/pg-error.ts`, `server/test/pg-error.test.ts`, `server/test/integration.planning.test.ts`, `scripts/check-contract-parity.mjs`, `db/tests/001_constraints.sql`, `packages/contracts/test/schemas.test.ts`, `SRS.md`, `SDS.md`, `docs/API_SPECIFICATION.md`, `CLAUDE.md`, `AGENTS.md`, `.agents/rules/*.md`, `aif-sdlc-checklist.md`, `mobile/src/services/guest/guestBudgets.ts` (comment)
**Related reports:** follows `2026-09-25-test-coverage-audit.md` (its remaining risks still apply: `selectQueueEntryFor` intent undecided, no runner for `scripts/`)

## Method

- Inventory: `find` for `*.test.ts`, `db/tests/*.sql` and `mobile/e2e`; test titles extracted with `grep -nE "^\s*(describe|it)\("`.
- Endpoint coverage: every `api.call('<METHOD>', '<path>')` in `server/test` grepped and compared against the `@Get/@Post/...` decorators in `server/src/**/*.controller.ts`.
- Constraint coverage: `chk_/uq_/excl_` names in `db/migrations/*.sql` compared against `db/tests` and `server/src/common/pg-error.ts`.
- Determinism: `grep` for `new Date()`, `Date.now()`, `setTimeout` and skip/todo/only.
- Runs: `npm run test -w @sora/contracts`, `npm run test -w @sora/mobile`, `npm run test -w @sora/server` (with `DATABASE_URL` unset), `node scripts/check-contract-parity.mjs`.

## Findings

| Check | Observed | Verdict |
|---|---|---|
| contracts suite | 114 pass, 0 fail | PASS |
| mobile suite | 528 pass, 0 fail, 0 todo | PASS |
| server suite, no database | 37 pass; 7 integration suites (48 tests) skipped at suite level, yet the summary prints `skipped 0` | PASS (unit) / BLOCKED (integration) |
| parity | 38/38 | PASS |
| Docker / Postgres | `docker version`: daemon pipe missing; `initdb`, `pg_ctl`, `psql` not on PATH | BLOCKED |
| `gh run list` | not authenticated, so whether the E2E job has ever passed can't be checked | BLOCKED |

| ID | Location | Finding | Evidence | Priority |
|---|---|---|---|---|
| F-01 | `server/src/common/pg-error.ts:38` | Only `excl_budget_overlap` is mapped, but `008_redesign_budgets.sql:21` drops it and adds `excl_budget_category_overlap`, `excl_budget_goal_overlap` and `excl_budget_overall_overlap`. `rethrowPgError` rethrows an unmapped violation untouched, so an overlap returns 500 | `integration.planning.test.ts:60` expects `[409, 'BUDGET_PERIOD_OVERLAP']` and should fail once 008 is applied (not run here) | P0 |
| F-02 | 008–010, `packages/contracts/src/{enums,schemas}.ts` (uncommitted) | DAILY/YEARLY/GOAL periods, nullable `categoryId`, `goalId` budgets: no test in contracts, server or `db/tests`; SRS BUD-US-01 still describes the old model | `git diff --stat server/test packages/contracts/test db/tests` is empty | P0 |
| F-03 | `server/test/integration.auth.test.ts:112-131` | The 401 sweep is a hand-written list of 11 calls (no AI, PATCH, DELETE or invitation routes) | — | P1 |
| F-04 | `server/test/integration.persistence.test.ts:69,79` | A fixed 100 ms sleep waits for the background `void this.saveDailySnapshot` (`exchange-rate.service.ts:114`) | — | P1 |
| F-05 | server `npm test` | Skipped suites print `skipped 0` | local run above | P1 |
| F-06 | `mobile/src/app/store/api/pendingTotalsPatch.ts`, `mobile/src/services/api/client.ts` | Untestable under bare `node --test` (they import through `@/`); the 401 refresh-and-replay is untested | `mobile/package.json` test script has no alias loader | P1 |
| F-07 | `.github/workflows/ci.yml:173,186` (uncommitted) | E2E moved to `macos-14` with Postgres 14 (the other jobs use 17); Android emulator acceleration on arm64 runners **unverified, worth confirming** | `git diff` | P1 |
| F-16 | `server/src/common/idempotency.interceptor.ts` | API spec §2.10 `Idempotency-Key` has no server test, though guest upload resume and the offline queue rely on it to avoid duplicate transactions | `grep -rni idempotency server/test` is empty | P1 |
| F-08 | access:140, members:160, planning:99,110 | Assert `200 \|\| 204`; spec §7.3/§8.3/§9.5/§13.8 say `204` | — | P2 |
| F-09 | `mobile/src/services/sync/testSupport.ts` | `memoryQueueDb` is a copy of `MemoryQueueDb` in `offlineQueueDb.ts:205-260`; `SqliteQueueDb` SQL never runs | — | P2 |
| F-10 | `db/tests/001_constraints.sql:320-366` | "Derived reads" asserts nothing and is a third copy of the derivation SQL (its budget spend ignores currency) | — | P2 |
| F-11 | all titles | 0 references to SRS story IDs (`[A-Z]+-US-[0-9]+`); 55 to rule IDs | grep | P2 |
| F-12 | `server/test/routes.test.ts:103` | Group list omits `ai` | — | P3 |
| F-13 | `syncEngine.test.ts:79,283,358,475,500` | 2 ms sleeps that `enqueue`'s ordering clamp (`offlineQueue.ts:103`) makes unnecessary | — | P3 |
| F-14 | server test glob `dist/test/*.test.js` | A deleted test's compiled copy keeps running locally (CI checks out clean) | — | P3 |
| F-15 | `integration.ledger.test.ts:33` | `salary` assigned, never read | — | P3 |

Checked and still correct: the probe-identity data isolation (`probe+<uuid>@example.invalid`, disposable-name guard, CI fails rather than skips — `support/integration.ts:33-44`); the SQL probes roll back; CI applies migrations twice; `setup.ts` blocks real `fetch`; queue ordering is strictly monotonic (`offlineQueue.ts:103`).

Doc drift found while mapping: SRS SAV-US-05 and TXN-US-08 say "cancelled", while migration 004 and the API spec say `DELETED`. SRS §4 numbers its business rules differently from CLAUDE.md Part 3 (SRS BR-04 = CLAUDE.md BR-06); test titles use CLAUDE.md's numbering. `aif-sdlc-checklist.md` §6 still says the server tests boot "no database".

## Fixes Applied

Second pass, same day: the test plans, then the fixes below.

| Finding | Change | Re-verified by |
|---|---|---|
| F-01 | `server/src/common/pg-error.ts`: maps `excl_budget_category_overlap`, `excl_budget_goal_overlap`, `excl_budget_overall_overlap` to `BUDGET_PERIOD_OVERLAP`; the dropped `excl_budget_overlap` key removed | New `server/test/pg-error.test.ts` (3 cases for the constraints, plus the unmapped and non-constraint rethrows): server suite 44/44 without a database. `node scripts/check-contract-parity.mjs` failed 38/40 on exactly this before the fix, 40/40 after |
| F-01 (recurrence) | `scripts/check-contract-parity.mjs` §4: every `CONSTRAINT_CODES` key must name a constraint still live after the last migration, and every live `excl_*` constraint must be mapped | Same parity runs as above |
| F-02 (schema facts only) | `db/tests/001_constraints.sql`: 7 probes for 008/010 (wallet-wide DAILY accepted, second wallet-wide rejected, category beside wallet-wide accepted, GOAL budget accepted, second budget on one goal rejected, YEARLY accepted, unknown period rejected). `packages/contracts/test/schemas.test.ts`: wallet-wide body accepted, every `BUDGET_PERIOD_TYPES` member accepted, `HOURLY` rejected. `server/test/integration.planning.test.ts`: overlapping wallet-wide budget → 409, category budget on the same days → 201 | Contracts 116/116. The SQL probes and the integration test were **not run**: no Postgres here |
| Stale constraint name | `excl_budget_overlap` → the three new names in `CLAUDE.md` BR-04 and rule 5, `AGENTS.md`, `.agents/rules/{bug-prevention-and-gotchas,business-rules-and-access}.md`, `SDS.md` (×2), `docs/API_SPECIFICATION.md` §12.2 and §18, the `guestBudgets.ts` header comment | `grep -rn excl_budget_overlap` finds only migrations 001/008 and older reports |
| SRS drift | `SRS.md`: `TRANSACTION_ALREADY_CANCELLED` (not a real code) → `TRANSACTION_ALREADY_DELETED` (×3); FR-31, FR-50, flow step 7, TXN-US-08 and SAV-US-05 now name the stored status `DELETED` | Compared against `ERROR_CODES` in `packages/contracts/src/responses.ts` and API spec §11.4/§11.5/§13.8 |
| Process gate | `aif-sdlc-checklist.md` §6: server line requires `DATABASE_URL` (integration suites otherwise skip); new item to keep the feature's test plan current. `CLAUDE.md` project tree lists `docs/test-plans/` | — |

New defects found while writing the F-02 tests. **Not fixed**, because they need a product decision:

| ID | Location | Defect |
|---|---|---|
| D-1 | `packages/contracts/src/calc.ts` `calculateBudgetSpent` | A budget with neither `categoryId` nor `goalId` hits `continue` for every row, so a wallet-wide budget's `spent` is always `0`, though `budgets.service.ts` fetches that wallet's expenses for it |
| D-2 | `server/src/transactions/transactions.service.ts` | `goalId` is accepted by `createTransactionSchema`/`updateTransactionSchema` and selected on read, but never written, so a goal budget's `spent` is always `0` |
| D-3 | `server/src/budgets/budgets.service.ts` `create` | `goalId` is never checked to be a goal in the budget's wallet (a category is: `assertBudgetableCategory`); a budget may also name both a category and a goal, and nothing says whether it should |

## Third pass: fixing everything

### Decisions taken without an answer to the open questions (derived from the uncommitted mobile code)

- A budget is exactly one kind. `AddBudgetModal.tsx:159-172` sends a goal only with the GOAL period and a category otherwise, and migration 008 adds the wallet-wide exclusion.
- A goal budget counts goal-tagged expenses. `guestGoals.ts` tags a contribution's backing expense with `goalId: goal.id`, so the server now does the same.
- Specified in SRS BUD-US-01/02 and TXN-US-02/07, and API spec §11.2, §11.4, §12.2 and §13.7, before the code changed.

### Changes

| Finding | Change |
|---|---|
| D-1 | `calc.ts`: `BudgetSpendInput`/`SpendRelevantTransaction` carry `walletId`; new `isBudgetTarget` (goal, then category, then wallet) used by `calculateBudgetSpent` and mobile `pendingTotals.applyToBudget` |
| D-1 (found by the new HTTP test) | `budgets.service.ts` `categoriesByIds([])` emitted `IN ()`, so creating any wallet-wide or goal budget returned **500** |
| D-1 (duplication) | `server/src/budgets/budget-spend.ts`: one spend query shared by `BudgetsService` and the dashboard's active-budget slice, replacing two copies |
| D-2 | `transactions.service.ts` stores and edits `goal_id`; only an EXPENSE, only a goal in the paying wallet (`requireGoalInWallet`, `goals/goal-access.ts`); the contribution's backing expense is tagged |
| D-3 | `createBudgetSchema` kind refinement; `budgets.service.ts` checks the goal is in the wallet and ACTIVE; migrations `011_budget_kind_and_transaction_goal.sql` (`chk_budget_kind`, `chk_transaction_goal`, added `NOT VALID`) and `012_validate_budget_kind_and_transaction_goal.sql` (`VALIDATE CONSTRAINT`, per the checklist rule for populated tables), both mapped in `pg-error.ts` |
| guest copy | `guestBudgets.ts` overlap per kind and goal checks; `guestTransactions.ts` goal-tag checks; `guestUpload.ts` sends `goalId` on expenses only (the narrowed type caught income/transfer sending it) |
| F-03 | 401 sweep reads method + path off the running router (about 60 routes; 6 public by design) |
| F-04 | persistence test polls for the snapshot row (5 s bound) instead of sleeping 100 ms |
| F-05 | `integrationSkipReason` prints `[integration] SKIPPED — <reason>` per skipped suite |
| F-07 | E2E job restored to HEAD's `ubuntu-latest` + KVM + x86_64 + `postgres:17` (GitHub's arm64 macOS runners lack the nested virtualization the emulator needs); `pg_isready -U sora` kept and applied to all three services. The uncommitted macOS version is saved at `<scratchpad>/ci.yml.uncommitted-macos-e2e` |
| F-06 | `mobile/src/services/api/refreshRetry.ts` (401 decision, injected deps) used by `client.ts`; `mobile/src/services/sync/cachePatches.ts` (which cached reads a write patches) used by `pendingTotalsPatch.ts` |
| F-08 | exact `204` in four places |
| F-09 | `mobile/src/services/sync/memoryQueueDb.ts` holds the production `MemoryQueueDb`; `testSupport.memoryQueueDb()` returns it; `testSupport.ts` dropped from the `services/sync` and `services/guest` barrels (test fakes were shipping in the app bundle) |
| F-10 | "Derived reads" section deleted; `calc.test.ts` titles and comment no longer cite it |
| F-11 | Not done as a mass rename: `docs/test-plans/` is the traceability map, and new tests carry story IDs |
| F-12 | route groups derived from `ROUTES` |
| F-13 | five 2 ms sleeps removed; `syncEngine.test.ts` 21/21 × 3 |
| F-14 | `server/test/run.mjs` runs only the compiled tests whose `.ts` source exists, so nothing is deleted |
| F-15 | unused `salary` removed |
| F-16 | **Defect**: `IdempotencyInterceptor` recorded the response only after the handler finished, so a retry arriving mid-flight wrote twice. Now the first attempt is claimed and shared (`shareReplay`); a failed one is forgotten. Reproduced first (handler ran 2×), then fixed; spec §2.10 updated |

### Verification (Postgres 17.10 via `embedded-postgres`, scratchpad only, port 55440, database `scratch_itest_f9c2`)

| Command | Result |
|---|---|
| `node scripts/migrate.mjs --constraints` | 11 migrations applied; `001_constraints.sql` PASS, `002_ai_messages.sql` PASS (after deleting "Derived reads": PASS again) |
| `node scripts/migrate.mjs` (second run) | `Up to date (11 migration(s) applied)` |
| `npm run test -w @sora/server` with that `DATABASE_URL` | 104/104, three consecutive runs (first run before the `IN ()` fix: 95/98, the three new budget-kind tests got 500) |
| `npm run test -w @sora/server` without `DATABASE_URL` | 7 `[integration] SKIPPED` warnings; unit tests pass |
| `npm run test -w @sora/contracts` | 127/127 |
| `node scripts/check-contract-parity.mjs` | 40/40 |
| `npm run test -w @sora/mobile` | 545/545 |
| `npx tsc --noEmit` (mobile), contracts and server typecheck | contracts and server clean; mobile: 1 error, `ToastProvider.tsx:144`, pre-existing and not touched here |
| `npx expo export --platform android` | Exported |
| `npm run agents:check` | in sync |
| Plan link checker | 510 links resolve; titles listed and spot-checked; one link that matched a bare `it(` corrected by hand |
| Migration split re-check (fresh cluster, port 55441, `scratch_mig012_7d3a`): `migrate.mjs --constraints`, second `migrate.mjs`, `pg_constraint.convalidated`, server suite | 12 applied, both suites PASS; `Up to date (12 migration(s) applied)`; both constraints `convalidated = true`; server 104/104; parity 40/40 |

## Fourth pass: follow-ups and the top plan gaps

| Item | Evidence | Result |
|---|---|---|
| Dev database check before 012 | `.env` names `localhost:5432/sora_dev`; `netstat -an` shows nothing listening on 5432–5434, and there's no Docker | BLOCKED: no database to check. The read-only query to run before migrating is below |
| E2E on GitHub | Public API `actions/workflows/ci.yml/runs`: every `main` run since `1e3605f` failed. Jobs API: Contracts, Database, Server and Mobile pass; `Mobile E2E` fails in step `Run flows` (build and emulator boot pass). Logs return 403 without auth | Pre-existing: it fails on HEAD's Ubuntu job. Every `id:` the flows use (`mobile/e2e/flows`, `subflows`) exists at HEAD (`git grep`), so it isn't a renamed testID. The cause needs the job log |
| `ToastProvider.tsx:144` | `StyleSheet.create` at module scope read `theme`, which exists only inside the component, so loading the module would throw `ReferenceError` | Fixed with the static `spacing` token (spacing is theme-independent). `npx tsc --noEmit` (mobile) exit 0 |
| Throwaway files | `server/verify-harness.mjs`, `server/tsconfig.verify.json`; only this report referenced them | Removed (approved) |
| TC-TXN-12, TC-TXN-24, TC-TXN-05, TC-WAL-27 | `integration.ledger.test.ts` lines 107, 119, 132, 148 | PASS |
| TC-SAV-17 | `integration.planning.test.ts:132`, completed and cancelled | PASS |
| TC-CAT-02..09, TC-CAT-14 | New `integration.categories.test.ts`, 8 tests | PASS |
| **Defect found**: archiving a category by `PATCH {status: ARCHIVED}` | Before the fix, against HEAD's `categories.service.ts`: `node --test dist/test/integration.categories.test.js` → pass 7, fail 1 (CAT-US-04): the PATCH archived with an active budget and left the child ACTIVE. The guest `update` had the same gap | Fixed: `categories.service.ts` `assertNotBudgeted` + `archiveSubtree` shared by both paths; same in `guestCategories.ts`; guest test `guestCategories.test.ts:149`. After the fix: 8/8. API spec §10.3 and SRS CAT-US-03/04 amended |
| SRS vs API spec | SRS CAT-US-01 said archived categories are excluded by default (§10.1 has no default; every mobile caller asks for `ACTIVE`); CAT-US-04 said "no hard delete" (§10.4 has `?mode=permanent`) | SRS fixed to match the higher-precedence spec |

Verification (fresh cluster, port 55442, `scratch_gaps_4e1b`): `migrate.mjs --constraints` → both suites PASS; `npm run test -w @sora/server` → 117/117; mobile 546/546; contracts 127/127; parity 40/40; mobile and server `tsc --noEmit` exit 0; plan link checker: 521 links, the 3 flagged point at a comment and a fixture on purpose. Plans: 159 covered, 27 partial, 43 gaps.

Read-only check for a dev database before applying 012. It must return 0 rows each:

```sql
SELECT id, period_type, category_id, goal_id FROM budgets
 WHERE NOT ((category_id IS NULL OR goal_id IS NULL) AND ((period_type = 'GOAL') = (goal_id IS NOT NULL)));
SELECT id, type, goal_id FROM transactions WHERE goal_id IS NOT NULL AND type <> 'EXPENSE';
```

## Fifth pass: every follow-up and every plan gap

Six agents wrote suites in parallel (separate files, each building to `server/dist/agent-<name>/`) against one throwaway cluster (port 55443, `scratch_gapfill_91c7`), then every defect they held as `todo` was fixed here and the `todo` removed.

| Item | Evidence | Result |
|---|---|---|
| New suites | `integration.{accounts,transactions,session,wallets,budgets,goals,dashboard,assistant}.test.ts`, `env.test.ts`, `contracts/test/auth-schemas.test.ts`; mobile `sqliteQueueDb`, `optimisticRecords`, `guestNoNetwork`, `chatAvailability` tests | Plans: 230 cases, 224 covered, 3 partial, 3 gaps (all device/E2E) |
| Defect: a member's 403 never reached the wallet trail (SRS WAL-US-13) | `integration.wallets` "lists a denied attempt" failed | `AppError.forbidden(role, walletId)`; `AllExceptionsFilter` audits `ACCESS_DENIED`/`DENIED` before responding; API spec §15.1, §16.1 |
| Defect: `?includeOwn=false`, `?includeShared=false`, `?tree=false` read as true | `z.coerce.boolean('false') === true` | `common/query-flag.ts`; spec §6.1, §10.1; tests `integration.wallets:381`, `integration.categories:44` |
| Defect: `TRANSFER_CURRENCY_MISMATCH` unreachable | VND→USD transfer answered `ACCOUNT_CURRENCY_MISMATCH` | Pair check first in `transactions.service.ts` and `guestTransactions.ts`; guest test added |
| Defect: inverted dashboard range answered 200 | `GET /dashboard?dateFrom=2026-12-31&dateTo=2026-12-01` → 200 | `dashboardQuerySchema` refine → 422 |
| Defect: an account with only an earmark contribution could change currency | earmark carries the account's currency with no transaction | `accounts.service.ts` checks contributions too |
| Spec drift (contract wins) | §9.4 said currency never editable; §11.2 said same-account → `TRANSFER_SAME_ACCOUNT` (schema answers `VALIDATION_FAILED`); §5.6 "random password_hash" (it's null, `chk_user_has_credential`); §2.4 omitted `/auth/google` | Spec and SRS amended |
| Category restore under an archived parent | unspecified | Refused: new `CATEGORY_PARENT_ARCHIVED` (409) in contracts, server, guest, en/vi; spec §10.3, SRS CAT-US-03, SDS |
| Persistence test deleted a snapshot by natural key | rule: delete synthetic data only by unique id | Each phase stamps `fetched_at` and waits for its own row; no delete; 2 consecutive runs pass |
| TC-AI-12 offline rule inline in a component | untestable under node | `features/chat/chatAvailability.ts` + 3 tests |
| `SqliteQueueDb` untested | needed expo-sqlite | Moved to `sync/sqliteQueueDb.ts` with an injected opener; runs on `node:sqlite` in tests |

Verification: `migrate.mjs --constraints` both PASS; `npm run test -w @sora/server` 194/194, todo 0; contracts 129/129; mobile 570/570; parity 40/40; `npm run typecheck` exit 0; `agents:check` in sync; `npx expo export --platform android` Exported; cluster stopped with `pg_ctl stop`.

## Follow-ups

- Dev databases: run the two read-only queries above before applying 012 (none reachable here).
- E2E fails in `Run flows` on every recent `main` run, before this work; read the log (`gh run view 36668880105 --log-failed`). TC-SYNC-20, TC-GST-09, TC-GST-18 wait on it.
- TC-GST-08: the guest branch is inline in every `app/store/api/*Api.ts` endpoint; covering it needs a shared helper or E2E.
- `server/dist/agent-*/` are gitignored build outputs from this pass; safe to delete.
