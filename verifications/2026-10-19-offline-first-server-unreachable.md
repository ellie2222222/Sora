# Signed-in app stays usable while the Sora API is unreachable

**Date:** 2026-10-19T03:22:02Z
**Method:** ad hoc
**Verdict:** PASS — unit tests and on an Android emulator (Maestro, 9/9 flows)
**Scope:** Why screens showed "Something went wrong. Please try again." with the server down, and the shared fixes: error classification, session survival, saved-copy reads, reconnect detection, unanswered writes, per-screen states.
**Files touched:** see `git status`; `mobile/src/{utils,services/{auth,sync},app/store/api,components,hooks,features/*}`, ten locale catalogs, `mobile/e2e/`, `.github/workflows/ci.yml`, `server/src/common/idempotency.interceptor.ts`, `SDS.md` §4.4, API spec §2.10
**Related reports:** none

## Method

- Read-only audit of every signed-in read consumer (subagent): 24 findings, below.
- `node --test` on each changed/added test file, then `npm test -w @sora/mobile`.
- `npm run typecheck` (root), `node scripts/check-contract-parity.mjs`.

## Findings (root causes)

1. **Gateway/tunnel answers were classified as server errors.** `toApiError(502, '<html>…')` kept status 502, so
   `isNetworkError` was false: reads skipped the saved copy, screens showed the error state, and the sync engine
   parked a tunnel's 404 as a `conflict`. The API wraps every error it sends (`all-exceptions.filter.ts`), so a
   bare status means the API never answered → now status 0. The old test pinning the opposite existed because
   "offline" used to switch to guest data, which rule 17 removed.
2. **Server outage could sign the user out.** `isRefreshRejection` treated any 4xx on `/auth/refresh` as the
   token being refused; an offline tunnel answers 404 → session cleared. Now requires the API's envelope.
3. **Recovery depended on NetInfo.** `syncEngineRuntime` refreshed only on a NetInfo offline→online edge; a
   server outage with internet up never produces one, so screens stayed on saved copies and the header said
   "Connected". Now any change of the shared reachability flag drives it, and a `/health` probe with backoff
   (5/10/20/40/60 s) runs while the flag is down.
4. **Unanswered writes failed instead of queueing** when the flag was still up. `sendOrQueue` queues them
   under the Idempotency-Key the attempt used.
5. **`StateView` turned screens' own `new Error(t('…'))` into "Something went wrong"** (7 call sites) and
   rendered `null` for a network error with no saved copy (blank panes). Now shows the screen's message, and
   an informational "Can't reach Sora / nothing saved on this device yet" view with a retry.
6. **Failed reads shown as empty data**: AccountsOverview, WalletActivityPanel, CategoryListScreen,
   WalletMembersPanel, TransactionListScreen (plus last month's rows kept under a new month's label and a
   forever skeleton), AiChatScreen, detail modals' "not found". Each now shows the unreachable view.
7. `listInvitations` had no saved copy; now read through `readSignedInCached`.

Checked and already correct (audit): WalletProvider/NoWalletState, DashboardScreen, AuthProvider restore
(keeps session on network/5xx), AccountScopePicker, CategoryFilterChip, WalletSwitcher, ListLoadMoreFooter,
navigation (no queries), toasts only on mutations.

## Tests

| Command | Result |
| --- | --- |
| `node --test` errors, refreshRejection, signedInRead, networkState, reachabilityProbe, sendOrQueue | 45/45 pass |
| `npm test -w @sora/mobile` | 768/768 pass |
| `npm run typecheck` | exit 0 |
| `node scripts/check-contract-parity.mjs` | exit 0 |

New coverage: gateway/tunnel bodies → unreachable, API 5xx/404 → reached; `isServerFault`; tunnel 4xx keeps the
session; 5xx read served from saved copy without flipping the flag; flag emits only on change; probe backoff, cap,
cancel on success, restart on next outage, no ping without internet; `sendOrQueue` sends online, queues offline,
queues an unanswered write under the same key, never queues a refusal.

## Device run (second pass)

Setup: throwaway cluster (`initdb`/`pg_ctl`, `127.0.0.1:55471`, database `scratch_e2e_offline`; the dev role has
no CREATEDB), API from `server/dist` on 3417, `mobile/e2e/seed.mts`, `mobile/e2e/outage-switch.mts` on 3418,
release APK built in the existing `mobile/android` (already `usesCleartextTraffic="true"`, so no prebuild) with
`EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3418`, AVD `Medium_Phone` (x86_64), Maestro 2.10.0.

Live envelope check behind the classification rule: `GET /api/v1/nope` → `{"error":{"code":"ROUTE_NOT_FOUND"}}`;
`POST /auth/refresh` with a bad token → `{"error":{"code":"TOKEN_INVALID"}}`. Switch down → `502` with an HTML body.

`maestro test mobile/e2e/flows/server-outage.yaml …` — every step COMPLETED:
- every tab read while up; switch down; pull → header/toast "Can't reach Sora…" visible; "Something went wrong"
  not visible on Home, Planning, Dashboard, Settings; seeded row still listed (saved copy).
- expense added while down → "Changes waiting to sync", row listed.
- `stopApp` + `launchApp` while down → `screen-home`, not `screen-login`; queued row still listed.
- switch up (NetInfo unchanged) → "Data synced"; API count of the description = 1 (no duplicate).
Switch log: `API down`, `API up` per transition.

`maestro test mobile/e2e …` (all flows) → **9/9 Flows Passed in 14m 53s**: add-transaction, guest-relaunch,
guest-upload-choose-wallet, guest-upload-register, offline-sync, pull-to-refresh, server-outage, session-restore,
swipe-delete-transaction.

After the second pass: `npm run typecheck` exit 0; `npm test -w @sora/mobile` 771/771; `npm test -w @sora/server`
104/104; parity exit 0.

## Fixes Applied

As above; re-verified by the test runs listed.

## Follow-ups

Resolved in the second pass: device run (above); yearly chart now says when months failed to load
(`YearlyTrend`, `dashboard.someMonthsUnavailable`); idempotency retention 24 h → 30 days
(`RETENTION_MS`, API spec §2.10); outage/back toast (`useConnectivityToasts`, cooldown 2 min); CI e2e job runs
the switch and the new flow.

- The emulator's own `com.sora.app` (versionCode 2, other signing key) was uninstalled with approval for the run,
  then reinstalled from the pulled APK; its previous on-device data is gone (the flows' `clearState` resets it anyway).
- `mobile/android/app/build/outputs/apk/release/app-release.apk` is now an E2E build pointed at `10.0.2.2:3418`;
  the debug/dev-client outputs are untouched. The user's running `dev:server` restarted onto the rebuilt `dist`.
- The throwaway cluster's data directory is left in the session scratchpad (stopped); nothing in the repo or the
  dev database was touched.
- CI change is unverified until the workflow runs.
- Conflict policy unchanged: per-record FIFO; 403/404 park as `conflict`; other 4xx back off then park; 5xx back
  off indefinitely; the server's figures replace optimistic patches after sync.
