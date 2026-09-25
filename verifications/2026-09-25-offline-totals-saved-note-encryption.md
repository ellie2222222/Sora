# Offline totals, a "saved at" note, and SQLCipher for the sync database

**Date:** 2026-09-25T02:05:40Z
**Method:** ad hoc
**Verdict:** PASS (typecheck, unit tests, bundle, config introspect). Not driven on a device; encryption needs a dev/release build, as Expo Go has no SQLCipher.
**Scope:** the three optional follow-ups from `2026-09-24-per-account-local-cache.md`, plus the kysely advisory facts.

**Files touched:**
- **Totals:** `mobile/src/services/sync/{pendingTotals,pendingTotals.test}.ts`, `mobile/src/app/store/api/{pendingTotalsPatch,transactionsApi,accountsApi,goalsApi,apiSlice}.ts`, `mobile/src/services/sync/syncEngineRuntime.ts`
- **Note:** `mobile/src/services/sync/{localCache,localCache.test}.ts`, `mobile/src/hooks/{useSavedCopyTime,index}.ts`, `mobile/src/utils/{date,date.test}.ts`, `mobile/src/components/ConnectionSyncStatus.tsx`, `mobile/src/app/i18n/locales/{en,vi}.ts`
- **Encryption:** `mobile/src/services/sync/{syncDatabaseOpen,syncDatabaseOpen.test,syncDatabase,localCacheDb,offlineQueueDb,testSupport}.ts`, `mobile/app.json`
- **Docs:** `SDS.md` §4.4, `CLAUDE.md` project structure

**Related reports:** `2026-09-24-per-account-local-cache.md` (its follow-ups), `2026-09-24-follow-ups-pass.md` (kysely).

## Method

- `npx tsc --noEmit` in `mobile/`
- `npm run test` in `mobile/`, and each new test file alone with `node --test <file>`
- `npx expo export --platform android --output-dir $TEMP/sora-export`
- `npx expo config --type introspect --json`, then read the `expo.sqlite.useSQLCipher` Android gradle property and iOS Podfile property
- en/vi key flatten-and-compare over `locales/{en,vi}.ts`
- `npm audit --omit=dev --json` (kysely entry), `npm view kysely versions`, kysely 0.28.0 and 0.29.0 release notes
- A Grep of `server/`, `scripts/` and `packages/` for each API those release notes break

## Findings

1. **Offline totals (`pendingTotals.ts`): PASS, 22 tests.**
   - A queued transaction create or cancel, account create, or contribution moves the cached figures:
     - account balance and activity (`transactionCount` counts cancelled rows, as `activityForAccount` does);
     - wallet balances;
     - budget spent/remaining/usage/over, and goal current/remaining/progress/count;
     - on the dashboard: balance, income/expense/net, transfer in/out, the category split (dominant currency only, as the server does), the member split, recent transactions and active budgets.
   - Rules checked:
     - an internal transfer nets to zero;
     - a cross-wallet transfer shows only in transfer flow (BR-06);
     - an expense stamped 23:30 on the window's last day counts;
     - a PENDING transaction counts but moves no money;
     - cancelling reverses exactly;
     - precision holds at `999999999999999.9999`.
   - Patches go through `updateQueryData`, so `localCacheMiddleware` saves them and they survive a restart.
2. **Sync invalidation gap (found, fixed):**
   - `syncEngineRuntime` invalidated only `['Transaction']` after a transaction synced, and only `['Account']` after an account synced. Balances, the dashboard and budgets never picked up the server's figures.
   - Both now use the same sets the online mutations invalidate.
3. **Saved-copy note: PASS, 2 + 3 tests.**
   - `LocalCache` records each read key answered from a saved copy, and clears the key when it is next answered fresh.
   - The header shows "Saved 14:32", or "Sep 24 14:32" on an earlier day, for the oldest such copy; the connection sheet explains it.
   - An account switch clears the note. On reconnect, the first sync pass runs, then every tag is invalidated. Doing it after the pass means a refetch can't drop the offline patches before the server has the writes.
4. **Encryption: PASS, 9 tests on the orchestration.**
   - The key is 256-bit, from `expo-crypto`, held in SecureStore under `finance.syncDbKey.v1`.
   - Cases covered:
     - no SQLCipher: the plain file is used and no key is made;
     - fresh install: a key and an encrypted file are created;
     - an existing plain file is exported with its rows, then removed;
     - a half-finished copy is redone from the plain file;
     - a stored key opens the file with nothing copied;
     - a lost key recreates an empty file (it is unreadable anyway);
     - a stored key that fails to open the file throws and deletes nothing;
     - a malformed key is rejected before any SQL;
     - a failed delete of the plain file fails the open, and the copy is redone next launch.
   - Introspect shows `expo.sqlite.useSQLCipher = true` on Android and iOS.
5. **kysely:** the installed version is 0.27.6. There are three high advisories:
   - GHSA-wmrf-hv6w-mr66 (fixed after 0.28.11);
   - GHSA-8cpq-38p9-67gx (MySQL `sql.lit`, fixed after 0.28.13);
   - GHSA-pv5w-4p9q-p3v2 (JSON path, fixed in 0.28.17).

   So **0.28.17 fixes all three**. The earlier reports said 0.29 was required, which was wrong; npm's fix suggestion is simply the latest version.

   The server uses only `Kysely`, `PostgresDialect`, `Transaction`, `ColumnType`, `Generated`, `sql`, `returningAll` and `onConflict`. It has no JSON paths, no `sql.lit`, no `Kysely<any>`, and no MySQL.

   Grep for the APIs 0.28 and 0.29 break (`numUpdatedOrDeletedRows`, `InferResult`, `DefaultQueryExecutor`, `UpdateValuesNode`, `withTables`, `kysely/migration`, `Migrator`): 0 hits. TypeScript is 6.0.3; 0.29 needs 5.4 or later.
6. **Checks:**
   - `npx tsc --noEmit`: exit 0.
   - `npm run test`: 410/410.
   - Android export: bundled (3768 modules).
   - en/vi: 411/411 keys, none missing or extra.

## Fixes Applied

- Finding 2: `mobile/src/services/sync/syncEngineRuntime.ts`, `ENTITY_TAGS` for `transaction` and `account`. Re-verified by typecheck and the suite; the effect needs a device.

## Follow-ups

- **Device check:**
  - a SQLCipher dev build over an install that has queued rows, to confirm the rows survive the export;
  - the offline figures after a create, a delete and a contribution;
  - the note appears offline and clears after reconnect.
- **Not moved offline:** a queued edit's category or date change, and caches not loaded when the write was made. Both show the server's last figure until sync.
- **One-way encryption:** a later build without SQLCipher would open a new plain file and leave the encrypted one unread.
- **kysely:** closed. 0.28.17 landed, and the CI gate is at `--audit-level=high` (`2026-09-25-kysely-0.28-scratch-probe.md`).
- **Stale doc:** closed. `CLAUDE.md` Part 6 now says TypeScript 6.0 (`2026-09-25-comment-audit.md`).
- **Translator review:** `errors.savedCopyShort` and `errors.savedCopyDetail` (vi).
