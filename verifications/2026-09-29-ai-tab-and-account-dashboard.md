# AI assistant tab, accounts moved into the dashboard, per-account dashboard

**Date:** 2026-09-29T12:24:23Z
**Method:** ad hoc
**Verdict:** PASS (server and database; the mobile screen was not exercised on a device)
**Scope:** migration 007, contracts (AI enums/schemas/routes/errors, `dashboardQuerySchema.accountId`), `server/src/ai/`, dashboard account scope, mobile AI tab, `AccountsOverview`/`AccountScopePicker`, API spec §14.1/§17, SRS DASH-US-04/AI-US, SDS
**Files touched:** see the session summary
**Related reports:** 2026-09-29-wallet-sheet-and-offline-wallets.md

## Method

- `npm run build -w @sora/contracts`, `npm run test -w @sora/contracts`
- `node scripts/check-contract-parity.mjs`
- `npm run typecheck -w @sora/server`, `npm run test -w @sora/server`
- `npm run typecheck -w @sora/mobile`, `npm run test -w @sora/mobile`, `npm run export -w @sora/mobile`
- Reachability check of `.env` `DATABASE_URL` (host `localhost:5432/sora_dev`) with `pg`; `docker ps`
- Re-run 2026-09-30 on a scratch container: `docker run -d --name scratch-ai-84f0 -e POSTGRES_USER=scratch -e POSTGRES_PASSWORD=scratch -e POSTGRES_DB=scratch_ai_84f0 -p 127.0.0.1:55432:5432 postgres:17`, then with `DATABASE_URL=postgresql://scratch:scratch@127.0.0.1:55432/scratch_ai_84f0`: `node scripts/migrate.mjs`, `node scripts/migrate.mjs --constraints`, `npm run test -w @sora/server`; removed with `docker rm -f -v scratch-ai-84f0`

## Findings

- Contracts: build clean; tests 114 pass, 0 fail → PASS.
- Parity: 38/38. Includes `AI_MESSAGE_ROLES`↔`chk_ai_message_role`, `AI_ACTION_TYPES`↔`chk_ai_message_action_type`, `AI_ACTION_STATUSES`↔`chk_ai_message_action_status`, every `/ai/...` route in the API spec, and a status for each new error code → PASS.
- Server: typecheck clean. 37 tests pass, including `mounted routes` (all 7 AI routes mounted through DI) and `MockLlmProvider amount parsing` (50k, 1.5tr, 65,000, 65.000, 12.50, 2 triệu, zero rejected) → PASS.
- Server integration: `integration.ai.test.ts` (7 cases: draft → confirm → balance, double confirm 409, ambiguous account / USD in VND gives no draft, dismiss, newest-first paging, viewer gets no draft, stranger 404 for wallet and conversation, delete cascade) and the new ledger case (dashboard `accountId` scope) were skipped with `DATABASE_URL is not set` → BLOCKED.
- `db/tests/002_ai_messages.sql` and migration 007 not applied: `localhost:5432` refused the connection, Docker daemon not running, no `psql`/`initdb` on the host → BLOCKED.
- Re-run on the scratch database: 7 migrations applied including 007; `PASS 001_constraints.sql`, `PASS 002_ai_messages.sql`; server tests 85 pass, 0 fail, 0 skipped, including `AI assistant against a real database` and `the ledger against a real database` (per-account dashboard) → PASS. Teardown: container list and dangling-volume count (17) match the pre-run baseline.
- Mobile: typecheck clean; tests 528 pass; the Android export bundle was built → PASS. The screen has not been exercised on a device.

## Fixes Applied

- `server/test/integration.ledger.test.ts`: `outside.body!.error.code` → `outside.body?.error?.code`, the pattern the other suites use (typecheck error TS2532). Re-verified by typecheck.
- `utils/errors.ts` `ERROR_CODE_TO_I18N_KEY` lacked the three new AI codes (TS2739). Added them, with en/vi strings. Re-verified by typecheck.
- `ai.service.ts` and `mock-llm.provider.ts` had inline `'ACTIVE'`/`'EXPENSE'`/`'EDITOR'` literals. Replaced them with `AccountStatus`, `CategoryStatus`, `TransactionType` and `REQUIRED_ROLE`.

## Follow-ups

- `CategoryList` is registered in `AppNavigator` but nothing navigates to it. This was already true at HEAD and is not caused by removing the Accounts tab.
- The chat loads the latest 100 messages only; older pages are not reachable from the app yet (the API pages them, §17.4).
- `confirmAction` creates the transaction on its own connection while holding the message lock. If the status update then failed, the draft would stay PENDING with the transaction recorded.
