# Fixes for the 2026-10-05 infra audit findings

**Date:** 2026-10-05T03:40:00Z
**Method:** ad hoc (fixes applied by this session plus two scoped worker agents: mobile/src; docs/CI/Docker)
**Verdict:** PASS for everything exercisable here; server integration suites BLOCKED locally (no Postgres: Docker daemon down, no host binaries) — CI runs them against Postgres 17
**Scope:** the findings in [2026-10-05-infra-audit.md](2026-10-05-infra-audit.md) marked SAFE, plus the decision items the user pre-approved ("proceed all, i accept"), except those listed under Follow-ups
**Files touched:** see Fixes Applied
**Related reports:** [2026-10-05-infra-audit.md](2026-10-05-infra-audit.md)

## Method

```bash
npm install                                         # sync lockfile + local node_modules
npm ls @nestjs/core @tanstack/react-query prettier-plugin-tailwindcss react-native-reanimated @react-native-community/netinfo
npm run typecheck                                   # contracts, server, mobile
npx tsc -p server/tsconfig.json --noEmit --noUnusedLocals --noUnusedParameters
npm test -w @sora/contracts
env -u DATABASE_URL -u CI npm run test -w @sora/server
npm run test -w @sora/mobile
node scripts/check-contract-parity.mjs
node scripts/audit-runtime-deps.mjs
docker compose config --quiet                       # run by the docs worker
npm run agents:check
```

## Findings

- `npm ls`: `@nestjs/core@12.0.4` (was 11.2.6 locally), netinfo `12.0.1`, reanimated `4.5.1` deduped, react-query and prettier plugin absent. Lockfile: −122 lines.
- `npm run typecheck`: all three packages clean. Server `--noUnusedLocals --noUnusedParameters`: exit 0.
- Contracts 129/129 · server 58/58 unit (3 new `PathIdGuard` tests; 18 integration suites not run — no DB) · mobile 613/613, no `MODULE_TYPELESS_PACKAGE_JSON` warning.
- Parity: **58/58** (was 40/40 — S2 now checks the 18 single-quoted routes; all documented).
- Runtime audit: 0 unaccepted, 2 accepted (review 2026-11-02).
- `docker compose config --quiet` OK; ci.yml / dependabot.yml parse; `agents:check` 10 skills in sync; no `hashFiles` (rule 8).

## Fixes Applied

| # | Change |
|---|---|
| S1 | `server/src/database/database.service.ts`: pool `'error'` listener logs instead of crashing |
| S2 | `scripts/check-contract-parity.mjs:113`: route regex accepts `'`, `"`, `` ` `` |
| S3 | New `server/src/common/path-id.guard.ts` (global, after `JwtAuthGuard` in `app.module.ts`): a non-uuid path id → `404 ROUTE_NOT_FOUND` (spec §2.6's "no route matches"), before any guard queries it; `server/test/path-id.guard.test.ts` |
| S4 | `npm install` → local NestJS 12.0.4; "NestJS 12" in CLAUDE.md, AGENTS.md, README, SDS, `server/package.json` |
| S5 | Removed `hashesMatch`, `withMessage`, the unread `WALLET_ACCESS_KEY` stash, the unused `WalletIdSource` body/query branches (`RequireWalletRole(role)` now), `MIGRATIONS_DIR` (env.ts, .env.example, CLAUDE.md), `ROUTES.categories.detail` |
| S6 | `Executor` type once in `database/types.ts` (6 copies removed); `dayAfter` once in `common/utc-day.ts` (4 copies removed) |
| S7 | API spec dashboard query description; CLAUDE.md category hard-delete exception and contracts-build comment |
| S9 | `transactions.service.ts` update: `status != 'DELETED'` in the `WHERE`, `TRANSACTION_ALREADY_DELETED` when 0 rows |
| I2 | ci.yml: dependency audit is its own `audit` job nothing `needs:` |
| I4/I5 | Stale claims (env names, `EXPO_PUBLIC_API_BASE_URL`, Node 22.18+, `npm run dev:server`, DELETED not cancel, CI order, Budget kinds) and the Project Structure trees in CLAUDE.md / AGENTS.md |
| I6 | docker-compose `server` passes the 3 `DATABASE_*_TIMEOUT_MS` vars |
| I7 | Dockerfile `apk add` before manifest COPY; `.dockerignore` +7 entries |
| I8 | AGENTS.md / `.agents/rules`: MB-06 + test, MB-11, test-plans, react-query; 8 `file:///d:/...` links made relative |
| I9 | netinfo `12.0.1`, reanimated `4.5.1` exact; dependabot ignores Expo-managed majors/minors and tailwindcss ≥ 4 |
| I10/M11 | `prettier-plugin-tailwindcss` removed |
| I11 | ci.yml `permissions: contents: read`, `cancel-in-progress` on PRs only, `timeout-minutes` on every job |
| M1 | Settings dev test-transaction block and its queries removed |
| M2 | `currentData` in `MonthDataPoint`/`PeriodReport`; YearlyReport keyed by wallet + account |
| M4 | Wallet rename/archive invalidate Transaction/WalletInvitation/Account/Dashboard as relevant |
| M5 | `as any` removed (`DimensionValue`, `BaseQueryApi`) |
| M6 | `readSignedInCached` in `guestFallback.ts`, used by ai/audit/members slices |
| M7 | 8 deep cross-directory imports → `@/hooks`, `@/design-system`; why-comment on AddBudgetModal's deep import |
| M8 | Removed `draftFromTransaction`, `WEEKDAY_INITIALS`, `useAppSelector`, `selectQueueRows`, `CategoryDeleteMode`, `components/ScaleIn.tsx`, `app/navigation/tabBarMetrics.ts` |
| M9 | Tab skeleton 4 segments; real segments get `btn-transaction-filter-<TYPE>` (`btn-transaction-type-*` is taken by the add sheet that opens over this screen) |
| M10 | `CategoryListScreen` queries `skip` without a wallet |
| M12 | mobile test script `--disable-warning=MODULE_TYPELESS_PACKAGE_JSON` |
| M15 | `@tanstack/react-query` dependency, `QueryProvider` and `queryClient.clear()` removed; MB-02 in CLAUDE.md / AGENTS.md / `.agents/rules` / SDS / checklist updated |

## Follow-ups

- **Verify in CI:** S3 and S9 change request paths covered by the integration suites, which need Postgres (none here).
- **Decision, not done:** S12 LA-02 gaps (spec + code), S15 refresh-token retention, S16 `trust proxy` (deploy topology), M3 YearlyReport multi-currency chart, M16 axios base query, I3 contracts `dist` build steps, I13 orphan docs, I16 `webpage/` delete-or-freeze (deletes a whole app — needs an explicit yes for that action).
- **Needs a DB to write and prove:** S10 role-matrix gaps, S11 `expect_reject` constraint names.
- **Larger work, backlog:** S8, S13, S14, S17, S18, S19, I12 (plan checkboxes need per-item evidence), I14 (CI red triage), I15 (CI speed), M17, M18; M13/M14/M19 handed to extract-modules.
