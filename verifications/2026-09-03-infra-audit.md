# Infrastructure audit: server, mobile, contracts, db, CI — plus three route-wiring blockers found and fixed

**Date:** 2026-09-03T14:41:00Z
**Method:** infra-audit skill (Phase 2 delegated to four parallel scan agents, every finding re-verified against the live files before action)
**Verdict:** PASS (fixes applied and exercised) — with the caveat that real-data exercise is BLOCKED, see Findings 4
**Scope:** Broad. `server/` (63 files, 7,043 lines), `mobile/` (96 files, 8,525 lines),
`packages/contracts/` (7 files, 1,298 lines), `db/` (3 files, 780 lines), `scripts/`,
`.github/workflows/ci.yml`, root tooling. Also a consolidated open-task inventory across
`mobile/GAPS.md`, every `verifications/*.md` Follow-ups section, the build plan, and
`aif-sdlc-checklist.md`; plus an SRS §9 user-story coverage pass (46 stories).
**Files touched:** `server/src/app.module.ts`, `server/src/main.ts`,
`server/src/wallets/wallets.module.ts`, `server/src/wallets/invitations.controller.ts` (new),
`README.md`
**Related reports:** [2026-09-02-skill-audit.md](2026-09-02-skill-audit.md),
[2026-08-30-wallet-member-actions-sheet-mobile.md](2026-08-30-wallet-member-actions-sheet-mobile.md),
[2026-08-30-wallet-context-and-admin-actions-mobile.md](2026-08-30-wallet-context-and-admin-actions-mobile.md),
[2026-08-25-sora-rebrand-and-doc-reconciliation.md](2026-08-25-sora-rebrand-and-doc-reconciliation.md)

## Method

Four scans in parallel, each told to verify against real files and report `file:line`: (1) server
data access / audit coverage / security posture, (2) mobile + contracts + CI + db, (3) consolidated
open-task inventory, (4) SRS §9 story-by-story coverage. Every finding acted on below was then
re-verified by hand — two agent claims did not survive that check (noted in Findings 9).

Commands actually run:

```
npm run build -w @sora/contracts && npm run typecheck -w @sora/server   # clean
npm run build -w @sora/server                                          # clean
node scripts/check-contract-parity.mjs                                 # 31/31 PASS
npm test -w @sora/contracts                                            # 61/61 pass
npm run typecheck -w @sora/mobile                                      # clean
DATABASE_URL=... JWT_SECRET=... JWT_ISSUER=... GOOGLE_CLIENT_ID=... PORT=3099 \
  node server/dist/src/main.js                                         # 52 routes mapped
curl -s -o /dev/null -w '%{http_code}' http://localhost:3099/api/v1/{health,transactions,budgets,goals,categories}
curl -s -X POST -d '{}' http://localhost:3099/api/v1/invitations/{preview,accept}
```

## Findings

### 1. BLOCKER (fixed) — 22 of 50 endpoints were never mounted

`AppModule` imported only Config, Common, Database, Audit, Health, Auth, Wallets, Accounts,
Dashboard. `TransactionsModule`, `BudgetsModule`, `GoalsModule` and `CategoriesModule` were fully
written — controller, service, providers — and imported by **nothing** except
`server/src/verify-boot.ts:16`, a scratch harness whose own comment reads "not-yet-wired
TransactionsModule … Deleted after verification". It was never deleted, and it is why the gap
survived: the transactions module had been exercised through a private harness instead of the real
app.

Verified before fixing: `grep -rn "TransactionsModule|BudgetsModule|GoalsModule|CategoriesModule"
server/src` → only the four `export class` lines plus `verify-boot.ts`.

Impact: transactions (5 routes), goals + contributions (8), budgets (5), categories (4) all
returned 404. The ledger — the product — was unreachable.

### 2. BLOCKER (fixed) — the API never mounted its own version prefix

`main.ts` had no `setGlobalPrefix`, and `grep -rn "setGlobalPrefix|api/v1|API_PREFIX" server/src`
returned **nothing**. Controllers declare bare `ROUTES` paths (`/wallets`); the app builds the same
paths through `apiUrl()`, which prepends `API_PREFIX` (`/api/v1`). So the server served `/wallets`
while every mobile call went to `/api/v1/wallets` — CLAUDE.md API-01 mandates the latter, and
`RUNBOOK.md:21`/`:59` and `README.md:146` all document `GET /api/v1/health`.

