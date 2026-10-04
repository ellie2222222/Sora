# Backend audit follow-ups: creates vs wallet archive, exchange-rate coalescing, budget/goal paging, Google re-link

**Date:** 2026-10-03T06:38:54Z
**Method:** ad hoc
**Verdict:** PASS
**Scope:** the open follow-ups of `2026-10-02-backend-concurrency-audit.md`, including the three the owner decided on 2026-10-03 (paginate budgets and goals with the app fetching all pages; refuse re-linking a different Google account; an archived wallet refuses creates and ledger writes only)
**Files touched:**
- Server: `server/src/wallets/{wallet-access.service,wallets.module}.ts`, `server/src/{accounts/accounts,categories/categories,budgets/budgets,goals/goals,goals/goal-contributions,auth/auth}.service.ts`, `server/src/{budgets,goals}/*.controller.ts`, `server/src/exchange-rate/exchange-rate.service.ts`, `server/src/common/app-error.ts`
- Contracts: `packages/contracts/src/responses.ts` (`GOOGLE_ACCOUNT_MISMATCH`)
- Mobile: `mobile/src/services/api/{client,budgets,goals,collectPages}.ts`, `collectPages.test.ts`, `mobile/src/utils/errors.ts`, en/vi
- Server tests: `server/test/{integration.concurrency,integration.budgets,integration.goals,integration.session,exchange-rate.service}.test.ts`
- Docs: `docs/API_SPECIFICATION.md` §5.6, §6.5, §10.2, §12.1, §12.2, §13.1, §13.2, §13.8; `SRS.md` WAL-US-12; `SDS.md` §4.5, §4.6, error catalog; `docs/test-plans/*`

**Related reports:** follows `2026-10-02-backend-concurrency-audit.md`

## Method

- Race test: `integration.concurrency:212` holds `UPDATE wallets SET status = 'ARCHIVED'` open, then each create arrives over HTTP (`whileHeld`). Run on the throwaway cluster (port 55443, `scratch_gapfill_91c7`).
- Discrimination: `lockWalletWritable` made a no-op in `dist/src/wallets/wallet-access.service.js`, then `node --import ./dist/test/setup.js --test dist/test/integration.concurrency.test.js`, then a rebuild.
- Gates:
  - `npm run test -w @sora/server` with `DATABASE_URL` on the scratch database
  - `npm run typecheck`
  - `node scripts/check-contract-parity.mjs`
  - A plan-link check: every `docs/test-plans/*.md` link resolves, and its `#L` line is in range.

## Findings

| # | Follow-up carried forward | Observed | Verdict |
|---|---|---|---|
| 1 | Goal and contribution writes don't check for an archived wallet | Goal create already calls `requireWritable` (`goals.service.ts:64`). §13.7 lists `WALLET_ARCHIVED` only when `recordAsTransaction` is true, and the code does the same; an earmark moves no money. Updates and archives elsewhere don't check either (accounts, categories, budgets), so goals follow the same pattern. | Not a defect; finding withdrawn |
| 2 | Account, category, budget and goal creates checked wallet-archived before their transaction only | A wallet archive committed between `requireWritable` and the insert let the row land in an archived wallet | Fixed |
| 3 | Exchange-rate fetches weren't coalesced, and failures weren't remembered | During an outage every dashboard request with `displayCurrency` waited the full `EXCHANGE_RATE_TIMEOUT_SECONDS` | Fixed |
| 4 | `wallets.module.ts` imported `RequireWalletRoleGuard` without using it | Only the doc comment names it | Fixed |
| 5 | §10.2, §12.2 and §13.2 didn't list `409 WALLET_ARCHIVED`, though `requireWritable` has always thrown it | Spec drift | Fixed |
| 7 | `GET /budgets`, `GET /goals` unpaginated (API-05) | Owner decision: paginate; the app fetches every page | Fixed |
| 8 | Google sign-in by email overwrote an already-linked `google_id` | Owner decision: refuse | Fixed, new `409 GOOGLE_ACCOUNT_MISMATCH` |
| 9 | What "an archived wallet rejects new writes" covers | Owner decision: creates and ledger writes only. Transaction create/edit/delete already refuse (`requireAccountsWritable`), but removing a transaction-backed contribution deleted its backing transaction without that check. | Spec clarified; the contribution path fixed |
| 6 | One dashboard request can hold up to 5 of the pool's 10 connections | `dashboard.service.ts:88` runs five independent read queries, each through `this.database.db`; each borrows and releases its own connection, and none waits on another while holding one (unlike the old AI confirm, finding 11 of the 2026-10-02 report). A burst queues in the pool for up to `DATABASE_CONNECTION_TIMEOUT_MS`. The same holds for the other `Promise.all` read fan-outs (`wallets.service.ts:245`, `budgets.service.ts:311`, `accounts.service.ts:122`). | Not a defect; throughput only |

