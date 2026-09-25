# Follow-ups from the checklist sweep: queue ownership, pagination, touch/contrast, dependencies, hardening

**Date:** 2026-09-24T09:02:14Z
**Method:** ad hoc. Touch/contrast and pagination were done by two agents on disjoint files; everything else by the main session. The `scratch-probe` skill was used for the server paging and route-code checks.
**Verdict:** PASS (static and server paths exercised). Mobile UI changes were not driven on a device.
**Scope:** every follow-up from `2026-09-24-checklist-skills-sweep.md` except kysely 0.29, which is deferred by agreement, and the compose defaults.

**Files touched:**
- **Queue:** `mobile/src/services/sync/{offlineQueue,offlineQueueDb,offlineQueueTypes,testSupport}.ts`, the queue and sync tests, `mobile/src/services/auth/session{,.test}.ts`, `mobile/src/app/providers/AuthProvider.tsx`.
- **Config:** `mobile/src/app/config/{env,apiUrlPolicy,apiUrlPolicy.test}.ts`, `mobile/app.json`, `.env.example`.
- **Route code:** `packages/contracts/src/responses.ts`, `server/src/common/{all-exceptions.filter,app-error}.ts`, `server/test/all-exceptions.filter.test.ts`, `mobile/src/utils/errors.ts`.
- **Locales:** `mobile/src/app/i18n/locales/{en,vi}.ts`.
- **CI:** `.github/workflows/ci.yml`, `.github/dependabot.yml` (new), `package-lock.json`.
- **Touch/contrast agent:**
  - `mobile/src/components/{Button,IconChip,DateField,CalculatorKeypad,ThemeToggle,ConnectionSyncStatus,Input}.tsx`
  - `components/refresh/PullToRefreshIndicator.tsx`
  - `features/accounts/components/AccountPicker.tsx`, `features/categories/components/CategoryGrid.tsx`
  - `features/goals/components/AddContributionModal.tsx`
  - `features/{categories/screens/CategoryListScreen,wallets/screens/WalletMembersScreen}.tsx`
  - `design-system/{colors,colors.test,contrast,contrast.test,index}.ts`
- **Pagination agent:**
  - `mobile/src/app/store/api/{goalsApi,auditApi,transactionsApi}.ts`, `services/api/{goals,client}.ts`
  - `features/goals/screens/GoalDetailScreen.tsx`, `features/wallets/screens/WalletActivityScreen.tsx`, `features/transactions/components/TransactionListScreen.tsx`
  - `components/{TransactionListSection,TransactionTotals,ListLoadMoreFooter,index}.tsx`
  - `utils/{pagination,groupByDate}{,.test}.ts`
  - `server/src/{goals/goal-contributions.service,audit/audit.service,transactions/transactions.service}.ts`
- **Docs:** `docs/API_SPECIFICATION.md` §2.7, `SDS.md:465`, `plans/mobile/offline-sync-plan.md`.

**Related reports:** `2026-09-24-checklist-skills-sweep.md` (source of these follow-ups)

## Method

- **Static checks:**
  - `npm run typecheck` (all packages)
  - `npm run test -w @sora/contracts`, `npm run test -w @sora/server`, `npm run test` in `mobile/`
  - `node scripts/check-contract-parity.mjs`
  - `npx expo export --platform android`
- **i18n:** `scratchpad/i18n-audit.mjs`, re-run.
- **Dependencies:** `npm update <pkgs> -w <ws>` (in-range), then `npm audit --omit=dev` and `npm ls`.
- **Android backup:** `npx expo config --type introspect --json`, reading the generated manifest's `android:allowBackup`.
- **Scratch probe:**
  - container `scratch-paging-7c2e`, image `postgres:17`, at `127.0.0.1:55442`; migrations 001–006;
  - the built API on port 3996;
  - `scratchpad/paging-probe.mjs`, with 2 `probe+<uuid>@example.invalid` users. Each created 60 expenses on one date and 30 contributions on one date, then paged every list to the end.

## Findings

1. **Offline queue ownership: PASS.**
   - Rows carry `ownerUserId`, stored in the SQLite `owner_user_id` column. Existing installs get it through a `PRAGMA table_info` check and `ALTER TABLE ADD COLUMN`.
   - `OfflineQueue.setOwner()` filters visible and synced rows to that owner, and `enqueue` refuses when there is no owner. Rows written before the column existed are claimed by the next signed-in user.
   - `AuthProvider` sets the owner from the access token's `sub` claim (`userIdFromAccessToken`), so it also works on an offline start where `/me` never loads.
   - Guest writes branch off before `enqueueOffline`, so guest mode never reaches the queue.
   - Tests:
     - user switch hides and blocks the other user's rows;
     - enqueue while signed out rejects;
     - legacy rows are claimed;
     - `sub` decoding, including padding and malformed tokens.
   - Sync and auth suites 35/35.
