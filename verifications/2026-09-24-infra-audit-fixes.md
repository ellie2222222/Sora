# Fixes for the 2026-09-24 infra audit findings

**Date:** 2026-09-24T06:01:59Z
**Method:** ad hoc
**Verdict:** PASS
**Scope:** every finding in `2026-09-24-infra-audit.md` except those listed under Follow-ups
**Files touched:** `docker-compose.yml`, `docker-compose.gui.yml` (deleted), `server/Dockerfile`, `scripts/migrate.mjs`, `.env.example`, `.github/workflows/ci.yml`, root/server/contracts `package.json`, `package-lock.json`, `server/src/{main.ts,config/env.ts,database/database.service.ts,common/request-logging.ts,common/all-exceptions.filter.ts,common/rate-limit.service.ts,audit/audit.service.ts,transactions/transactions.service.ts}`, `server/test/{rate-limit.service.test.ts,exchange-rate.service.test.ts}`, `mobile/package.json`, `mobile/src/{utils/errors.ts,utils/errors.test.ts,utils/calculatorEngine.ts,utils/calculatorEngine.test.ts,services/sync/syncEngine.ts,services/sync/syncEngineRuntime.ts,services/sync/syncEngine.test.ts,components/ErrorBoundary.tsx,components/useCalculatorExpression.ts,components/MoneyInput.tsx,components/index.ts,App.tsx,app/store/api/guestFallback.ts,app/store/api/*Api.ts (7),app/i18n/locales/{en,vi}.ts,features/accounts/screens/AddAccountScreen.tsx,features/transactions/components/AddTransactionModal.tsx}`, `CLAUDE.md`, `README.md`, `RUNBOOK.md`
**Related reports:** `2026-09-24-infra-audit.md` (the findings this closes)

## Method

```bash
npm run typecheck                                  # all packages
npm test -w @sora/contracts
npm run test -w @sora/server
cd mobile && npx tsc --noEmit && npm run test
node scripts/check-contract-parity.mjs
npx expo export --platform android --output-dir <scratchpad>/export-android
docker compose config; docker compose --profile gui config
# image + stack end-to-end on scratch-infra-7c1e-* containers, port 3997 (removed afterwards)
```

## Findings

| Audit # | Fix | Evidence |
|---|---|---|
| T1 #1 | pgadmin/adminer under `profiles: ['gui']`, `PGADMIN_DEFAULT_PASSWORD:-`, pinned `dpage/pgadmin4:9`/`adminer:6`; `docker-compose.gui.yml` deleted | `docker compose config` valid with and without `--profile gui` on the blank `.env.example` |
| T1 #2 | `app.enableShutdownHooks()` | scratch stack `docker stop` → pool closed log line, exit 0 |
| T1 #3 | CLAUDE.md dev commands, CI order, compose, env list, Part 7 rule 16; README/RUNBOOK migrate + gui flow; by-hand `psql -f` fallback removed | contracts `ℹ tests 75`; env list matches `grep` of `env.ts` keys (22) |
| T1 #4 | `.env.example` gains `NODE_ENV`, `DATABASE_*_TIMEOUT_MS`, `CORS_ORIGINS`, `EXCHANGE_RATE_*`, `MIGRATIONS_DIR`; compose passes them | read back |
| T1 #5 | `engines.node ">=22.18"` | read back |
| T1 #6 | root `overrides` removed | `npm ls react-native-gesture-handler react-native-worklets` → one version each |
| T2 #7 | one-shot `migrate` service; server `depends_on: service_completed_successfully`; image copies `scripts/migrate.mjs` + `db/migrations` | scratch run: migrate applied 6, second run no-op; health `database: up` |
| T2 #8 | CI `server: needs: [contracts, database]` | read back |
| T2 #9 | typescript `~6.0.3` in server + contracts | `npm ls typescript` → single 6.0.3; typecheck exit 0 |
| T2 #10 | `prod-deps` stage `npm ci --omit=dev`; `HEALTHCHECK` on `/api/v1/health` | scratch container `healthy`; no `typescript` in image `node_modules`. First attempt probed `/health` (404) — caught by this run, fixed |
| T2 #11 | `request-logging.ts`: request id (reused if well-formed), access line, `/health` skipped, nosniff + no-referrer; JSON logs in production; exception filter logs `rid=` | scratch run: JSON access line, `x-request-id` echoed, health not logged |
| T2 #12 | `MAX_FAILED_ATTEMPTS = 5`, backoff 30s·2ⁿ⁻¹ capped 30m, then `markConflict`; `requestSyncNow` ignores backoff | `syncEngine.test.ts` +3 |
| T2 #13 | `isNetworkError` keyed on status 0 / axios codes / no `response`; bare "fetch"/"connection" removed | `errors.test.ts` 3 tests |
| C #10 | `readWithGuestFallback` replaces 13 copies across 7 slices | mobile tsc clean, tests 301/301 |
| C #11 | `AddAccountScreen` renders `AddAccountModal`; account-type keys still used via the type-label map | grep: 1 non-locale use each |
| C #12 | create/update/delete + audit inside one `db.transaction()`; audit insert wrapped in a `SAVEPOINT` so its swallowed failure can't abort the caller | server 25/25 |
| C #13 | rate-limit `sweep()` every 60s (`unref`), cleared on destroy; unlocked streaks expire after 24h | `rate-limit.service.test.ts` 3 tests |
| C T3 | CORS allowlist (`CORS_ORIGINS`; none in production when unset); pool `statement_timeout`/connection/idle timeouts; mobile `ErrorBoundary` around the navigator | scratch run: production CORS preflight gets no `Access-Control-Allow-Origin` |
| T3 #15 | `migrate.mjs` holds each file's trailing `COMMIT` until the `schema_migrations` insert; refuses a file without one | scratch run applies all 6 in their own transactions |
| T3 #16 | `expo-sqlite`, `babel-preset-expo`, `react-native-reanimated` → `~`; `pg ^8.23.0` | read back |
| T3 #17 | exception filter logs `pathOf(request)` (no query string) | read back |
| Mobile dup | `formatExpressionDisplay` + `useCalculatorExpression` shared by `MoneyInput` and `AddTransactionModal` | `calculatorEngine.test.ts` +4 |

Final run: `npm run typecheck` exit 0 · contracts 75/75 · server 25/25 · mobile 301/301 · parity 31/31 · Android export bundled (7.4 MB hbc).

## Fixes Applied

As tabled above. The user's `sora-postgres` container was not touched; scratch containers, network and `sora-server:verify-infra` image were removed by their unique names.

## Follow-ups

- C #8 unbounded scans: deliberate at personal scale per `dashboard.service.ts` header.
- C #9 composite index: `uq_wallet_member` already serves the lookup.
- T3 lint tooling: needs an ESLint config choice.
- T3 role-matrix tests: need a DB-backed server test harness.
- T3 currency-match CHECK: needs a trigger (cross-row) design.
- T3 #14 `NOT VALID` constraints: guidance for the next migration only.
- Crash-reporting vendor for `ErrorBoundary`: the user's choice.