## Fixes Applied

- **2:**
  - `lockWalletWritable(trx, walletId)` (`wallet-access.service.ts`) share-locks the wallet row and re-checks its status.
  - Called first inside each create's transaction: `accounts.service.ts`, `categories.service.ts`, `budgets.service.ts`, `goals.service.ts`.
  - Re-verified by `integration.concurrency:212`: each of the four creates waits, then gets 409 `WALLET_ARCHIVED`, and its table's row count is unchanged.
  - With the lock disabled in `dist`, that test alone failed (11 pass, 1 fail). After a rebuild, 12/12 pass.
- **3:**
  - `ExchangeRateService.fetchLatest` keeps one in-flight request per base currency.
  - After a failure, `markFailed` skips the provider for 60 s; until then callers go straight to the stale fallback.
  - Re-verified by `exchange-rate.service.test:222` (3 concurrent lookups, 1 fetch) and `:240` (no fetch during the cooldown, one fetch after it).
- **4:** import removed; `npm run typecheck` exit 0.
- **5:** error lists amended. SDS §4.6 gains the wallet-row lock, and §4.5 gains coalescing and the cooldown.
- **7:**
  - Both list queries take `page`/`pageSize` (default 25, max 200) and return `meta.pagination`; ordered with an `id` tie-break, with count and page in parallel.
  - The app's `getAll` (`client.ts`) follows `hasMore` through `collectPages`, so the Planning screen and the budget picker still get every row.
  - Re-verified by `integration.budgets:117`, `integration.goals:139` (2 pages, totals, nothing repeated or skipped) and `collectPages.test:17`, `:25`, `:32`.
- **8:**
  - Linking is a conditional `UPDATE … WHERE google_id IS NULL OR google_id = <this one>`, so a concurrent sign-in by the same Google account still links, and a different one gets 409.
  - Contracts, server message, mobile mapping, en/vi, §5.6 and the SDS catalog updated.
  - Re-verified by `integration.session:254`.
- **9:**
  - Contribution removal takes `lockWalletWritable` before deleting a backing transaction.
  - §6.5, §13.8 and SRS WAL-US-12 spell out the rule.
  - Re-verified by `integration.goals:237`.
- **Guards removed in `dist`:** with the Google condition and `lockWalletWritable` disabled, exactly the two new tests failed (`integration.session:254`, `integration.goals:237`). After a rebuild, 33/33 in the three suites pass.

Results:
- Server 215/215, mobile 580/580, contracts 129/129.
- Typecheck exit 0; parity 40/40; `agents:check` in sync.
- 656 plan links, 0 broken. The 3 that don't land on a test title point at fixtures, as before.
- Plans: TC-WAL-35, TC-DASH-22, TC-BUD-20, TC-SAV-22, TC-SAV-23 and TC-AUTH-30 added, giving 250 cases, 244 covered.

### Second pass: the remaining unpaginated lists

`GET /wallets`, `/accounts`, `/categories`, `/wallets/{id}/members` and `/wallets/{id}/invitations` now page the same way, under the owner's earlier decision.
- **Shared query shape:** `pageQuery` and `offsetOf` in `server/src/common/pagination.ts`, used by every server-local list schema.
- **Wallet list:** the own/shared filter moved into SQL, so it can page.
- **Categories:** `?tree=true` still returns the whole tree, unpaged, because a page of a tree would cut children off from their parents.
- **App:** all five list calls use `getAll`.
- **One test fix:** a new wallet gets 38 starter categories, more than the default page of 25, so `integration.categories:57` now asks for `pageSize=200`.
- Re-verified by `integration.pagination:41` (walks each list 2 or 10 per page and compares against SQL) and `:75` (the tree comes back whole).
- Results: server 217/217, mobile 580/580, typecheck exit 0, parity 40/40, 663 plan links with 0 broken. Plans now have 254 cases: 249 covered, 2 partial, 3 gaps. The README total row had said 255 and 3 partial; recounted from the plan rows and corrected.

### E2E run `37105774939` (first run with the guest and offline fixes)

