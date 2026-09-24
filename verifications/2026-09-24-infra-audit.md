# Infrastructure audit: carry-forward of 09-21 + scan of everything since (Docker, CI, deps, docs, runtime)

**Date:** 2026-09-24T04:50:13Z
**Method:** infra-audit skill (via double-check); Phase 2 delegated to two read-only scan agents —
(A) re-verify every open 09-21 finding against live code, (B) scan infra surfaces changed or unreviewed
since 09-21. Highest-impact new findings re-checked by hand (see Method).
**Verdict:** PASS (read-only pass). 1 prior finding closed (#15), 1 partly closed (#16); 11 carried items
re-confirmed open; 17 new findings (6 Tier 1, 7 Tier 2, 4 Tier 3).
**Scope:** Broad — whole repo (none named). Weighted toward re-verification plus surfaces not covered
before: compose/Dockerfile runtime, CI job graph, dependency/version drift, env/docs drift, mobile
retry/timeout posture, migrations 005/006.
**Files touched:** none — read-only pass.
**Related reports:** [2026-09-21-infra-audit.md](2026-09-21-infra-audit.md),
[2026-09-21-infra-audit-tier1-fixes.md](2026-09-21-infra-audit-tier1-fixes.md),
[2026-09-16-infra-audit.md](2026-09-16-infra-audit.md)

## Method

- Read `CLAUDE.md` fresh; read the 09-21 audit + Tier-1 fixes report for the carry-forward list.
- Agent A: each carried item re-checked at its cited file; Agent B: `ci.yml`, `docker-compose*.yml`,
  `server/Dockerfile`, `.dockerignore`, every `package.json`, `env.ts` vs `.env.example`, README/RUNBOOK/
  CLAUDE.md claims, migrations 005/006, `main.ts`, mobile axios/sync/QueryProvider.
- Re-checked by hand: `grep` of `docker-compose.yml:61` + `.env.example:67` (pgadmin `:?` vs blank);
  `server/Dockerfile` has no migrate step, `CMD ["node","server/dist/src/main.js"]`; `ci.yml` — `database`
  has no `needs:`, `server`/`mobile` need only `contracts`; `main.ts:27` bare `enableCors()`, no
  `enableShutdownHooks`; 005 `ADD CONSTRAINT` without `NOT VALID`; `CLAUDE.md:352` "63 tests" (actual 75);
  node-printed `engines` `>=22` and TypeScript 6.0.3 (root/mobile) vs 5.9.3 (server, contracts nested);
  `mobile/src/utils/errors.ts:52-108` four copies of the same substring checks.

## Closed since 2026-09-21

- **#15** CategoryGrid/CategoryPicker duplicated default-to-first logic — closed this session by
  `mobile/src/hooks/useDefaultToFirst.ts` (also used by `AccountPicker`).
- **#16 (partly)** — `HAS_OPERATOR` regex gone; both files import `hasOperator`/`tryEvaluate`/
  `spaceExpression` from `@/utils`. Still duplicated: `expressionRef`, the `tryEvaluate` memo, display
  formatting (`AddTransactionModal.tsx:80-93` vs `MoneyInput.tsx:101-109`), two-stage confirm (:150-166).
- **Tier-3 (c) partly** — `server/test/transaction-category.test.ts` adds type-matrix/cross-wallet unit
  coverage; still no role-matrix / 404-vs-403 assertions.

## Carried — re-verified still open

| # | Finding | Evidence |
|---|---|---|
| 8 | Unbounded history scans; date window applied in JS | `dashboard.service.ts:165-181`, `:398-403`; `balance.service.ts:137-146`, `:184-190` (header :10-11 says deliberate at personal scale) |
| 9 | No `(wallet_id,user_id,status)` index; `uq_wallet_member (wallet_id,user_id)` covers the lookup, status filtered on ≤1 row | `001:89,96-97`; guard `wallet-access.service.ts:90-92` — low real cost, keep as watch item |
| 10 | Guest/offline fallback branch copied 13× across 7 RTK slices, no shared helper | e.g. `accountsApi.ts:26,47` |
| 11 | `AddAccountModal.tsx` ≈ `AddAccountScreen.tsx`, both mounted | `ModalProvider.tsx:43`, `AppNavigator.tsx:43` |
| 12 | `auditTransaction` serial loop, outside the write's transaction | `transactions.service.ts:221-222`, called post-commit at :343/:418/:452 |
| 13 | Rate-limit Maps never swept | `rate-limit.service.ts:32-33` |
| T3 | No mobile error boundary/crash reporting; no lint tooling (root `lint` delegates to nothing); no role-matrix tests; no CORS allowlist/helmet/body limit; pool has no idle/connection/statement timeouts; no currency-mismatch probe (and no currency-match CHECK exists to probe — BR-07 is service-only) | `main.ts:27`; `database.service.ts` `new pg.Pool({connectionString,max})` |

## Tier 1 — quick wins (new)

1. **Documented `docker compose up -d --build` fails on the documented `.env`.** pgadmin's
   `${PGADMIN_DEFAULT_PASSWORD:?…}` (`docker-compose.yml:61`) errors on the blank `.env.example:67`,
   for every compose command incl. `build` — the file's own server comment explains why `:?` is avoided
   there. Introduced by the 09-21 Tier-1 fix. *How:* move pgadmin/adminer behind a compose `profiles:
   [gui]` (and drop `docker-compose.gui.yml`, which duplicates them with colliding `container_name`s, a
   hard-coded `admin` password and obsolete `version:`). *Effort:* 0.25d.
2. **`enableShutdownHooks()` never called** — `DatabaseService`'s `OnApplicationShutdown` never runs;
   `docker stop` kills the pool mid-query. *How:* one line in `main.ts`. *Effort:* <0.1d.
3. **Stale doc claims.** `CLAUDE.md:352` "money/derivation math, 63 tests" (75, and schemas are tested
   too); CLAUDE.md/README "by hand" fallback applies only `001` "while the runner is being written"
   (runner exists; skips 002–006); CI described as "contracts → database → server + mobile" but
   `database` runs in parallel and server/mobile don't wait for it; compose described as "server +
   Postgres only" (4 services); CLAUDE.md env list omits `GOOGLE_CLIENT_ID`/`EXCHANGE_RATE_*` and calls
   exchange-rate vars unread (env.ts reads them). *Effort:* 0.25d.
4. **`.env.example` missing env.ts vars** — `NODE_ENV`, `MIGRATIONS_DIR`, `EXCHANGE_RATE_API_URL`,
   `EXCHANGE_RATE_TIMEOUT_SECONDS`, `EXCHANGE_RATE_CACHE_TTL_MINUTES`; compose's server doesn't pass
   `EXCHANGE_RATE_*`. *Effort:* <0.1d.
5. **`engines.node ">=22"` too loose** — server imports `@sora/contracts` as raw `.ts` and mobile tests
   are `.ts`, both needing unflagged type stripping (Node ≥22.18). CI/Docker only pass because `22`
   floats. *How:* `">=22.18"`. *Effort:* <0.1d.
6. **Redundant root `overrides`** — `react-native-gesture-handler ~2.32.0` and `react-native-worklets
   0.10.1` now match mobile's direct declarations; an override kept past its reason silently wins over a
   future mobile bump. *How:* keep only if `npm ls` shows a transitive consumer requesting a different
   version; otherwise remove. *Effort:* <0.1d.

## Tier 2 — strategic (new)

7. **Compose never migrates** — no migrate step in compose or the image (`scripts/`/`db/` not copied);
   `/health` reports up on an empty schema. *How:* a one-shot `migrate` service (or entrypoint) running
   `scripts/migrate.mjs` with `server` `depends_on: condition: service_completed_successfully`. *Effort:* 0.5d.
8. **CI job graph lets server/mobile go green while DB probes fail** — `database` has no dependants.
   *How:* `server: needs: [contracts, database]` (or a final gate job). *Effort:* <0.25d.
9. **Two TypeScript majors** — 6.0.3 (root, mobile) vs 5.9.3 (server, contracts). Contracts compiles
   under 5.9 and is typechecked under 6 from mobile. *How:* one version at the root, drop per-package
   `typescript`. *Effort:* 0.5d incl. fixing any 6.0 errors in server.
10. **Runtime image ships dev dependencies, no HEALTHCHECK** — `server/Dockerfile` copies the full
    `node_modules` (typescript, @types, concurrently). *How:* `npm ci --omit=dev --workspace @sora/server`
    in a prod-deps stage; `HEALTHCHECK` on `/health`. *Effort:* 0.5d.
11. **No request logging / request ids / structured logs** — default Nest text logger only; LA-04's
    `/health` exclusion has nothing to exclude from; a mobile error can't be matched to a server line.
    *How:* a logging middleware (method, route template, status, ms, request id; skip `/health`), JSON
    output in production. *Effort:* 1d.
12. **Mobile retry has no backoff or cap** — `syncEngine.ts:163` increments `attempts`, nothing reads it;
    sync is fixed-interval (`syncEngineRuntime.ts:57-68`); TanStack retry separately (`QueryProvider.tsx:17-23`).
    A permanently failing mutation retries forever. *How:* exponential backoff + max attempts → mark
    failed/needs-attention. *Effort:* 1d.
13. **`isNetworkError`-style substring checks copied 4×** (`mobile/src/utils/errors.ts:52-108`), and
    `includes('fetch')` misclassifies unrelated errors as offline (which flips the app to guest data).
    *How:* one classifier keyed on axios `code`/`!response`. *Effort:* 0.25d.

## Tier 3 — debt (new)

14. **005 re-adds `chk_transaction_shape` without `NOT VALID`** — full scan under ACCESS EXCLUSIVE.
    Fine at today's size; for future constraint changes use `NOT VALID` + `VALIDATE CONSTRAINT`.
    (005 is applied/immutable — guidance for the next migration, not a fix.)
15. **CI idempotence step only proves the tracker skip path** — `migrate.mjs:121-131` records after
    executing; a crash between them re-runs a non-re-runnable file (001's `CREATE INDEX`, 005's
    `DROP CONSTRAINT`). *How:* record inside the same transaction as the migration.
16. **Floating/mixed version ranges** — `pg` declared at root and server; `expo-sqlite`/`babel-preset-expo`
    `^` while other expo packages `~`; `react-native-reanimated ^4.5.1` floats against exact
    `react-native-worklets 0.10.1` (must stay matched). Floating `:latest` images for pgadmin/adminer.
17. **Exception log target includes query string** (`all-exceptions.filter.ts:52-56`, `originalUrl`) — no
    secret in a query string today; log the route path instead to keep it that way (LA-01).

## Cross-cutting themes

- **Docs describe an older infra shape** (#1, #3, #4, #7, #8): compose services, CI order, migration
  fallback and env list all drifted together — one docs pass after #1/#7/#8 land.
- **Resilience defaults unset** (#2, #12, T3 pool timeouts, #13 carried): shutdown, backoff, timeouts,
  sweeps — each small, together the difference between "works in dev" and "degrades gracefully".
- **Duplication in mobile data plumbing** (#10 carried, #13, #16 carried): the same fetch/fallback/
  classify logic repeated per call site; #13 is the cheap first step toward #10's `withGuestFallback`.

## Dependencies

- #1 before #7 (the migrate service lives in the same compose file). #7 before the docs half of #3.
- #9 before adding lint tooling (T3) — pick one compiler first.
- #13 before #10 (the shared fallback helper should call the single classifier).

## Checked and clean

- CI runs typecheck + tests for contracts, server and mobile, the parity script, migrations + probes on
  Postgres 17, and an `expo export`; no `hashFiles`/job-level `if:` (rule 8); `cache: npm` everywhere.
- `db/tests/001_constraints.sql` covers 005's TRANSFER shape; `idx_transactions_category_date` already
  serves category-filtered transfer queries; 005/006 backfills are indexed and `ON CONFLICT`-safe.
- `migrate.mjs` checksum guard and `--reset` name guard intact.
- Dockerfile multi-stage, non-root user, sensible `.dockerignore`.
- Axios timeouts set (`EXPO_PUBLIC_API_TIMEOUT_MS`, 15s default); server FX fetch has `AbortSignal.timeout`.
- 09-21 date-filter fix still in place (`transactions.service.ts:257,260`, no `::date`).
- LA-03: 401/403 logged at WARN with actor/role/target (`all-exceptions.filter.ts:52-56`).

## Fixes Applied

None in this pass — read-only per the skill's framing. Closed afterwards in
`2026-09-24-infra-audit-fixes.md` (all except C #8, C #9, T3 #14, and the T3 lint/role-matrix/
currency-CHECK items).

## Follow-ups

- Tier 1 #1–#6 are each under an hour and independent; #1 is a regression from the 09-21 fixes and
  breaks the documented Docker path today.
- Tier 2/3 as listed; carried items keep their 09-21 numbers for continuity.
