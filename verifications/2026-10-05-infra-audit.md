# Infrastructure audit: carry-forward of 09-24 + full re-scan (server, db, contracts, CI/Docker/deps/docs, mobile)

**Date:** 2026-10-05T02:36:10Z
**Method:** infra-audit skill; Phase 2 delegated to three read-only scan agents (server/db/contracts; CI/Docker/deps/docs; mobile)
**Verdict:** PASS (read-only pass). Every 09-24 fix still in place, no regressions; 1 carried item closed (role matrix), C#8 dashboard half closed. 19 server, 13+3 infra, 22 mobile new findings.
**Scope:** Broad — whole repo ("all"). Weighted toward what changed since 09-24 (AI, paging, budgets 008–012, NestJS 12 bump, design tokens) plus re-verification.
**Files touched:** this report only (fixes are in `2026-10-05-infra-audit-fixes.md`)
**Related reports:** [2026-09-24-infra-audit.md](2026-09-24-infra-audit.md), [2026-09-24-infra-audit-fixes.md](2026-09-24-infra-audit-fixes.md), [2026-10-04-design-token-fixes.md](2026-10-04-design-token-fixes.md)

## Method

Read-only commands run by the agents (no file writes except gitignored `server/dist`, no DB, no containers started):

```bash
npm ls --all typescript react react-native zod pg @types/node @nestjs/common
npm outdated --workspaces
npm run agents:check
node scripts/check-contract-parity.mjs              # 40/40
node scripts/audit-runtime-deps.mjs                 # 0 unaccepted, 2 accepted (review 2026-11-02)
(cd webpage && npm audit)
docker compose config --quiet; docker compose --profile gui config --services
env -u DATABASE_URL -u CI npm run test -w @sora/server   # 55/55 unit, 18 integration suites skipped (no DB)
npm test -w @sora/contracts                         # 129/129
npm run test -w @sora/mobile                        # 613/613
(cd mobile && npx tsc --noEmit)                     # exit 0
npx tsc -p server --noEmit --noUnusedLocals --noUnusedParameters   # exit 0
gh run list --branch main --limit 27; gh run view <id> --log-failed
```

## Summary stats

| | |
|---|---|
| Server | 75 src files / 9,556 lines; 27 test files (18 integration, 9 unit), ~218 tests |
| Contracts | 8 src files / 1,799 lines; 129 tests |
| Mobile | 336 `.ts/.tsx` (47 tests); 613 tests; largest screen `CategoryListScreen.tsx` 524 lines |
| DB | 12 migrations; 58 probe calls (30 accept / 35 reject) |
| CI | 1 workflow, 5 jobs, ~24.5 min; main: 3 pass / 17 fail / 7 cancelled of last 27 |
| Findings | Tier 1: 31 · Tier 2: 13 · Tier 3 / watch: 10 |

## Carried from 09-24 — re-verified

| # | Verdict | Evidence |
|---|---|---|
| C#8 unbounded scans | Dashboard **CLOSED**; balance **OPEN by design** | `dashboard.service.ts:177-179` bounds period activity in SQL; `balance.service.ts:133-146` still folds full history (header :10-11) |
| C#9 member status index | OPEN, no action | `uq_wallet_member` (001:89) returns ≤1 row |
| T3 role-matrix tests | **CLOSED** (gaps → S10) | `integration.access.test.ts:148-224`, 33 routes, CI green on 5f8ce9c |
| T3 BR-07 currency CHECK | OPEN → S18 | service-only, `transactions.service.ts:357-362` |
| T3 #14 `NOT VALID` | partly followed | 011/012 correct; 008/010 re-add `chk_budget_period` without it (applied, guidance only) |
| 09-24 fixes (compose gui profile, migrate service, HEALTHCHECK, prod-deps, CI needs database, engines ≥22.18, single TS, pinned images, `.env.example`, shutdown hooks, rate-limit sweep, request logging, pool timeouts, CORS, guest fallback helper, `isNetworkError`, sync backoff, ErrorBoundary, AddAccountScreen, `useCalculatorExpression`) | all **CLOSED**, none regressed | read back by the agents at the cited files |
| `tabBarMetrics.ts` unused | OPEN → M8 | no reference outside its barrel |

## Tier 1 — quick wins

