# Signed-in offline reads no longer hit the guest store; compose credentials; stale plan references

**Date:** 2026-09-24T09:10:27Z
**Method:** ad hoc
**Verdict:** PASS. Static checks plus unit tests; offline behaviour not driven on a device.
**Scope:** the remaining follow-ups from `2026-09-24-follow-ups-pass.md`: the offline mixed-page fallback, the compose defaults and the stale plan line references. Investigating the first turned up a larger bug (Finding 1).

**Files touched:**
- `mobile/src/app/store/api/{signedInRead,signedInRead.test,guestFallback,auditApi,membersApi}.ts`, plus 7 `*Api.ts` files for the rename `readWithGuestFallback` → `readGuestOrApi`
- `mobile/src/utils/pagination.ts`
- `docker-compose.yml`, `.env.example`
- `plans/mobile/transaction-ui-plan.md`
- `SDS.md` §4.4
- `CLAUDE.md` Part 7 rule 17

**Related reports:** `2026-09-24-follow-ups-pass.md`

## Method

- Read `readWithGuestFallback`, `ensureSeeded()`, `AuthProvider`'s `pendingGuestUpload` and `RootNavigator`.
- Searched the history (`git log -S`, commit `3dbaa73`), `verifications/2026-09-15-*offline*` and SDS §4.4 for the intent behind the fallback.
- `grep` of screen error handling (`isError && !isNetworkError`).
- `npx tsc --noEmit`; `npm run test` in `mobile/`.
- `docker compose config --quiet` with the real `.env`, and with an empty `--env-file`. Both are render-only, and no container was touched.
- `git show HEAD:mobile/src/components/TransactionListSection.tsx | grep borderTopWidth`

## Findings

1. **A signed-in user going offline was shown the guest ledger and sent to the guest-upload screen (bug): FIXED.**
   - How it happened: when a request found no network, or the device was flagged offline, `readWithGuestFallback` called `ensureSeeded()` and read the guest store. That store is a separate "Guest Wallet" ledger.
   - Three effects:
     - its result replaced the RTK Query cache for the user's real data;
     - seeding created `guestStore.wallet`, so `guestHasData` became true;
     - with a session stored, `pendingGuestUpload` became true (`AuthProvider`), and `RootNavigator` rendered the guest-upload screen.
   - No document intended this. SDS §4.4 says the offline queue "is not a second local dataset", and the offline-sync plan keeps RTK Query's cache as the read path.
   - `auditApi` and `membersApi` had the same shape: offline they returned an empty result, which wiped the cached activity and member list.
   - **Fix:** `readSignedIn` sends signed-in reads to the API only. On success it marks the device online; on a network failure it marks it offline and rethrows. There is no short-circuit while flagged offline, because the flag only clears on the next NetInfo change. All 13 read paths plus audit and members go through it.
   - **Why it's safe:** every screen already skips its error state for network errors (`isError && !isNetworkError(...)`), and RTK Query keeps the last data on a failed refetch.
   - This also settles the previous report's mixed-page follow-up: no page can come from the guest store for a signed-in user.
   - 3 new tests; mobile 353/353; `tsc` exit 0.
2. **Compose defaults: FIXED.**
   - `POSTGRES_PASSWORD` is now `${POSTGRES_PASSWORD:?…}` at all 3 uses; it defaulted to `sora` before.
   - Postgres is published on `${POSTGRES_BIND_ADDRESS:-127.0.0.1}`, where it was on all interfaces.
   - `.env.example` no longer carries a working password: `POSTGRES_PASSWORD=` is blank and `DATABASE_URL` uses a `<password>` placeholder.
   - With the real `.env`, the config renders, with `host_ip: 127.0.0.1`. With an empty env file it fails with `required variable POSTGRES_PASSWORD is missing a value`.
   - The API port stays on all interfaces, because a phone on the LAN must reach it.
   - The running `sora-postgres` keeps its binding until it is next recreated.
3. **Stale plan references: FIXED.**
   - The per-row border that `transaction-ui-plan.md` listed as "Open item 1" was already gone at `HEAD` (no `borderTopWidth` in the file).
   - The section is now "Done", pointing at `TransactionListSection.tsx:42`, the day-header divider that is kept, and describing the virtualized structure.

## Fixes Applied

As above. Re-verified with `npx tsc --noEmit` (exit 0), `npm run test` in `mobile/` (353/353) and `docker compose config` (both cases).

## Follow-ups

- **Device check:** go offline while signed in. The user's last-loaded data should stay on screen, with no "Guest Wallet" and no guest-upload screen.
- **Cold start:** a user who starts offline with nothing cached now sees empty and loading states rather than guest data. That is intended, but check it on a device.
