# The 13 pre-production migrations folded into one schema file

**Date:** 2026-10-05T10:19:49Z
**Method:** ad hoc
**Verdict:** PASS
**Scope:** the user's request to collapse the schema/migration setup into one canonical file. The project is pre-production, so history is not preserved and the dev database may be reset.
**Files touched:**

- `db/migrations/001_schema.sql` (new); `001_initial_wallet_schema.sql` … `013_recurring_budgets_hard_delete.sql` (removed)
- `server/package.json` (duplicate `db:migrate` removed)
- `db/tests/001_constraints.sql` (comment)
- docs: `CLAUDE.md`, `AGENTS.md`, `RUNBOOK.md`, `SDS.md` §2/§7, `docs/API_SPECIFICATION.md`, test plans (ai, budgets, categories, goals, transactions)
- plans: `domain-database-design.md`, `ai-chat-assistant-plan.md`
- comments: `mobile/src/services/guest/{guestBudgets,guestBudgets.test,guestCategories,guestStore}.ts`, `mobile/src/design-system/contrast.test.ts`, `packages/contracts/test/schemas.test.ts`

**Related reports:** [2026-10-05-recurring-budgets-hard-delete.md](2026-10-05-recurring-budgets-hard-delete.md)

## Method

```bash
docker run -d --name scratch-schema-c309d162 -e POSTGRES_PASSWORD=scratch -e POSTGRES_DB=sora_test -p 127.0.0.1:5547:5432 postgres:17
# sora_check_old: the 13 old files via psql; sora_check_new: 001_schema.sql via psql
psql -f scratchpad/catalog.sql   # columns, constraint defs, indexes, extensions, sequences, non-empty tables; diffed
DATABASE_URL=…5547/sora_test node scripts/migrate.mjs --constraints; node scripts/migrate.mjs; node scripts/migrate.mjs --status
DATABASE_URL=…5547/sora_check_old node scripts/migrate.mjs           # a database built by the old files
node scripts/check-contract-parity.mjs
DATABASE_URL=…5547/sora_test npm run test -w @sora/server
npm run test -w @sora/contracts; npm run typecheck; npm run test -w @sora/mobile
docker build -f server/Dockerfile -t scratch-schema-c309d162-image .
# image: `node scripts/migrate.mjs` on an empty sora_docker_check, then the server; GET /health, POST /auth/register (probe+…@example.invalid)
docker rm -f scratch-schema-c309d162-server scratch-schema-c309d162; docker rmi scratch-schema-c309d162-image
# the user's dev stack (sora-postgres / sora_dev, 0 users, 0 transactions, 0 budgets beforehand):
docker compose build migrate server
docker compose run --rm --no-deps migrate node scripts/migrate.mjs --reset
docker compose up -d server
```

## Findings

- **Audit.** The schema setup is raw SQL in `db/migrations/`, applied by `scripts/migrate.mjs` with checksums kept in `schema_migrations`. There is no ORM migrator and no Kysely codegen config; `server/src/database/types.ts` is hand-written. Everything below reads that one directory:
  - `scripts/check-contract-parity.mjs`
  - the Dockerfile and the compose `migrate` service
  - CI (database, server and e2e jobs)
  - root `db:migrate`/`db:reset`/`db:test`/`setup`

  The one duplicate was `server/package.json`'s `db:migrate`, the same command as the root script. It is removed.
- **Fragmentation.** 13 files: 001, 003 and 007 created tables; the rest altered them, often redefining a constraint an earlier file had set (`chk_budget_period` in 001, 008 and 010; the budget overlap exclusions in 001, 008 and 013). Four also changed data: 004 (status rename), 005 and 006 (starter-category backfills), 013 (budget conversion). The data steps do nothing on an empty database and are gone. New wallets get starter categories from `packages/contracts/src/starter-categories.ts` at registration, unchanged.
- **Equivalence.** `diff cat_old.txt cat_new.txt` showed no differences (286 lines). That covers every column's type, length, precision, nullability and default; every constraint's full definition, including FK `ON DELETE` actions and the three `excl_budget_*` GIST exclusions; every index definition; the extensions (`pgcrypto`, `btree_gist`); and the sequences. Column order differs only for `budgets.goal_id` and `transactions.goal_id`, now placed beside the other foreign keys. Nothing addresses columns by position.
- **Empty database.**
  - `migrate.mjs --constraints` applied `001_schema.sql (632286a1533a9fb6)`; `001_constraints.sql` and `002_ai_messages.sql` PASS.
  - The second run printed `Up to date (1 migration(s) applied).` `--status` printed `APPLIED 001_schema.sql`.
  - The database has 16 tables: 15, plus `schema_migrations`.
- **A database built from the old files.** Running the new file against one exits 1 with `relation "users" already exists`. That message is now documented in RUNBOOK with the fix (`npm run db:reset`). No compatibility code was added.
- Parity 58/58. Server 227/227 (integration tests included, 0 skipped). Contracts 137/137. Typecheck clean. Mobile 631/631.
- **Docker image on an empty database.**
  - Migrate applied `001_schema.sql`.
  - `GET /api/v1/health` returned `{"status":"ok",…,"database":"up"}`.
  - Register returned `success: true` and seeded 1 wallet, 1 member, 38 categories and 1 account.
  - The scratch containers and image were removed by name; `docker ps -a | grep -c scratch-schema` → 0.
- **Your dev stack.**
  - Before: `sora_dev` had 12 old migrations recorded and 0 users, 0 transactions, 0 budgets.
  - `--reset` passed its disposable-name guard (`dev`), recreated `public` and applied `001_schema.sql`. `sora-migrate` then printed `Up to date`.
  - `/api/v1/health` returns ok.
  - `DELETE /api/v1/budgets/<id>` returns 401 and an unknown route returns 404, so the rebuilt image is serving current code.
- **Final sweep** (`rtk grep` for the old filenames and "migration NNN", outside `verifications/` and `webpage/`): no matches left.

## Fixes Applied

As above.

## Follow-ups

- Compatibility code for pre-baseline data still exists on the mobile side, outside the database:
  - `upgradeStoredBudgets` (`mobile/src/services/guest/guestStore.ts`) converts guest budgets saved on a device before budgets repeated;
  - the offline queue still sends a queued budget `archive` as `DELETE`.
  Both are pre-production device data, so they could go too. They were left in place because this pass was scoped to the database.
  **Done later the same day, at the user's request:** both are removed. A queued budget archive is now refused like a contribution's (`entityAdapters.ts:101`). Budget-archive wording is gone from SRS, the API spec and the categories test names. `npm run typecheck`: clean. Mobile: 631/631.
- Older `verifications/` reports name the removed files. They are historical records and were left as written.
