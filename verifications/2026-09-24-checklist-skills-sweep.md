# Front-End Checklist skills applied to the app: security, API errors, money math, lists, touch/contrast, dependencies

**Date:** 2026-09-24T08:43:30Z
**Method:** ad hoc — seven vendored checklist skills (`mutation-testing`, `token-storage-security`, `leaked-secrets`, `stack-trace-exposure`, `touch-targets`, `color-contrast`, `list-virtualization`, `dependency-audit`) run by read-only agents; findings re-read in the repo before fixing; `scratch-probe` for the refresh race
**Verdict:** PASS for the fixes applied. The open findings are listed under Follow-ups.
**Scope:**
- the whole app for the security, list and dependency checks;
- `money.ts`/`calc.ts` for mutation testing;
- the keypad sheets plus a sweep of `mobile/src` for touch targets and contrast.

**Files touched:**
- `server/src/auth/{auth,token}.service.ts`
- `server/src/common/{all-exceptions.filter,app-error}.ts`
- `server/test/all-exceptions.filter.test.ts` (new)
- `mobile/src/app/providers/AuthProvider.tsx`
- `packages/contracts/test/{money,calc}.test.ts`
- `docs/API_SPECIFICATION.md` §5.3, §5.4

**Related reports:** `2026-09-24-i18n-audit.md`, `2026-09-24-infra-audit-fixes.md`

## Method

- The agents only read code. Mutation testing ran on a copy at `scratchpad/mut-contracts`, with `node_modules` as a junction. After each run, `diff -r` against the repo's `src` came back identical.
- `npm audit --json` and `npm outdated -ws`, read-only.
- Refresh race:
  - Scratch container `scratch-refresh-1103`, image `postgres:17`, at `127.0.0.1:55441`, database `scratch_refresh_1103`.
  - `node scripts/migrate.mjs` applied 001–006.
  - The built server ran on port 3997 with fake secrets.
  - `scratchpad/refresh-probe.mjs` registered 4 `probe+<uuid>@example.invalid` users.
  - Results were read back with `psql`.
- Re-checks after the fixes:
  - `npm run typecheck` (all packages)
  - `npm run test -w @sora/server`
  - `npm run test -w @sora/contracts`
  - `npm run test` in `mobile/`
  - `node scripts/check-contract-parity.mjs`
  - `npx expo export --platform android`
  - `mutate.mjs`/`mutate2.mjs` re-run against the new tests

## Findings

### Security (token-storage-security, leaked-secrets)

1. **Refresh rotation race (MEDIUM): FIXED.**
   - The cause: `refresh()` checked `revoked_at` outside the transaction, and `revokeToken` never looked at its affected-row count. Two concurrent refreshes could each get a fresh pair, which is two live families with no replay detection.
   - Probe, 10 concurrent refreshes with one token: `200` once and `401 TOKEN_INVALID` nine times. The winner's new token then returned `401`, because its family was revoked.
   - Audit for that user: `TOKEN_REFRESHED:SUCCESS 1`, `TOKEN_REPLAY_DETECTED:DENIED 10` (9 losers + the re-check), 0 live tokens.
   - A sequential rotation still gives `200`, and replaying the old token gives `401`, which also kills the new token. PASS.
2. **Logout revoked any refresh token presented, whoever owned it (INFO): FIXED.**
   - Probe: a logout presenting another user's token returns `204`, and the owner's token still refreshes with `200`.
   - Logging out with your own token revokes it: `401` afterwards. PASS.
3. **Previous account's data survived logout (MEDIUM): FIXED.**
   - Logout, guest exit and guest upload cleared only the unused `@tanstack/react-query` client. The RTK Query `apiSlice` cache was never reset: a search for `resetApiState` returned nothing.
   - A failed refresh also ends the session through `session.clear()` alone, and nothing reset the cache on that path either.
   - Fix: `clearServerCache()` resets the RTK Query cache as well as calling `queryClient.clear()`. It runs at all three call sites and whenever `stored` becomes `null`.
   - Verified by typecheck, 310/310 tests and the bundle. Not driven on a device.