Impact: **every endpoint 404'd from the app**, independently of Finding 1.

### 3. BLOCKER (fixed) — `/invitations/preview` and `/invitations/accept` had no controller

`InvitationsService.preview()` (`invitations.service.ts:201`) and `.accept()` (`:220`) are complete
and correct, `acceptInvitationSchema` exists (`schemas.ts:152`), `ROUTES.invitations.preview/accept`
exist (`routes.ts:44-45`), spec §8.4/§8.5 document both, and `AcceptInvitationScreen` calls both
through `mobile/src/services/api/invitations.ts:45,48`. There was no HTTP route: `grep -rn
"preview|accept" server/src --include=*.controller.ts` matched only an unrelated enum.

Impact: accepting an invitation — completing the share, which is the headline feature — was broken
end to end. This is SRS WAL-US-04 and WAL-US-05, implemented at every layer except the one that
makes them reachable.

### 4. Real-data exercise — BLOCKED, not passed

No usable Postgres role in this environment: the cluster accepts connections
(`/var/run/postgresql:5432 - accepting connections`) but `psql -lqt` → `role "globee" does not
exist`, and `postgres` fails peer auth. `.env` additionally has **no `DATABASE_URL` at all** — it is
still entirely the deleted stack's variables (`DB_USER`, `SMTP_*`, `NEXT_PUBLIC_API_URL`, …), so the
server cannot boot from it; boot required inline config. Routing is proven (below); no query path,
constraint, or derivation was exercised against real rows this pass.

### 5. Route wiring after the fixes — verified over HTTP

52 routes mapped, all under `/api/v1`:

| Group | Routes | Group | Routes |
|---|---|---|---|
| wallets | 14 | accounts | 5 |
| goals | 8 | categories | 4 |
| auth | 7 | invitations | 2 |
| transactions | 5 | health | 1 |
| budgets | 5 | dashboard | 1 |

Live responses:

| Request | Before | Now | Proves |
|---|---|---|---|
| `GET /api/v1/health` | 404 | **503** | prefix mounted (503 = DB down per Finding 4, not a routing failure) |
| `GET /health` | 200 | **404** | prefix genuinely moved it |
| `GET /api/v1/transactions` (no token) | 404 | **401** | route exists, auth guard reached |
| `GET /api/v1/{budgets,goals,categories}` | 404 | **401** each | all three formerly-dead modules mounted |
| `POST /api/v1/invitations/preview` `{}` | 404 | **422 VALIDATION_FAILED** `{"fields":{"token":["Required"]}}` | route + `zodPipe` + envelope all live |
| `POST /api/v1/invitations/accept` (no token) | 404 | **401** | authenticated route live |

### 6. The parity check cannot see any of this — the blind spot that let it happen

`node scripts/check-contract-parity.mjs` reported **31/31 PASS while 22 endpoints were
unreachable and the prefix was absent**. By design it reads the migration and the spec as *text*; it
never inspects the Nest DI graph or a running route table. Re-run after the fixes: still 31/31, i.e.
it is equally blind in both directions. `ROUTES.categories.detail()` is likewise declared with no
controller behind it and the script passes regardless.

This is CLAUDE.md Part 7 rule 9's own principle ("prefer a mechanical check over a prose claim")
being satisfied in form but not in substance — the mechanical check exists and proves the wrong
thing.

### 7. Server has zero tests; lint is a no-op

- `server/test/` is **empty**; `server/package.json:12` is `node --test dist/test/*.test.js`, which
  exits 0 having run nothing, and `ci.yml:135-140` provisions Postgres 17, migrates, and asserts
  nothing. CI shows a passing "Server (types, tests)" badge for zero assertions — the same shape as
  Part 7 rule 8's green-CI-that-tested-nothing, and the direct reason Findings 1–3 reached `main`.
- `package.json:18` `"lint": "npm run lint --workspaces --if-present"` with no workspace defining
  `lint` and no eslint/prettier config anywhere in the tree; `ci.yml` never invokes lint at all.
  MB-01, NC-04 and the no-`Number(amount)` rule are all mechanically checkable and unchecked.

