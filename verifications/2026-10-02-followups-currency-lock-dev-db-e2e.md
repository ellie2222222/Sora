# Follow-ups: account currency lock, dev database before 012, E2E failures

**Date:** 2026-10-02T12:37:03Z
**Method:** ad hoc
**Verdict:** PASS
**Scope:** the open follow-ups of `2026-10-02-double-check-session-changes.md`: the currency-change race, the dev-database check before migration 012, the E2E failures, leftover files and line-ending churn.
**Files touched:** `server/src/accounts/{account-currency-lock,accounts.service}.ts`, `server/src/transactions/transactions.service.ts`, `server/src/goals/goal-contributions.service.ts`, `server/test/integration.accounts.test.ts`, `docs/API_SPECIFICATION.md`, `docs/test-plans/{accounts,README}.md`, `mobile/e2e/flows/pull-to-refresh.yaml`, `mobile/app.config.js`, `CLAUDE.md`, `AGENTS.md`, `.gitattributes`
**Related reports:** follows `2026-10-02-double-check-session-changes.md` and `2026-10-02-test-suite-audit.md`

## Method

- Server suite on the throwaway cluster (port 55443, `scratch_gapfill_91c7`): `npm run test -w @sora/server`.
- The race tests with the locks removed: `dist/src/accounts/account-currency-lock.js` replaced by no-ops, then `node --import ./dist/test/setup.js --test dist/test/integration.accounts.test.js`, then a rebuild and a rerun.
- Dev database: `docker start sora-postgres` (only that container; `docker compose up` would run `migrate` first), then `psql` in `BEGIN READ ONLY`, then `node scripts/migrate.mjs`, then `docker stop sora-postgres`.
- E2E: `gh run view 37000980312 --log-failed`, `gh run download 37000980312` (screenshots, screen hierarchy, `crash-report.txt`, `api.log`).
- `npx expo config --type introspect --json`, with and without `SORA_E2E_BUILD=1`.
- `npm run typecheck`, `node scripts/check-contract-parity.mjs`, `npm run test -w @sora/mobile`, `npx expo export --platform android`, `npm run agents:check`.

## Findings

| # | Checked | Evidence | Verdict |
|---|---|---|---|
| 1 | Currency change racing a write that names the account | With the locks removed: both race tests fail, `actual: [201, undefined]`. With them: 10/10 accounts tests, 197/197 server | Fixed |
| 2 | Dev database before 012 | `sora_dev` (PG 17.11) has the project's 16 tables, migrations 001–009 applied and 0 users/transactions/budgets. `bad budgets=0`, `bad goal tags=0` | PASS; 010–012 applied, `chk_budget_kind` and `chk_transaction_goal` `convalidated = t` |
| 3 | E2E pull-to-refresh | Screen hierarchy: `list-transactions` at y 331–584 of 640. The swipe began at 35% (y 224, the summary card). `api.log` shows no `GET /transactions` after the 11:45:08 `POST` | Fixed: swipe from 56% to 95%, about 250 dp; a 110 dp pull needs about 146 dp |
| 4 | E2E record-expense | `crash-report.txt`: SIGSEGV `SEGV_ACCERR` 3 s after launch, in `android_unsafe_frame_pointer_chase` ← `gwp_asan::...RecordBacktrace` ← `libhermesvm.so` … `hoost_make_fcontext` | Fixed by `android:gwpAsanMode="never"`; introspect shows it on both builds. The cause is inferred from the trace and not reproduced |
| 5 | `.agents/skills` showed as modified | Index blob = working-tree bytes (`cmp` identical); index stat size 12943 vs 12773 on disk, so stale entries from a CRLF checkout | Fixed: entries refreshed (nothing staged); `.gitattributes` `* text=auto eol=lf` |
| 6 | TC-GST-08 | Reads share `readGuestOrApi`; writes branch in one line per endpoint into guest services `guestNoNetwork.test.ts` proves network-free | Left Partial: a helper would not make `app/store/api` loadable under node |

## Fixes Applied

- 1: `lockAccountsInCurrency` (`FOR SHARE` plus a currency re-check) runs in the transaction and contribution create paths. `lockAccountForCurrencyChange` (`FOR UPDATE`) runs in the currency change, whose check, update and audit row now share one transaction. §9.4 states the guarantee, and TC-ACC-16 was added. Re-verified by the full server suite and by the locks-removed run above.
- 3, 4: re-verification needs the next CI E2E run.

## Follow-ups

- Push and watch E2E. TC-SYNC-20, TC-GST-09 and TC-GST-18 can close once it passes.
- `node-forge` exemption: review by 2026-11-02.
