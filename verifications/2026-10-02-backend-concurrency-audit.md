# Backend database audit: transaction boundaries, row locks, races, query paths

**Date:** 2026-10-02T15:18:31Z
**Method:** ad hoc (three read-only audit agents by module, every finding re-checked against the code before a fix)
**Verdict:** PASS
**Scope:** every server module that touches Postgres, `server/src/**` and `db/migrations/*.sql`, for read-then-write races, missing or misplaced transactions, lock order, redundant queries and index use. It also covers E2E run `37015545287`, whose guest flows exposed a mobile bug.
**Files touched:**
- Server: `server/src/{accounts,auth,budgets,categories,common,dashboard,goals,transactions,wallets}/**`
- Server tests: `server/test/{integration.concurrency,integration.accounts,rate-limit.service}.test.ts`, `server/test/support/integration.ts`
- Contracts: `packages/contracts/src/responses.ts`
- Mobile: `mobile/src/app/providers/AuthProvider.tsx`, `mobile/src/services/guest/{guestBudgets,guestErrors}.ts`, `guestBudgets.test.ts`, `mobile/src/utils/errors.ts`, en/vi
- CI and E2E: `.github/workflows/ci.yml`, `mobile/e2e/README.md`
- Docs: `docs/API_SPECIFICATION.md`, `SDS.md` §4.6, `docs/test-plans/*`

**Related reports:** follows `2026-10-02-followups-currency-lock-dev-db-e2e.md`

## Method

- **Abstractions:** grep for `transaction()`, `forUpdate`, `forShare`, `SAVEPOINT`, `onConflict`, `isolation`, `40001`/`40P01`, and retry logic.
- **Race tests:** `server/test/integration.concurrency.test.ts` holds one side's transaction open (`whileHeld`) while the other side's request arrives over HTTP. Run on the throwaway cluster (port 55443, `scratch_gapfill_91c7`).
- **Proving the tests discriminate:** in `dist`, `lockAccountsForWrite`, `lockForArchive`, the goal re-check and `lockBudgetTarget` were turned into no-ops, then `node --import ./dist/test/setup.js --test dist/test/integration.concurrency.test.js` ran, then a rebuild.
- **Gates:**
  - `npm run test -w @sora/server`, `-w @sora/mobile`, `-w @sora/contracts`
  - `npm run typecheck`, `node scripts/check-contract-parity.mjs`, `npm run agents:check`
  - `npx expo export --platform android`
- **E2E:** `gh run view 37015545287 --log-failed` and `gh run download`; the E2E `api.log` was read for requests made by guest sessions.

## Findings

Existing shared pieces, before this pass:
- `DatabaseService.db` (Kysely, pool with a statement timeout)
- `translatingPgErrors`/`rethrowPgError` (named constraints → error codes)
- `AuditService.record(entry, trx)`, which uses a savepoint inside a caller's transaction (rule 16)
- The `forUpdate` in ownership transfer and AI confirm
- `lockAccountsInCurrency`

There was no transaction wrapper, retry layer or advisory lock, and none was needed.

| # | Finding (verified) | Severity | Verdict |
|---|---|---|---|
| 1 | `updateRole`/`remove`/`leave` checked roles unlocked, so a race with a transfer could leave a wallet with no owner (BR-01) | high | Fixed |
| 2 | Invitation accept validated outside its transaction and updated by `id` only, so it could join after a revoke; revoke could mark an accepted invite revoked (BR-08) | high | Fixed |
| 3 | Last-active-account rule: two concurrent archives could archive both | high | Fixed |
| 4 | A currency change was decided on the unlocked read, so a stale equal value skipped the check (BR-07) | high | Fixed |
| 5 | A write could land on an account or wallet archived after its pre-check | medium | Fixed |
| 6 | Login lockout counted failures only after the Argon2 await, so concurrent guesses all passed | medium (security) | Fixed |
| 7 | Contribution vs goal cancel; budget vs category archive; child category vs parent archive (write skew) | medium | Fixed |
| 8 | Transaction delete and contribution remove locked the same two rows in opposite order (40P01 → 500) | medium | Fixed |
| 9 | Permanent category delete named by any budget hit an FK violation (23503 → 500) | medium | Fixed, `409 CATEGORY_IN_USE` |
| 10 | Budget create/reactivate on an archived category was allowed (VL-03) | medium | Fixed, new `409 CATEGORY_ARCHIVED` |
| 11 | AI confirm held a pooled connection while `transactions.create` read on others, so 10 at once could starve the pool | medium | Fixed: every read runs on the confirm's transaction |
| 12 | First Google sign-in race gave `409`/`500`; `uq_users_google_id` was unmapped | medium | Fixed: one retry, mapping added |
| 13 | `email = $1` lookups could not use `uq_users_email (LOWER(email))` | medium (perf) | Fixed (login, Google, invitation) |
| 14 | Transaction list filtered on joined wallets, so neither account index applied; count and page ran sequentially | medium (perf) | Fixed: account-id filter, count and page in parallel |
| 15 | Wallet-wide budget spend filtered on the joined account; the query never used `idx_transactions_budget_scan` | medium (perf) | Fixed: `from_account_id IN (subquery)`, `status = COMPLETED` |
| 16 | Dashboard period activity read the whole ledger | medium (perf) | Fixed: UTC-day bounds, the same days as the JS rule |
| 17 | Audit rows written after their change committed (members, invitations, accounts, categories, budgets, goals, wallets) | low (LA-02) | Fixed: in the same transaction |
| 18 | Duplicate deletes/archives/cancels/revokes wrote a second audit row | low | Fixed: conditional `UPDATE` |
| 19 | Mobile: the Redux guest flag was copied in a `useEffect`, so guest screens' queries ran first and called the API with no session (E2E `api.log`: 401s at 14:10:07 and 14:10:31) | high (rule 17) | Fixed: set before the React state |
| 20 | E2E offline flow: `adb reverse` bypasses airplane mode, and successful reads re-mark the app online | test harness | Fixed: the E2E build targets `10.0.2.2:3000` |