### 8. Migration idempotence step proves the ledger, not the DDL

`ci.yml:99-103` re-runs migrations to "prove idempotence", but `scripts/migrate.mjs:80-82,123-129`
skips any filename already recorded in `schema_migrations`, so the second run applies zero files.
`db/migrations/002_google_auth_and_preferences.sql:13-26` uses bare `ADD COLUMN` / `CREATE UNIQUE
INDEX` / `ADD CONSTRAINT` and would error if genuinely re-applied. The step asserts a property it
cannot observe. (Also corrects a CLAUDE.md claim: `db/migrations/` has **two** files, not one.)

### 9. Two agent claims that did not survive verification

- "`useUpdateMemberRole` is unused" — **stale**, it is now consumed by `WalletMembersScreen.tsx` as
  of the member-actions work earlier today.
- "`mobile/GAPS.md`'s category edit/archive gap is open" — **wrong**; `CategoryListScreen.tsx:166-168`
  consumes `useUpdateCategory`, `useArchiveCategory` and `useDeleteCategoryPermanently`. CAT-US-03/04
  are done and the GAPS.md entry is stale.

Recording these because the audit's value depends on findings being checked, not relayed.

### 10. Checked and clean (evidence a later session can trust)

- **LA-02 audit coverage** enumerated endpoint by endpoint: wallets create/update/archive, members
  role-change/remove/transfer/leave, invitations create/revoke/accept, accounts, categories, budgets,
  goals, contributions, auth register/login/google/refresh/logout/replay all write rows. Two gaps
  only: `auth.updatePreferences` (arguably out of LA-02 scope) and
  `goal-contributions.service.ts:186-191`, which cancels a backing transaction without a
  `TRANSACTION_CANCELLED` row.
- **LA-01/LA-03/LA-04 clean** — no password, hash, or token in any log line; every 401/403 logs at
  WARN with actor and target (`all-exceptions.filter.ts:52-53`); `/health` raises nothing so the
  filter never logs it.
- **Parameterized SQL** — only two raw `sql` templates in the whole tree, both bound.
- **Rate limiting** correctly applied to register/login/google/refresh plus per-email lockout.
- **`process.env` discipline** — the only reads outside `config/env.ts` are `verify-boot.ts` (dead)
  and `scripts/migrate.mjs` (standalone CLI, outside Nest).
- **Zod validation coverage complete** across all 9 controllers for `@Body`/`@Query`.
- **No `hashFiles()` and no job-level `if:` in `ci.yml`** — Part 7 rule 8 not violated. Job order and
  caching sound (contracts alone first, server+mobile parallel behind it, `cache: npm` throughout).
- **`migrate.mjs` checksum immutability** is real (`:190-198`), as CLAUDE.md claims.
- **Mobile config genuinely centralised** in `mobile/src/app/config/env.ts`; tokens correctly in
  `secure-store`, only theme/locale in `AsyncStorage` (MB-04 satisfied).
- **Contracts test suite is healthier than documented**: 61 tests / 18 suites, not CLAUDE.md's
  "~37 assertions".

## Fixes Applied