**Server**
- **S1** No `pg.Pool` `'error'` listener — an idle-client error crashes the process. `database.service.ts:18-24`. *How:* `pool.on('error', log)`. SAFE.
- **S2** Parity script skips every single-quoted route (25 of 45). `scripts/check-contract-parity.mjs:113`. *How:* accept `'`/`"`/`` ` ``. SAFE.
- **S3** Malformed path uuid → pg 22P02 → 500 `INTERNAL_ERROR`. All 40 `@Param` uses; `pg-error.ts:63-72`. *How:* map to 404 (AC-01: a malformed id is a resource that does not exist). Decision.
- **S4** Local `@nestjs/*` 11.2.6 vs lockfile/CI 12.0.4; docs say NestJS 11 (CLAUDE.md, AGENTS.md, README, SDS). *How:* reinstall + docs.
- **S5** Dead code: `TokenService.hashesMatch` (`token.service.ts:85`), `withMessage` (`envelope.ts:20`), `WALLET_ACCESS_KEY` stash never read (`require-wallet-role.guard.ts:29,64`), unused `WalletIdSource` branches (`decorators.ts:18`, guard :73-75), `ROUTES.categories.detail` (`routes.ts:58`, no handler since 09-03), `MIGRATIONS_DIR` (`env.ts:55-56`, read by nothing).
- **S6** Duplicated helpers: `type Executor` ×6, UTC day-after ×4 (`audit.service.ts:121`, `transactions.service.ts:619`, `dashboard.service.ts:179`, `budget-spend.ts:41`), page-query Zod fields ×3. SAFE.
- **S7** Doc drift: spec §dashboard "two aggregate queries" (~9 actual); CLAUDE.md says categories only archive (spec §10.4 hard-deletes unused ones); "contracts must build before the API typechecks" (both resolve `src/` via `exports`). SAFE.
- **S8** Account detail reads the ledger twice and hand-codes classification instead of `calc.ts` (`accounts.service.ts:131-137`, `balance.service.ts:197-208`). 0.25d.
- **S9** Transaction update has no status guard — races a concurrent delete (`transactions.service.ts:455-485`). *How:* `status != 'DELETED'` + rows-affected check. SAFE.
- **S10** Role-matrix gaps: `POST /wallets/{id}/leave` stranger-404, `POST /ai/conversations` stranger walletId, stranger branch asserts status not code (`integration.access.test.ts:208`); `routes.test.ts:82` method-blind. Test-only, needs DB.
- **S11** `expect_reject` passes on any error (`db/tests/001_constraints.sql:20-31`). *How:* assert the constraint name. Needs DB.
- **S12** LA-02 gaps: contribution's backing EXPENSE audited only as `GOAL_CONTRIBUTION_*`; transaction delete removes the contribution without `GOAL_CONTRIBUTION_REMOVED`; Google first sign-in `USER_REGISTERED` post-commit. Decision (spec + code).

**Infra / docs**
- **I1** = S4 docs half.
- **I2** Dependency audit inside `contracts` gates every other job — 4 red main runs, dependabot PRs never reach server/mobile tests (`ci.yml:48`). *How:* own job nothing `needs:`.
- **I3** CI builds contracts 3× for no reader (`ci.yml:123,155,220`).
- **I4** Stale claims: `API_PORT`/`JWT_ACCESS_TTL` (CLAUDE.md:403, RUNBOOK:93), `EXPO_PUBLIC_API_URL` (README:156), "Node 22+", `npm run start:dev` (RUNBOOK:51), "transactions cancel" (RUNBOOK:38), CI "contracts first and alone", Budget "one category". SAFE.
- **I5** Project Structure trees (CLAUDE.md:297-340, AGENTS.md:63-82) miss `ai/`, `exchange-rate/`, `health/`, `haptics/`, docs/plans files, `webpage/`, `verifications/`, compose/Dockerfile; wrong runner location; empty `stores/`/`types/`. SAFE (rule 9).
- **I6** Compose `server` doesn't pass `DATABASE_*_TIMEOUT_MS` (`docker-compose.yml:56-77`). SAFE.
- **I7** Dockerfile `apk add` after manifest `COPY` (`server/Dockerfile:16`); `.dockerignore` misses `.codegraph` (26 MB), `webpage/`, `.claude`, `.agents`, `verifications`, `plans`, `mobile/android`. SAFE.
- **I8** AGENTS.md / `.agents/rules` drift (MB-06 expansion, MB-11, react-query note, test-plans) and 8 machine-specific `file:///d:/...` links. SAFE.
- **I9** Expo-managed `netinfo ^12.0.1`, `reanimated ~4.5.1` float past the SDK pin; dependabot proposes SDK-incompatible bumps (PR #8, #9). *How:* exact pins + dependabot ignores.
- **I10** Dead dependency/config: `prettier-plugin-tailwindcss`, root `lint` script delegating to nothing, `MIGRATIONS_DIR`, `@tanstack/react-query` (→ M15).
- **I11** CI hardening: no `permissions:`, `cancel-in-progress` also on main, timeouts only on e2e, Maestro unpinned via `curl | bash`, third-party actions by tag.
- **I12** Plan checkboxes stale (multi-currency 0/24, AI verification 0/13). Needs evidence per item.
- **I13** Orphan docs: `mobile/MODAL_UI_STATE.md`, `docs/ERROR_CODES.md`, `docs/LOCALIZED_DEFAULTS_RULE.md`, `plans/mobile/transaction-ui-plan.md`.

**Mobile**
- **M1** Dev "Add test INCOME/EXPENSE/TRANSFER" buttons ship to production, hardcoded VND + English, extra queries (`SettingsScreen.tsx:31-38,129-195`).
- **M2** Dashboard shows the previous wallet's figures after a switch (RTK `data` vs `currentData`): `MonthDataPoint.tsx:17-22`, `PeriodReport.tsx:44,59`; YearlyReport keyed without wallet (`DashboardScreen.tsx:142`). Rule-17-adjacent. SAFE.
- **M3** YearlyReport charts `income[0]`/`expense[0]` only (`YearlyReport.tsx:81-82`) — other currencies dropped. Decision (UX).
- **M4** Wallet rename/archive invalidate only `Wallet` (`walletsApi.ts:56,60`) — stale `walletName` on transactions, stale accounts/dashboard. SAFE.
- **M5** `as any` without reason (`TransactionItem.tsx:118-124`, `apiSlice.ts:59`). SAFE.
- **M6** `readSignedIn(...)` call copied 4× (`aiApi.ts`, `auditApi.ts`, `membersApi.ts`). SAFE.
- **M7** Barrel violations (`App.tsx:21`, `ConnectionSyncStatus.tsx:10-11`, `SyncSection.tsx:8`, `AppearanceSection.tsx:7`, `ThemeProvider.tsx:17`, `ToastProvider.tsx:12`, `Fab.tsx:6`, `Text.tsx:6`). SAFE.
- **M8** Dead exports: `draftFromTransaction`, `WEEKDAY_INITIALS`, `useAppSelector`, `selectQueueRows`, `ScaleIn`, `CategoryDeleteMode`, `tabBarMetrics.ts`; test-only: `runOptimisticMutation`, `canTransferBetween`, `isCrossWalletDraft`, `tryParseMoney`, `isOpenSwipeRow`.
- **M9** Tab skeleton renders 6 segments, real control 4; segments lack NC-04 testIDs. SAFE.
- **M10** `CategoryListScreen` queries fire with `walletId ?? ""` and no `skip`. SAFE.
- **M11** = I10 `prettier-plugin-tailwindcss`.
- **M12** 70 `MODULE_TYPELESS_PACKAGE_JSON` warnings per test run. SAFE (`--disable-warning`).

## Tier 2 — strategic

- **S13** Dashboard re-implements three response mappers (transactions, budgets, goals) — rule 7 "two screens, two figures" risk. 1d.
- **S14** Idempotency store: no cap, O(n) eviction per keyed request (`idempotency.interceptor.ts:41-79`). 0.5d.
- **S15** `refresh_tokens` never pruned (~96 rows/day/device). Decision: retention. 0.5d.
- **S16** No `trust proxy` — behind a proxy all clients share one rate-limit bucket and audit `ip`. Decision: deploy topology. 0.25d.
- **S17** `transferOwnershipSchema` and 8 list-query schemas live outside contracts; one is hand-mirrored in mobile. 0.5d.
- **I14 (T2-1)** Main CI red most of the time (E2E "Run flows" 6×). Triage + Maestro pin + retry. 1–2d.
- **I15 (T2-2)** CI speed: 5 uncached `npm ci`, full install for `database`, uncached APK/AVD, E2E on docs-only pushes. 1d.
- **I16 (T2-3)** Parked `webpage/` carries 1 critical + 9 high advisories, unscanned. Decision: delete or freeze.
- **M13** Segmented control copied 3× (`PlanningScreen`, `TransactionListScreen`, `TransactionListSkeleton`). 0.5d.
- **M14** Sync-status view logic copied (`ConnectionSyncStatus.tsx:35-77` / `SyncSection.tsx:21-75`); redundant `manualSyncing`. 0.5d.
- **M15** `@tanstack/react-query` dead weight (no `useQuery`/`useMutation`). Remove + MB-02 docs. 1–2h.
- **M16** axios base query used by one endpoint (`listWallets`). 0.5d. Decision.
- **M17** `displayedItems` mirrors query data into state (`TransactionListScreen.tsx:116-130`). 0.5d, subtle UX.
- **M18** Guest/offline/online write path copied ~18× across slices. 1d, no slice tests.
- **M19** Inline sub-components in large screens (`CategoryListScreen`, `PlanningScreen`, `WalletMembersPanel`). 1d → extract-modules.

## Tier 3 — debt / watch

- **S18** BR-07 currency match not enforced in the database (trigger design). 2d.
- **S19** Lifetime balance folds full ledger per request (C#8, by design). 2d+.
- **Watch:** `CATEGORY_CYCLE` unreachable but `assertNoCycle` runs serial queries; ARCHIVED category accepted on transactions/contributions (spec decision); `migrate.mjs` has no advisory lock; audit exemptions expire 2026-11-02; argon2 bump needs `allowScripts` key change; Expo may not read the root `.env` (`EXPO_PUBLIC_*`) — confirm with an export build; type-level-only RTK tags (M20); AI conversations capped at 50 (M21); per-row queue selector (M22).

## Cross-cutting themes

- **Docs describe an older shape** (S4, S7, I3–I5, I8, I12, I13): framework major, CI order, project tree, ports — rule 9 again. One docs pass.
- **Single source drifting into copies** (S6, S8, S13, S17, M6, M13, M14, M18): mappers, helpers, schemas and UI pieces re-implemented beside their owner — the rule-7 failure mode.
- **Gates that pass while checking less than they claim** (S2, S10, S11, I2, I10 `lint`): parity skips routes, probes accept any error, a lint script runs nothing, an audit step skips all tests.
- **Cross-scope data on screen** (M2, M4, rule 17): stale wallet data shown after a scope change.

## Dependencies

- S4 reinstall before trusting any local server typecheck/test.
- S2 before S5's `categories.detail` removal (parity must see every route first).
- I9 before dependabot ignore list; I2 before I14 (separate the audit so failures are attributable).
- M15 before the MB-02 doc update (I8 ports it).
- M13 is the extract-modules hand-off; M19 likewise.

## Checked and clean

- API-05 pagination on every list endpoint; every `@Body`/`@Query` through `zodPipe`; `process.env` only in `env.ts`; LA-01 log review clean; rule 16 SAVEPOINT intact; cross-wallet transfer audited per wallet; every hot query shape has an index; `--noUnusedLocals` clean on server.
- `migrate.mjs` checksum + `--reset` guard + COMMIT-held bookkeeping intact.
- Rule 8: no `hashFiles`, only step-level `if: failure()`. `tokens-usage.test.ts` picked up by the mobile glob. `agents:check` in sync (10 skills).
- Single versions: typescript 6.0.3, react 19.2.3, react-native 0.86.3, zod 3.25.76, pg 8.23.0.
- Mobile: MB-02 (no API data mirrored into plain Redux), MB-04 (tokens in secure store only), MB-08 (no `Number(amount)`), no `console.log`, every FlatList keyed, rule 17 cache owner binding, every direct dependency used except `prettier-plugin-tailwindcss`.
- No hardcoded secrets in compose/Dockerfile/CI; Dockerfile multi-stage, non-root, healthcheck.

## Fixes Applied

None in this pass (read-only per the skill). Applied afterwards: see `2026-10-05-infra-audit-fixes.md`.

## Follow-ups

Listed per tier above; the fixes report states which were closed and which stay open and why.