Checked safe, with the reason:
- **Refresh-token rotation:** a compare-and-set `UPDATE … WHERE revoked_at IS NULL`.
- **Register and wallet create:** one transaction each.
- **Invitation create:** guarded by `uq_wallet_invitation_open`.
- **Budget overlap:** the GIST exclusions, mapped to 409.
- **Idempotency interceptor:** shares the first execution, keyed by user and key.
- **Snapshot upsert:** `ON CONFLICT`.
- **AI double confirm:** the message row is locked `FOR UPDATE`.

## Fixes Applied

- **1:** `lockActiveMembers`/`lockOwnerAuthority` (`members.service.ts`) are used by role change, removal, leave and transfer. Re-verified by `integration.concurrency:50`, `:73`.
- **2:** accept claims with a conditional `UPDATE` first; revoke is conditional. Re-verified by `integration.concurrency:93`.
- **3–5:** `account-write-lock.ts` (`lockAccountsForWrite`, `lockAccountForCurrencyChange`, `lockForArchive`). Re-verified by `integration.concurrency:114`, `:133` and `integration.accounts:212`, `:229`.
- **6:** `RateLimitService.beginLoginAttempt`. Re-verified by `rate-limit.service.test:47`, `:55`.
- **7:**
  - The goal `FOR SHARE` in contribution create.
  - `lockBudgetTarget` in `budgets.service.ts`.
  - `lockWalletCategories` (whose subtree is now read from the locked rows, replacing a query per level), plus the parent `FOR SHARE` in category create.
  - Re-verified by `integration.concurrency:155`, `:177`, `:195`.
- **8:** contribution remove takes the transaction row first, and its delete is conditional. Re-verified by `integration.concurrency:235` (the removal waits; the answer is 404).
- **9:** re-verified by `integration.concurrency:276`.
- **10:** contracts, server message, guest copy (create plus reactivation, including the overlap check) and en/vi. Re-verified by `guestBudgets.test:27`, `:32`, `:43`.
- **Locks removed in `dist`:** exactly the 4 dependent tests failed (`:114`, `:133`, `:155`, `:177`); after a rebuild, 11/11 pass.

Results:
- Server 210/210, mobile 577/577, contracts 129/129, parity 40/40.
- Typecheck exit 0, `agents:check` in sync, `expo export` exported.
- 13 plan cases added: 244 total, 238 covered. All 601 plan links resolve; the 7 that point at helpers or fixtures were already there.

## Follow-ups

- **19, 20:** not run yet; they need the next CI E2E run (push).
- **Goal and contribution writes don't check for an archived wallet:** the spec says an archived wallet rejects new writes. This is a behaviour gap rather than a race, so it was left out of this change.
- **Category, budget, goal and account creates check wallet-archived only before their transaction:** a create racing a wallet archive can still land. The window is narrow and the effect reversible; only transactions and recorded contributions lock the wallet row.
- **Pagination:** `GET /budgets` and `GET /goals` are unpaginated (API-05). Changing that changes the API contract, so it needs a spec decision.
- **Exchange rates:** concurrent fetches aren't coalesced and failures aren't cached, so during a provider outage each request waits the 5 s timeout.
- **Pool size:** one dashboard request can hold up to 5 connections (`Promise.all`), against a pool of 10 by default.
- **Already-linked Google account:** the email-match branch overwrites a `google_id` that is already set. This is authentication policy and out of this pass's scope.
- **Pre-existing:** `wallets.module.ts` imports the unused `RequireWalletRoleGuard` (`tsc --noUnusedLocals`).