1. [server/src/app.module.ts:5-6,14,16](../server/src/app.module.ts#L5-L16) — imported
   `CategoriesModule`, `TransactionsModule`, `BudgetsModule`, `GoalsModule` and added all four to
   `imports`. Re-verified: 52 routes map (was 30); `/api/v1/{transactions,budgets,goals,categories}`
   answer 401 instead of 404.
2. [server/src/main.ts:5,17-22](../server/src/main.ts#L5-L22) — `app.setGlobalPrefix(API_PREFIX)`,
   with a comment naming why the two sides disagreed. Re-verified: `/api/v1/health` → 503,
   `/health` → 404.
3. [server/src/wallets/invitations.controller.ts](../server/src/wallets/invitations.controller.ts) (new)
   — `POST /invitations/preview` (`@Public`, 200) and `POST /invitations/accept` (authenticated, 200)
   delegating to the existing service methods, per spec §8.4/§8.5. Kept in its own controller because
   `WalletsController` applies `RequireWalletRoleGuard` at class level, which a token-addressed
   pre-membership route cannot satisfy. Registered in
   [wallets.module.ts:5,23](../server/src/wallets/wallets.module.ts#L5-L23). Re-verified over HTTP:
   422 with a field error on an empty preview body, 401 on unauthenticated accept.
4. [README.md:224](../README.md#L224) — `curl http://localhost:3001/health` →
   `/api/v1/health`, matching `RUNBOOK.md:21`/`:59` and `README.md:146` and the prefix now actually
   mounted.

Regression check after all four: `typecheck -w @sora/server` clean, `typecheck -w @sora/mobile`
clean, `check-contract-parity.mjs` 31/31, `@sora/contracts` 61/61.

## Follow-ups

Tiered by impact/effort. Nothing below was started this pass.

**Tier 1 — quick wins (< 1h each)**
- Add a route-table assertion so Findings 1–3 cannot recur: assert at boot (or in a test) that every
  `ROUTES` path resolves to a mounted handler. Without it the parity check stays blind (Finding 6).
- Make `server`'s test script fail on zero tests found, so CI stops reporting green for nothing.
- Delete `server/src/verify-boot.ts` (47 dead lines, self-described as temporary, the proximate cause
  of Finding 1). **Not deleted this pass — removing a file needs explicit permission.**
- Rename the CI "idempotence" step to what it actually proves, or re-apply into a scratch DB (Finding 8).
- `pg` pool has no `idleTimeoutMillis`/`connectionTimeoutMillis`/`statement_timeout`
  (`database.service.ts:83-86`) — a hung query holds a connection indefinitely against a pool of 10.
- Non-sargable date filter: `transaction_date::date >= $1::date`
  (`transactions.service.ts:254,257`) defeats the index; compare against timestamptz bounds as
  `audit.service.ts:93-95` already does.
- Missing indexes, verified against the real predicates: `wallet_members (user_id, wallet_id, status)`
  — the highest-frequency query in the API (`wallet-access.service.ts:90-92`); `accounts (wallet_id,
  status)`; `audit_logs (wallet_id, event, created_at DESC)`; a trigram index for `?search=`'s
  `ILIKE '%…%'` (`transactions.service.ts:261-265`).
- `enableCors()` with no origin allowlist; no `helmet`; no JSON body-size limit (`main.ts`).
- No `22P02` mapping in `pg-error.ts:16-18` and no UUID validation on `@Param`, so a malformed id in
  any `/:id` route returns `500 INTERNAL_ERROR` with the driver message instead of 404.
- TypeScript major split: root pins `~6.0.3`, all three workspaces declare `^5.7.2`.
- `zustand` is declared but `mobile/src/stores/` is empty and nothing imports it, despite MB-02
  naming it the UI-state library. Also unimported: `@react-native-masked-view/masked-view`,
  `expo-crypto`, `expo-linking`, `expo-system-ui`.
- Doc fixes: `mobile/GAPS.md` test count (36, not 47) and its stale category-edit entry (Finding 9);
  CLAUDE.md's "~37 assertions" (really 61) and its "only one migration" claim (there are two);
  spec §3's endpoint index omits `/auth/google` and `/auth/me/preferences`; `.env.example` variable
  names still disagree with `env.ts`.

**Tier 2 — strategic (1–2 days each)**
- Audit rows for transactions are written **outside** the transaction they describe
  (`transactions.service.ts:338,419,453`) while wallets/invitations/categories correctly pass `trx` —
  a crash between the two silently loses the financial mutation's record, so the highest-value audit
  rows are the least durable. Also serial: the cross-wallet audit loop awaits one insert per wallet.
- Unbounded transaction scans on every dashboard/budget/balance read
  (`dashboard.service.ts:114-125,329-334`, `budgets.service.ts:317-322`,
  `balance.service.ts:135-144`) — every matching row ever, filtered in JS. Because the queries omit
  `status`, the partial index `idx_transactions_budget_scan` built for exactly this scan cannot be
  used and is dead. Push the date/status window into SQL as a pre-narrowing filter (`calc.ts` stays
  authoritative).
- `RequireWalletRoleGuard` stashes its resolved access at `WALLET_ACCESS_KEY`
  (`require-wallet-role.guard.ts:66`) and every service then re-runs `access.require` — two identical
  membership queries per guarded request. A request-scoped `(userId, walletId)` cache fixes this and
  the duplicate round-trips in `accounts.service.ts:109-115,63-70`.
- BR-07 (currency consistency) is **entirely unprobed**: `chk_transaction_currency`,
  `chk_account_currency`, `chk_budget_currency`, `chk_goal_currency`,
  `chk_goal_contribution_currency` have no probe, and migration 002's four constraints have none at
  all. 22 of 30 CHECKs are unprobed, though the pure enum ones are covered statically by the parity
  check.
- `mobile/src/utils/derive.ts` is a second copy of `calc.ts`'s ledger math (Part 7 rule 7) **and
  entirely dead** — every export has zero references anywhere. Delete rather than let it diverge.
  ~35 further dead exports confirmed across contracts and mobile.
- No error boundary and no crash reporting anywhere in mobile (zero matches for
  `errorboundary|sentry|bugsnag|crashlytics`): a render throw white-screens the app with no recovery
  and no off-device signal.
- Unbounded in-memory state: `RateLimitService.windows`/`failures` never sweep expired entries;
  `IdempotencyInterceptor.seen` holds full response bodies for 24h with an O(n) sweep per request.
- Add a linter with rules for what CLAUDE.md already mandates (Finding 7).
- Untested high-risk client code: all of `mobile/src/utils/roles.ts` (the whole client role-gating
  surface) and `mobile/src/utils/money.ts`.

**Tier 3 — debt (2+ days each)**
- A real server test suite: the role matrix including the 404-vs-403 boundary (AC-01), cross-wallet
  role checks (AC-03), audit-row assertions (LA-02). This is the gap that made Findings 1–3 possible.
- i18n extraction for the **19** screens with zero `t(` calls (GAPS.md says ~14; only Login, Register,
  Home and Settings are translated).
- 21 screens repeat the same loading/error/empty/success scaffold and 8 `Add*Screen`s repeat an
  identical RHF submit scaffold — candidates for `QueryState`/`ListScreen`/`FormScreen` primitives.
- Repo-wide testID scheme diverges from the documented NC-04 table: decide whether to migrate the
  code or amend the doc.
- No E2E/Detox suite; nothing has been rendered on a device or emulator (standing limitation).
- `SRS.md`/`SDS.md` still describe the removed sharing layer. Separately, **SRS §4 defines BR-01…BR-15
  while CLAUDE.md defines BR-01…BR-08 with different meanings** (SRS BR-03 = CLAUDE BR-02; SRS BR-04 =
  CLAUDE BR-06; SRS BR-05 = CLAUDE AC-01), so a reader following one numbering lands on the wrong rule.
- The build plan's ~130 checkboxes are all unticked including phases its own §32 marks complete, and
  `aif-sdlc-checklist.md`'s frontend gates still describe the deleted web stack (shadcn/ui, "Lucide
  React", stable `id` attributes — which contradicts NC-04 `testID`). Neither is usable as an
  inventory.

**Open product/spec question, not a defect to fix silently**
- `mobile/src/services/api/categories.ts:35` `deletePermanently` sends `{ mode: 'permanent' }` and
  `CategoryListScreen` exposes it, with server support at `categories.controller.ts:63`. SRS CAT-US-04
  says "No hard delete is offered" and CLAUDE.md Data Safety says nothing financial is hard-deleted.
  Either the SRS or the code is wrong — needs a decision, not a unilateral edit.

**Remaining SRS user-story gaps (all backend-complete, UI-only)**
ACC-US-04 edit account · ACC-US-05 archive account (`useArchiveAccount` exists, unused) · BUD-US-03
adjust budget (`useUpdateBudget` exists, unused) · BUD-US-04 archive budget (`useArchiveBudget`
exists, unused) · SAV-US-04 adjust goal · SAV-US-05 remove contribution · SAV-US-06 complete/cancel
goal · TXN-US-07 edit transaction · WAL-US-12 rename wallet. Plus PARTIAL: TXN-US-05 (list filters —
schema supports search/date/amount/status/sort, UI exposes none), WAL-US-13 (activity screen has no
event/date filter), WAL-US-02 (archived wallets not listable —
`WalletProvider.tsx:44` hard-codes `status: 'ACTIVE'`).
