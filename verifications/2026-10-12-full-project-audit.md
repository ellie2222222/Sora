# Full project audit: unfinished work, rule compliance, inefficiency, correctness, spec drift

**Date:** 2026-10-12T02:41:39Z
**Method:** double-check skill (whole codebase, Phase 1 sweep delegated to five read-only agents, every fixed finding re-verified by hand)
**Verdict:** PASS (fixed findings verified; open findings listed under Follow-ups)
**Scope:** whole repo, as asked: `server/`, `mobile/`, `packages/contracts/`, `db/`, `scripts/`, docs and plans. Sweep areas: server rules and spec drift; contracts, schema and cross-layer drift; mobile rule compliance (MB-01..11, NC-04, rules 14/15); mobile correctness and performance (offline sync, caching, races, lifecycle); unfinished work, dead code and doc drift.
**Files touched:** 51 modified, 2 added (`mobile/src/utils/currentView.ts`, `currentView.test.ts`), plus this report. Listed per fix below.
**Related reports:** carries forward open follow-ups from `2026-10-09-*`, `2026-10-08-home-filters-account-sheet.md`, `2026-10-07-seed-plan-*`, `2026-10-06-wallet-time-zone.md`.

## Method

Baseline, before any change:

- `npm run typecheck`: clean.
- `node scripts/check-contract-parity.mjs`: 65/65.
- `npm run agents:check`: 11 skills in sync.
- `npm test -w @sora/contracts`: 171/171.
- `npm test -w @sora/mobile`: 693/693.
- `npm test -w @sora/server` with no `DATABASE_URL`: 66/66, all 18 integration suites skipped (`[integration] SKIPPED`).
- `node scripts/audit-runtime-deps.mjs`: **exit 1**.

Integration database: the host Postgres role cannot `CREATE DATABASE`. A throwaway cluster was used instead (rule 10 fallback):

- `initdb` into the session scratchpad, `pg_ctl` on 127.0.0.1:55437, database `scratch_audit_6d1345`.
- `node scripts/migrate.mjs` (2 applied), then `--constraints` (001, 002 PASS), then `migrate.mjs` again: up to date, so idempotent.
- Then `DATABASE_URL=postgresql://scratch@127.0.0.1:55437/scratch_audit_6d1345 npm test -w @sora/server`: **252/252**.
- `sora_dev` was not touched. Docker was running only another project's `scraper_*` containers, which were not touched.

Each finding below was re-read in the code before fixing. Each behavioural fix got a test that was run against the code before and after the change.

## Findings

### Fixed