4. **Checked clean:**
   - tokens are kept only in SecureStore and memory, never AsyncStorage;
   - there is no redux-persist;
   - tokens travel only in headers and POST bodies;
   - refresh and invitation tokens are stored hash-only;
   - JWTs are pinned to HS256;
   - no token reaches a log;
   - `.env` was never committed on any branch;
   - no secrets are tracked, and the `EXPO_PUBLIC_*` variables are public client IDs only.

### API error responses (stack-trace-exposure)

5. **No stack, pg text, SQL or file path reaches a client (PASS).** Five low-severity items were found; items 1, 2, 4 and 5 are FIXED in `all-exceptions.filter.ts`:
   - an `HttpException` at 5xx now returns the fixed message instead of its own text;
   - mapped framework 4xx errors (a malformed JSON body quotes the body) return the code's default message, and the original text goes to `internal`;
   - a thrown non-Error is now logged via `util.inspect` instead of with no content;
   - the generic 500 message comes from `defaultMessage('INTERNAL_ERROR')`, one source instead of two strings.
   - Covered by 7 new tests (`server/test/all-exceptions.filter.test.ts`), including a fake pg FK error and an assertion that no `detail`, constraint or stack appears in the body.
   - Server tests: 32/32.
6. **An unknown route returns code `INTERNAL_ERROR` with status 404: OPEN.** The fix needs a new `ERROR_CODES` entry, which is a contract change. See Follow-ups.

### Money math (mutation-testing)

7. **The first run scored 33/58.** The real gaps:
   - BR-06 transfer/income exclusion with the budget's own category (`calc.ts:103`);
   - the category filter (`:105`);
   - the `isOverBudget`/`isGoalReached` equality boundaries;
   - the day-vs-month comparison in `calendarDay`;
   - `parseMoney` rejecting a leading `+` and a bare `1.`, and trimming whitespace;
   - the number-input path;
   - `formatMoney` leading zeros;
   - rounding of negative percentages;
   - the zero predicates, `minOf`, and `formatCurrencyInput(…, false)`.

   FIXED: 11 tests were added, and contracts went from 75 to 86 tests, all passing.
   - **Re-run:** `mutate.mjs` 44/55 and `mutate2.mjs` 6/7.
   - **Remaining survivors:**
     - equivalent: `money.ts:17` and `:54` (the range check can never fire behind the regex), `:62`, `:133`, `calc.ts:58` (from≠to is a DB constraint) and `:203`;
     - `money.ts:95`, which the agent had classed as a gap but is equivalent: `split('.')` plus `parts[1]` already drops a second dot;
     - `\d{1,16}`, which changes only the error message.
   - Every non-equivalent gap is killed.

### Lists (list-virtualization): all OPEN, feature-sized

8. **HIGH: goal contributions show only the first 25.**
   - `services/api/goals.ts:42-47` sends no page and drops `pagination`.
   - The header's `currentAmount` covers all contributions, so the visible history stops adding up to it.
9. **HIGH: the wallet activity (audit) screen is capped at 50** (`WalletActivityScreen.tsx:20`), with no "load more".
10. **HIGH: the transaction list fetches `pageSize: 200` with no paging** (`TransactionListScreen.tsx:57`), so yearly windows are cut off.
    - All the rows mount at once through `RefreshableScrollView` plus `.map()`.
    - `groupTransactionsByDay` isn't memoized.
11. **MEDIUM: list helpers throw away `pagination`, while those server endpoints return unpaginated arrays.** That contradicts API-05; decide whether they are bounded and amend the spec, or paginate them.
12. **LOW:** categories render as a FlatList of three sections, each a `.map()`. Accounts and pickers use ScrollView plus `.map()`, which is fine at realistic counts.