2. **Pagination: PASS on the server, static only on mobile.**
   - All three lists use RTK 2.12 `builder.infiniteQuery`, load the next page on `onEndReached`, and reset to page 1 on pull-to-refresh. `ListLoadMoreFooter` shows loading, or an error with retry.
   - The transaction list is now a virtualized `RefreshableSectionList`. Period totals show only once `hasNextPage === false`, and the last loaded day's total is hidden until that day is complete.
   - Guest contributions come back as one complete page.
   - The agent added an `id DESC` tiebreak to the three server list orderings.
   - Probe results:
     - transactions, 3 runs × 3 pages: 60 rows, 60 unique each run;
     - contributions: 2 pages, 30/30 unique;
     - audit: 2 pages, 94/94 unique.
3. **Touch targets and contrast: static PASS.** The agent's 11 items, verified by typecheck and tests (colours and contrast tests, 350/350 total). Main changes:
   - `Button` md is 44 tall;
   - the keypad is a 4×4 block plus a date/confirm column, every key about 62pt wide, key height 48;
   - IconChip, DateField and ConnectionSyncStatus use real 44pt boxes;
   - `borderControl` gives at least 3.22:1 (was 1.14), and `surfacePressed` at least 1.48:1 (was 1.01);
   - ThemeToggle uses tokens only, and its thumb against the track is at least 4.72:1 (was 1.23);
   - `ensureContrast` brings all 33 starter category colours to 3:1 for icons and 4.5:1 for text.
   - I added three accessibility-label keys (en/vi): `members.memberActions`, `members.revokeInvitation`, `categories.deleteCategoryA11y`.
4. **Dependencies: PASS.**
   - `@nestjs/*` 11.2.3 → 11.2.6 (`multer` 2.4.0); `@react-navigation/*` bumped within 7.x (native 7.4.1).
   - `npm audit --omit=dev` went from 18 (3 high) to 12 (1 high = kysely, 11 moderate = the Expo `uuid` chain).
   - CI gained `npm audit --omit=dev --audit-level=critical`. It gates on critical until kysely 0.29 lands, because kysely's high advisories would fail it at the `high` level.
   - Dependabot was added (npm weekly with grouped packages, Actions monthly).
5. **Hardening: PASS.**
   - **Release https guard:** `assertSecureApiUrl` refuses `http:` outside `__DEV__` unless `EXPO_PUBLIC_ALLOW_INSECURE_API=true` (3 tests).
   - **Android backup:** `app.json` `android.allowBackup: false`; the introspected manifest shows `"false"`.
   - **Unknown routes:** `ROUTE_NOT_FOUND` added to `ERROR_CODES`/`ERROR_STATUS` and mapped to 404 in the filter, with en/vi messages. Probe: `GET /nope?token=secret` returns `404 {"code":"ROUTE_NOT_FOUND"} "No such endpoint"`, and the query string is not echoed.
6. **i18n:** 406 keys in en and vi, with 0 orphans, 0 missing keys, 0 parity gaps and 0 drift, apart from the known plural variants.

## Fixes Applied

As above.
- **Totals:** `npm run typecheck` exit 0; contracts 86/86, server 33/33, mobile 350/350; parity 31/31; Android export bundled (3757 modules).
- **Teardown:**
  - the server was stopped by the PID on port 3996 after confirming it was `node`;
  - `docker rm -f scratch-paging-7c2e`;
  - `docker ps` afterwards shows only `sora-server` and `sora-postgres`;
  - the server log has 0 error lines.

## Follow-ups

- **Device check, not done:**
  - the new keypad layout (5 columns; confirm fills the column when there's no date key);
  - the taller `md` toggles;
  - scroll paging and footers on all three lists;
  - pull-to-refresh resetting to page 1;
  - the 44pt icon boxes in the wallet header.
- **Local `mobile/android/`** still has `allowBackup="true"` until the next `expo prebuild`; it is gitignored and regenerated.
- **kysely 0.29:** a breaking upgrade. After it lands, raise the CI audit gate to `--audit-level=high`.
- **Compose:** `docker-compose.yml` still defaults `POSTGRES_PASSWORD` and publishes 5432 on all interfaces. Left alone because changing it would alter how the running `sora-postgres` is started.
- **Stale line numbers:** `plans/mobile/transaction-ui-plan.md:34,42` cite line numbers in the rewritten `TransactionListSection.tsx`. Historical plan, left as is.
- **Offline paging:** a signed-in user who goes offline partway through a list can get later pages from the local fallback while earlier pages came from the server. This behaviour existed before this pass.
- **Translator review:** vi strings added this pass: `errors.routeNotFound`, `common.loadingMore`, `common.loadMoreFailed`, `members.memberActions`, `members.revokeInvitation`, `categories.deleteCategoryA11y`.