| ID | Sev | Area | Finding → evidence | Verdict |
|---|---|---|---|---|
| A1 | critical | deps | `audit-runtime-deps` failed on proxy-addr 2.0.7 (GHSA-jqcg-44mw-7w3h, express → server), shell-quote 1.9.0 (GHSA-pqg4-j6r4-53mv, pinned by concurrently 10.0.5), source-map-js 1.2.1 (GHSA-68fv-2mgg-jv7q). Fixed releases fall inside the existing ranges | Fixed |
| A2 | medium | LA-01 | `auth.service.ts` logged `error.message` from `verifyIdToken`. `google-auth-library` `oauth2client.js:692,732` puts the raw JWT in that message | Fixed |
| B1 | medium | contracts | `isoDateSchema` accepted `2026-02-30`, `2026-13-01`, `2025-02-29`, `0000-01-01`. These became Postgres 22008 (500) on budgets/goals/`activeOn`, a `RangeError` 500 in `nextDay` on `/transactions?dateTo=`, or a silently rolled day on the dashboard | Fixed |
| B2 | medium | rule 1 | A JSON-number amount was rounded by float64 before validation and then stored: `100000000000000.01` → `"100000000000000.02"` (reproduced) | Fixed |
| B3 | low | VL | Email had no length cap. A 255–260 char address passes Zod and hits `VARCHAR(255)` → 22001 → 500 | Fixed |
| C1 | medium | AC-01 | `PATCH /transactions/{id}` and `POST .../delete` gave a non-member `ACCOUNT_NOT_FOUND` for a real id, `409 TRANSACTION_ALREADY_DELETED` for a deleted one, and `TRANSACTION_NOT_FOUND` for a made-up one. New test reproduced it: `actual [404,'ACCOUNT_NOT_FOUND']` | Fixed |
| C2 | medium | LA-02 | Audit rows from transactions, accounts, budgets, goals and contributions had `actor_role = NULL`; the role was resolved but dropped | Fixed |
| C3 | medium | perf | `GET /accounts` read the full ledger of every account in every reachable wallet to fill one page, ignoring the `status`/`type` filters | Fixed |
| C4 | low | LA-02/spec | A repeat `PATCH status=ARCHIVED` wrote a second `ACCOUNT_ARCHIVED` row. §9.4 named neither that event nor `409 ACCOUNT_LAST_ACTIVE` | Fixed |
| D1 | high | mobile sync | A backed-off `failed` update did not hold back later rows for the same record, so an older partial PATCH replayed after a newer one and undid it. New test against HEAD's engine: fails | Fixed |
| D2 | high | mobile sync | A queued GOAL budget's `goalId` (and a transaction's) was not remapped from the offline goal's local id, so it hit a 404 and was parked as conflict. New test against HEAD: fails | Fixed |
| D3 | low | mobile sync | `selectQueueEntryFor` returned a record's oldest row, so a synced create hid a failed edit's dot. The existing test pinned this as "current behaviour" | Fixed |
| D4 | medium | RTK tags | A wallet time-zone change did not invalidate `Budget`/`Dashboard`. Transaction writes did not invalidate `GoalContribution` (a stale row's remove gives 404). The sync runtime's `goal` set lacked `Dashboard` | Fixed |
| D5 | medium | RTK focus | `refetchOnFocus` never fired on native: RTK's default `setupListeners` binds only when `window.addEventListener` exists (`rtk-query.legacy-esm.js:478`) | Fixed |
| E1 | high | mobile UI | Budget/Account/Goal detail sheets read `data`, which RTK 2.12 keeps from the previous id while the next loads (`queryStatePreSelector`, `isLoading` false). The sheet showed entity A while Delete/Archive/Cancel targeted B | Fixed |
| E2 | medium | mobile UI | Planning showed the previous wallet's budgets and goals after a switch (and kept them offline), and swipe actions acted on them | Fixed |
| E3 | medium | mobile UI | AI chat: "New chat" and deleting the open chat left the old messages up; their proposals could be confirmed against another conversation id | Fixed |
| E4 | medium | mobile UI | `CategoryGrid` read `data`, so switching transaction type auto-picked a category of the old type → 422 | Fixed |
| E5 | medium | mobile UI | The add-contribution account picker was not scoped to the goal's wallet (spec §13). Its default could be refused | Fixed |
| E6 | medium | mobile UI | Leave/archive wallet and transfer ownership used a bare `ConfirmDialog`: a double tap sent twice, and an error rendered under the open dialog | Fixed |
| E7 | medium | mobile UI | `AddAccountModal` reset on every new `activeWallet` identity (any refetch), wiping typed input. It also took its currency from the active wallet even when `walletId` named another | Fixed |
| E8 | medium | MB-02 | `WalletEditCard`, `GoalEditCard` and `AccountEditForm` copied server values into state once, so a refetch made them dirty and Save wrote stale values back. The wallet's zone could be overwritten with the device zone | Fixed |
| E9 | high | a11y | Five icon-only buttons had no accessible name: date-picker month arrows, wallet Activity/Categories/Add account | Fixed |
| E10 | low | rule 18 | `InvitationRow` showed `expiresAt.slice(0, 10)`, a raw UTC date | Fixed |
| E11 | medium | MB-09 | `AuthNavigator` had a hardcoded `title: 'Invitation'` | Fixed |
| E12 | low | UI | The transaction detail sheet kept the previous row's delete error | Fixed |
| E13 | low | UI | Goal contributions showed "No contributions yet." while loading and after a failed first page | Fixed |
| E14 | low | dead code | Unused `AddBudgetModal` import in `AppNavigator.tsx` | Fixed |
| F1 | low | doc drift | Spec §11.4 listed `422 CATEGORY_WRONG_WALLET`; the contract says 403 | Fixed |
| F2 | low | doc drift | `DESIGN_GUIDELINES.md` said `caption` = `xs`; `Text.tsx:29` maps it to `sm` | Fixed |
| F3 | low | doc drift | README cited `contracts/src/enums.ts` | Fixed |

### Checked and correct (evidence, not re-checked here)

- **AC-01 joined lookups:** `require`, `requireAccount`, `requireGoalAccess` and `requireBudgetAccess` each give one 404 code for missing and not-visible.
- **AC-03/BR-02:** create checks every account's wallet; a money-moving edit checks before and after and audits the union.
- **Rule 16:** `AuditService.record` wraps its insert in a SAVEPOINT.
- **Rule 3:** ownership transfer demotes before it promotes, under `FOR UPDATE`.
- **AC-05/LA-03:** one filter logs every 401/403 at WARN.
- **API-05:** every list pages, max 200.
- **API-01/04:** no literal route strings, and no error code invented at a call site.
- **SQL:** every `sql` template is parameterized.
- **calc.ts:** `budgetWindow` was run over month-ends, leap years and YEARLY from Feb 29, with no gaps.
- **calendar.ts:** checked against DST in 7 zones, Kathmandu (+05:45) and Lord Howe (30-minute shift).
- **money.ts:** edge inputs give the right result.
- **Rule 15:** no function `style` anywhere.
- **MB-01/04/05/06/10:** clean.
- **Readability floors:** clean.
- **Sync:** refresh is single-flight, the read cache is isolated by account (rule 17), and the queue is keyed by owner.
- **Docs and config:** CI references are all valid; `.env.example` matches `env.ts`; all 59 spec endpoints match the controllers one-to-one; 1,106 markdown links resolve (apart from the stale `mobile/MODAL_UI_STATE.md`).

## Fixes Applied

**A1:**
- `npm update proxy-addr shell-quote source-map-js concurrently` (lockfile only): proxy-addr 2.0.8, source-map-js 1.2.2, concurrently 10.0.6 → shell-quote 1.12.0.
- Re-run `node scripts/audit-runtime-deps.mjs`: exit 0, "no unaccepted high or critical advisories (2 accepted)".

**A2:** `server/src/auth/auth.service.ts` logs only the error's `name`.

**B1–B3:**
- `packages/contracts/src/calendar.ts` gains `isCalendarDay`. `isoDateSchema` refines on it.
- `schemas.ts`:
  - shared `emailSchema` capped at 254 (register, login, invite)
  - a number amount must be below 1e11 (15 significant digits)
- Spec §2.2, §2.3 and the two email rows are updated.
- Tests in `packages/contracts/test/schemas.test.ts`: impossible dates, number precision, the 254 cap. 174/174.

**C1:**
- `transactions.service.ts` gains `visibleRow`, which runs `detail`'s visibility rule before the deleted check in `update`/`delete`.
- Spec §11.4/§11.5 updated.
- New test in `integration.access.test.ts`: failed before the fix, passes after.

**C2:**
- `actorRole` passed in accounts/budgets/goals/goal-contributions services.
- `auditTransaction` takes a wallet→role map, so a cross-wallet transfer records each side's role.
- New integration test reads `audit_logs` back: no NULL role, and EDITOR on an editor's write.

**C3:** `accounts.service.ts#list` computes balances for the page's rows only, via `balancesForAccounts` (now public). The accounts, ledger, pagination and wallets suites pass (42/42), including cross-wallet transfer balances.

**C4:** `accounts.service.ts#update` records `ACCOUNT_ARCHIVED` only when `lockForArchive` actually archived. Spec §9.4 updated.

**D1/D2:**
- `syncEngine.ts#runSyncPass` walks every unsynced row FIFO. A record whose row is backing off, parked, deferred or failed holds back its later rows; other records go on.
- `goalId` was added to the budget and transaction reference fields.
- Two new tests. Both were run against `git show HEAD:…/syncEngine.ts`: 2 fail. Against the fix: 23/23.

**D3:** `offlineQueueSlice.ts` returns a record's first still-waiting row; the pinning test was rewritten.

**D4:**
- `transactionsApi.ts` `TRANSACTION_TAGS` and the matching `syncEngineRuntime.ts` set gain `GoalContribution`.
- The `goal` set gains `Dashboard`.
- `walletsApi.ts` `updateWallet` gains `Budget` and `Dashboard`.

**D5:** `syncEngineRuntime.ts` dispatches `apiSlice.internalActions.onFocus()` after the pass that follows a background→active change. It runs after the pass so a refetch never drops pending offline patches, and it is skipped when reconnect already refreshes everything.

**E1–E4:**
- New `mobile/src/utils/currentView.ts`: an active view reads `currentData` and reports loading; a closing one keeps the last result for its slide-out. 5 tests.
- Used in `BudgetDetailModal`, `AccountDetailModal`, `GoalDetailModal` (goal and contributions), `PlanningScreen` (which also shows the offline state when it has nothing current), and `AiChatScreen`.
- `CategoryGrid` reads `currentData`, as `AccountPicker` already did.

**E5:** `AddContributionModal` passes `walletId={goalData.walletId}` to `AccountPicker`. The now-redundant `walletId` state was removed.

**E6:** `WalletDetailPanel` and `WalletMembersPanel` (transfer) use `MutationConfirmDialog`.

**E7:** `AddAccountModal` resets on `walletId`, and its currency comes from the target wallet.

**E8:** The three edit forms hold only edited values; the field otherwise shows the saved value (the `BudgetEditCard` pattern). They reset after a save.

**E9:** Each of the five buttons gets `accessibilityRole="button"` and a label from an existing key (`common.previousPeriod`/`nextPeriod`, `activity.title`, `categories.title`, `accounts.addAccount`).

**E10:** `InvitationRow` uses `formatDay(dayOfDate(new Date(expiresAt)))`.

**E11:** New key `invitations.title` in all 10 locales. `localeParity`/`plurals` tests pass (13/13).

**E12:** The delete error is tagged with its transaction id.

**E13:** The empty slot shows nothing while loading, and a `StateView` with retry when the first page fails.

**E14:** The unused import was removed.

**Final run (all after the last edit):**
- `npm run typecheck`: exit 0, 0 errors.
- Parity: 65/65.
- `agents:check`: in sync.
- Dependency audit: clean.
- contracts: 174/174.
- mobile: 700/700.
- server with the integration database: **254/254**.
- The first final server run failed 110 tests: the scratch cluster had crashed at 00:25 ("startup process failure" in its log). After `pg_ctl start` the same command passed 254/254. The cluster was stopped afterwards.

## Follow-ups

Ordered by risk. "Decision" means it needs a product or contract call before code.

1. **Offline conflicts can't be resolved (high, decision).**
   - A `conflict` row is never retried or discarded: no UI, and `OfflineQueue` has no discard.
   - Any refetch hides still-open offline rows, because nothing merges them back into lists.
   - Needs a conflict-resolution design: discard/retry UI, plus a merge of open creates into lists.
2. **Lost update on concurrent transaction edits (medium).**
   - `transactions.service.ts#update` reads the row unlocked and `updateMovement` rewrites every column from it. Two editors' simultaneous edits can silently drop one amount.
   - Fix shape: `SELECT … FOR UPDATE` on the row inside the write transaction, then re-check from it.
   - Not done this pass: it is the core ledger write path and needs its own concurrency test.
3. **Duplicate creates on a manual retry (medium).**
   - The online create paths mint a fresh idempotency key per call (`services/api/client.ts:137`). A Save retried after a lost response records twice.
   - The server's idempotency store is in memory (lost on restart, no size cap).
4. **Archived references on transactions (medium, decision).**
   - Transaction create/edit accept an ARCHIVED category or a COMPLETED/CANCELLED goal tag.
   - VL-03 says 409; budgets and the AI path enforce it. Spec §11.2 is silent.
   - The decision: should an edit of an old row keep an archived category?
5. **Born-`DELETED` transactions (decision).**
   - `POST /transactions` accepts `status: DELETED`, which skips §11.5's delete event and reason.
   - Guest upload (`guestUpload.ts:227`) relies on it. A restriction was tried and reverted when typecheck showed that.
   - Either document it in §11.2 or have upload create then delete.
6. **Test-plan line references (high for the traceability gate).**
   - ~133 of 711 `#L` refs in `docs/test-plans/` point at the wrong test. This pass's two new tests in `integration.access.test.ts` and `schemas.test.ts` shift a few more.
   - The agent applying the corrections hit a rate limit before editing anything; the directory is unchanged.
7. **`plans/architecture/domain-database-design.md` §14 contradicts the schema (high, doc).**
   - Wrong member/transaction statuses, missing tables and constraints, non-existent `chk_*`.
   - CLAUDE.md routes schema changes through it. Replace the copy with a pointer to the migrations, or regenerate it.
8. **Other doc drift (medium/low):**
   - CLAUDE.md Data Safety says no contribution is hard-removed; spec §13.8 and the code remove them. A rule change, so for the owner.
   - MB-03 says RHF, but only login/register use it.
   - AGENTS.md / `.agents/rules` lack VL, LA, Configuration and Security sections.
   - `docs/ERROR_CODES.md` prescribes codes that don't exist.
   - SDS error catalog and §8 mapping are stale (`/cancel`, 49 vs 53 stories, no AI).
   - Plan checkboxes: `timezone.md` and `ai-chat-assistant-plan.md` are built but unchecked; the multi-currency converted-total UI is marked Implemented but not built.
   - `plans/README.md` index.
   - `mobile/GAPS.md`, `mobile/MODAL_UI_STATE.md`.
   - Spec index missing `POST /auth/google` and `PATCH /auth/me/preferences`.
   - Spec §2.6 says a bad query is `400`; the filter maps it to `VALIDATION_FAILED`. Not run, so not changed.
9. **Contracts gaps (low):**
   - `page` has no upper bound (`?page=1e20` → 500).
   - `isTimeZone` accepts zones Postgres may have dropped. Suspected, not run against the database.
   - `resolvePeriod` is duplicated in the server and in guest mode, and the copies have diverged.
   - `AuditResult` is not a contracts tuple, so parity doesn't check `chk_audit_result`.
   - Small rule-7 duplicates: `categories.service.ts:349`, `utils/money.ts:168`, `calculatorEngine.ts:14`, `pagination.ts`.
10. **Parity and db/tests blind spots (medium):**
    - Parity never compares Zod `.max()` with VARCHAR sizes, and its route check only greps segments.
    - About 25 constraints have no probe in `db/tests`.
    - `expect_reject` accepts any error, not the named constraint.
11. **Mobile, not fixed:**
    - The queue never deletes synced rows (O(n·total) re-reads).
    - Offline creates are unshifted into every cached list whatever its filters.
    - Offline non-money edits patch the cache imprecisely.
    - Logout with an expired access token leaves the rotated refresh token live.
    - Home and Dashboard anchor their day to the device zone at mount (rule 18).
    - Pickers have no error state (`CategoryGrid`, `AccountPicker`).
    - Budget/goal currency silently takes the wallet's first balance.
    - The WEEKLY date chip in `AddBudgetModal` does nothing.
    - `CategoryListScreen` uses the active wallet's permissions for a route-param wallet.
    - `AddCategoryModal` doesn't reset when reopened.
    - ~25 off-table testIDs and missing `sheet-*` ids. Renaming them needs Maestro updates.
    - `%`/word-order concatenations (`BudgetCard.tsx:42`, `toLowerCase()` on German nouns).
    - `PeriodSummaryCard` recomputes un-memoised.
12. **Dead code left in place (deleting files needs the owner's say):** `CategoryPicker.tsx`, `FadeIn.tsx`, `optimisticMutation.ts`, `GuestUploadTask`, `MONEY_DECIMALS`, `PreviewInvitationRequest`, the guest `displayCurrency` branch, `en.ts` `valuation: {}`, and the root `lint` script (no workspace defines `lint`).
13. **Not seen on a device:**
    - D5 foreground refetch.
    - The E1–E3 sheet and switch behaviour.
    - E6 dialogs.
    - E9 screen-reader output.
    - Unit and integration tests cover the logic, not the rendered result.
14. **Scratch cluster:** stopped. Its data directory is in the session scratchpad (`pgcluster/`), outside the repo, and nothing references it. It was not deleted.
15. **Carried forward:**
    - Native-speaker review: Vietnamese copy, chart ticks.
    - The `relationLabel` meaning (product).
    - Row times follow the device zone (product, `2026-10-06-wallet-time-zone.md`).
    - First-currency picks on dashboard cards (product).
    - Metro stall cause unknown.
    - Seed Phase 9 dev loader not built.