### Touch targets and contrast: OPEN

13. **Below 44pt:**
    - `Button` md height 38 (every type/period toggle);
    - the compact `AccountPicker` pill, 32;
    - `AccountRow`, about 35;
    - the IconChip clear X, 38;
    - the DateField clear X, 32;
    - the keypad operator pairs, 38.5 wide at 360pt;
    - ThemeToggle, 30;
    - the pull indicator, 36;
    - ConnectionSyncStatus icons, 32;
    - the category trash icon, 32;
    - member actions, 42.
14. **Contrast:**
    - Input, field and checkbox borders are 1.14 (dark) and 1.23 (light), below the 3:1 non-text minimum; a `borderControl` token is proposed.
    - The keypad confirm key uses `opacity: 0.5` instead of the disabled tokens.
    - Pressed feedback on keys and cells is 1.01 in dark.
    - ThemeToggle uses literal hex colours (MB-06), and its thumb against the track is 1.23–1.28.
    - Starter category colours as icon tints are below 3:1 in light mode.

### Dependencies (dependency-audit): OPEN

15. **18 vulnerabilities: 3 high, 15 moderate, 0 critical.**
    - **kysely 0.27.6 (high):** no JSON-path, `sql.lit` or `Kysely<any>` in use, so it isn't reachable. The fix is 0.29, which is breaking.
    - **@nestjs/platform-express → multer (high):** there are no upload routes, so it isn't reachable. The in-range bump to 11.2.6 fixes it.
    - **@react-navigation → decode-uri-component (moderate):** in-range bump available.
    - **expo/ngrok uuid chain:** dev-only, no fix yet.
    - CI has no audit step and there is no Dependabot. The lockfile is committed, and the Dockerfile installs production dependencies only.

## Fixes Applied

As listed in 1, 2, 3, 5 and 7, each re-verified by the check named. Totals:
- `npm run typecheck` exit 0;
- server 32/32, contracts 86/86, mobile 310/310;
- parity 31/31;
- Android export bundled (3756 modules).

API spec §5.3 now describes the concurrent-refresh behaviour, and §5.4 states that logout only revokes the caller's own token.

**Teardown:** the server was stopped by the PID on port 3997 after confirming it was `node`. The container was removed with `docker rm -f scratch-refresh-1103`. `docker ps` afterwards shows only `sora-server` and `sora-postgres`, as before.

## Follow-ups

- **Offline queue:** it has no user scope and isn't cleared on logout (`offlineQueueDb.ts:85-92`), so user A's queued writes would replay under user B's token. Choose between per-row `user_id` and clear-on-logout with a warning; that's a product decision.
- **Release builds:** they accept `http://` for the API (`app/config/env.ts:12,26`). Refuse non-https outside `__DEV__`.
- **Android backups:** `allowBackup="true"` (`AndroidManifest.xml:14`) backs up the guest ledger and offline queue. Set it through app.json or a config plugin.
- **Compose defaults:** `docker-compose.yml` defaults `POSTGRES_PASSWORD` and publishes 5432 on all interfaces, and `.env.example` carries an inline dev password.
- **Unknown-route code:** needs a new `ROUTE_NOT_FOUND` (or similar) in `ERROR_CODES`/`ERROR_STATUS`, plus a spec update.
- **Pagination:** items 8–11, a shared infinite-scroll pattern with RTK Query `merge`/`serializeQueryArgs` and `onEndReached`.
- **Touch targets and contrast:** items 13–14, including a new `borderControl` token and colours.test pairs for control borders.
- **Dependencies:** bump `@nestjs/*` to 11.2.6 and `@react-navigation/*` within 7.x, add `npm audit --omit=dev --audit-level=high` to CI, and plan kysely 0.29.
- **MB-02:** `@tanstack/react-query` holds nothing. Remove it together with `QueryProvider` and the `queryClient` calls, or keep it as documented.
