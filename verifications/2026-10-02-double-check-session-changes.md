# Double-check of the test-suite audit work: budget kinds, denial audit, query flags, new suites

**Date:** 2026-10-02T11:01:23Z
**Method:** double-check skill
**Verdict:** PASS
**Scope:** every uncommitted change from this session: the audit fixes, budget kinds and goal tags, the `ACCESS_DENIED` audit, query flags, the category restore rule, the account currency rule, the new integration and mobile suites, and the test plans. Phase 1 ran because shared modules changed (`AppError`, the exception filter, `budget-spend.ts`, guest storage).
**Files touched:** `mobile/src/services/guest/{guestStore,guestCategories,guestAccounts,testSupport}.ts`, `mobile/src/services/guest/{guestStore,guestCategories,guestDerived,guestTransactions,guestAccounts}.test.ts`, `mobile/src/utils/money.ts` (comments only), `mobile/src/services/sync/offlineQueueDb.ts` (header), `server/src/categories/categories.service.ts`, `server/src/budgets/budget-spend.ts`, `server/src/dashboard/dashboard.service.ts`, `server/src/goals/goal-contributions.service.ts`, `server/src/wallets/members.service.ts`, `server/src/accounts/accounts.service.ts`, `server/src/common/app-error.ts`, `server/src/audit/audit-events.ts`, `server/test/{setup,integration.categories,integration.wallets,integration.dashboard}.ts`, `docs/API_SPECIFICATION.md`, `SDS.md`, `docs/test-plans/{accounts,categories,guest}.md` plus re-pointed links
**Related reports:** follows `2026-10-02-test-suite-audit.md` (its open follow-ups are carried forward below)

## Method

A read-only general-purpose agent swept the changed files against CLAUDE.md Part 5 and Part 7. It checked dead code, duplication, comment rules, rules 1/2/14/15/16, test hygiene, and drift across contracts, server, guest copy, locales and spec. It also ran `check-contract-parity.mjs` and `npm run typecheck`. Every finding was re-checked against the live code before it was fixed.

Phase 2 ran on a throwaway cluster (embedded Postgres 17.10, scratchpad, port 55443, `scratch_gapfill_91c7`), with these commands:

- `node scripts/migrate.mjs --constraints`
- `npm run test -w @sora/server`, `npm run test -w @sora/mobile`, `npm run test -w @sora/contracts`
- `node scripts/check-contract-parity.mjs`
- `npm run typecheck`
- `npm run agents:check`
- `npx expo export --platform android`
- the plan link checker (every `#L` link must land on a test or probe line)

## Findings

| # | Finding | Verdict |
|---|---|---|
| 1 | Guest blob saved before goal tags: `goalId` reads `undefined`, so `sameTarget`'s `=== null` skips old budgets and the BR-04 overlap check misses them | Fixed |
| 2 | Account currency change is check-then-update; a transaction inserted in between leaves the ledger in two currencies | Reported (follow-up). Error text corrected |
| 3 | Guest `update` silently dropped `currency`, unlike the server | Fixed |
| 4 | Archive checked active budgets on the root only; a child with an active budget was archived anyway. The PATCH archive was not atomic | Fixed |
| 5 | Contribution from another wallet's account recorded `ACCESS_DENIED` with the role on the wrong wallet | Fixed |
| 6 | Ownership transfer: a caller revoked meanwhile got 403 with a made-up `VIEWER` role instead of 404 | Fixed |
| 7 | `TRANSFER_SAME_ACCOUNT` is unreachable (the schema refine answers first) | Kept as a documented backstop: removing it would edit inactive locales (rule 13). SDS and spec wording corrected |
| 8 | A lone `dateFrom` after the current month's end inverted silently; §14.1 omitted the 422 and `period` | Fixed |
| 9 | `spendableExpenses` had no date bound, so a wallet-wide budget loaded the whole ledger | Fixed |
| 10 | Stale comments: `money.ts` (TRANSFER "excluded by construction"), a "what" comment, `offlineQueueDb.ts` header, `setup.ts` | Fixed |
| 11 | `codeOf` copied in 3 guest tests | Fixed. The per-suite `transact`/audit helpers differ by fixed dates, so they were left |
| 12 | `ToastProvider` deep import of `design-system` | Clean: `tsconfig` has no `@/design-system` alias; same as ThemeProvider |
| 13 | `deniedWalletId` was mutable | Fixed (readonly, set by constructor) |
| 14 | No test that a non-member's 404 writes no `ACCESS_DENIED` | Fixed |

Checked clean by the sweep:

- Rule 16: the denial audit runs in the filter after the service transaction rolled back, with no executor.
- Rule 2: every `forbidden()` site runs after a membership row resolved.
- Rule 1: no money passes through `Number()`.
- Rules 14 and 15: nothing found.
- No `todo` or `skip`; every test SQL write targets a probe id.
- `CATEGORY_PARENT_ARCHIVED` is present in all registries.

## Fixes Applied

| Finding | Change | Re-verified by |
|---|---|---|
| 1 | `guestStore.ts` `withStoredDefaults` | `guestStore.test.ts:64` |
| 3 | `guestAccounts.ts` `update` mirrors the server rule | `guestAccounts.test.ts:17` |
| 4 | `categories.service.ts` `archivableSubtree` checks the subtree, and update, cascade and both audit rows share one transaction; same subtree check in `guestCategories.ts` | `integration.categories:148`, `guestCategories.test.ts:151` |
| 5 | `goal-contributions.service.ts` uses the role on the goal's wallet | full server suite |
| 6 | `members.service.ts`: a missing caller now gets `WALLET_NOT_FOUND` | full server suite |
| 8 | `dashboard.service.ts` `resolvePeriod` refuses a resolved inversion; spec §14.1 | `integration.dashboard:186` (lone `dateFrom=2999-01-01` → 422) |
| 9 | `budget-spend.ts` bounds `transaction_date` to `[earliest start 00:00Z, day after latest end 00:00Z)`, matching `isWithinPeriod`'s UTC calendar days | budget and dashboard tests unchanged and passing |
| 14 | assertion added | `integration.wallets:361` |

The test-plan links were re-pointed after the line shifts (66 links). The checker reports 625 links, and the 2 flagged lines point at a comment and a fixture on purpose.

Results:

- `migrate.mjs --constraints`: both suites PASS.
- Server 195/195, todo 0. Mobile 573/573. Contracts 129/129. Parity 40/40.
- `npm run typecheck` exit 0. `agents:check` in sync. `expo export` Exported.
- Cluster stopped (`pg_ctl stop`, port closed).

## Follow-ups

- Finding 2: making the currency change race-free needs the transaction create path to re-read the account currency under a row lock, or a trigger. It's a narrow window on an empty account, so left for a decision.
- Carried from `2026-10-02-test-suite-audit.md`:
  - Run the two read-only checks against dev databases before migration 012.
  - Read the failing E2E job log (`gh run view 36668880105 --log-failed`). TC-SYNC-20, TC-GST-09 and TC-GST-18 wait on it.
  - TC-GST-08 needs a shared guest-routing helper or E2E.
- `server/dist/agent-*/` are gitignored build outputs from the parallel pass, safe to delete.