`gh run view 37105774939 --log-failed`: 3 of 7 flows passed (sign-in relaunch, add expense, pull to refresh), 4 failed. Artifacts came from `gh run download 37105774939`.

| # | Observed | Cause | Fix |
|---|---|---|---|
| 10 | The 3 guest flows fail at `btn-add-transaction`. The screenshot shows the guest's "Your wallet" home with "No transactions yet" and a "+ Create" button. | The guest home now renders, which confirms the 401 fix from 2026-10-02 (finding 19). An empty list shows `home-empty-action` instead of the floating `btn-add-transaction` (`TransactionListScreen.tsx:130`, `showFab`), and the guest starts with no rows. | `subflows/add-expense.yaml` taps whichever of the two is visible; both call `onAddTransaction`. |
| 11 | The offline flow fails at `option-category-.*`. The sheet shows no categories and "Select an account". | A saved copy exists only for a read that has run (`readSignedIn`). The sheet's category read `{walletId, type, status: ACTIVE}` and account read never ran online, so offline there was nothing to read. This is a real product gap, not only a test one. | `useWarmAddTransactionReads` (on the transaction list) prefetches the sheet's account read and its three category reads for the active wallet while signed in. SDS §4.3 records it. |

Verified locally: `tsc -p mobile` exit 0, mobile 580/580, `expo export` exported. The device-level proof is the next E2E run.

### Permission matrix

Asked whether auth, shared-wallet and permission tests were complete.
- **Auth and wallet behaviour:** every case in `auth.md` (30) and `wallets.md` (36) is automated.
- **Permissions:** coverage was uneven before this pass. The access suite checked a stranger's 404 on detail reads and one write, VIEWER 403 on 6 writes, and EDITOR 403 on invite and the audit log only.
- **Untested before this pass:**
  - VIEWER on account, category, budget and goal edit and archive, budget create, and contribution removal.
  - EDITOR on wallet rename and archive, member role change and removal, ownership transfer, and listing and revoking invitations.
  - A stranger on most writes and on the category, goal and transaction lists.
- **Added:** `integration.access:148`, one table-driven test over 33 wallet-scoped routes. A stranger gets 404, and each role below the route's minimum gets 403 `FORBIDDEN`. Afterwards the shared wallet, its member roles and the fixture transaction are read back unchanged.
- **Discrimination:**
  - With goal edit lowered to VIEWER in `dist`, the test failed (`VIEWER PATCH /goals/…`).
  - With only the wallet rename's route guard lowered to EDITOR, it still passed. That is correct: `WalletsService.update` re-checks OWNER, so the behaviour didn't change.
- **Plans:** TC-WAL-37 added. The two plan links to `integration.access:148` (cross-wallet category) now point at `:226`. Totals are 255 cases, 250 covered.
- Server 218/218.

### Self-review of `1b45d65..2144bdc` and the uncommitted matrix

- **Checked and correct:**
  - Every new list orders with an `id` tie-break.
  - Each count query uses the same filters as its rows. The member count has no `users` join, but `wallet_members.user_id` is a non-null FK, so the totals match.
  - Empty and short-circuit cases still return `meta.pagination`.
  - `transferOwnership` still returns the full member list, since `rows()` pages only when given a page.
  - `useWarmAddTransactionReads` runs before any early return, uses the sheet's exact arguments (`AccountPicker.tsx:45`, `CategoryGrid.tsx:35`), and is skipped for guests.
  - The Google link's conditional `UPDATE` still lets the same Google account through.
- **Fixed — the E2E subflow could miss the add button.** The `runFlow: when: visible` conditions added in `2144bdc` are checked once, with no wait, so a list still loading would leave neither button tapped. `subflows/add-expense.yaml` now waits for `btn-add-transaction|home-empty-action` (Maestro ids are regular expressions), then taps it. CI run `37108044161` was built before this fix.
- **Fixed — `collectPages` could loop forever.** A server answering `hasMore: true` with empty pages would never end it; it now also stops at an empty page. Re-verified by a new case in `collectPages.test`; mobile 581/581.
- **Noted, not changed:**
  - The offline flow waits for the list and animations, not for the prefetches themselves; Maestro can't observe those. They start on the same mount as the list's own read.
  - `accounts.service` computes balances for every account in the requested wallets on each page. That's a few accounts per wallet, so it's left as is.

## Follow-ups

- **E2E:** the guest and offline fixes from the 2026-10-02 report still need a CI run (push).
