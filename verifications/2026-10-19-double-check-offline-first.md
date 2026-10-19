# Double-check of the offline-first / unreachable-API working tree

**Date:** 2026-10-19T05:23:18Z
**Method:** double-check skill
**Verdict:** PASS — after fixing four defects the sweep found (two regressions this work introduced)
**Scope:** The whole uncommitted working tree (53 changed + 12 new files): the offline-first change and its follow-ups. Chosen because the change added abstractions (`sendOrQueue`, `reachabilityProbe`, flag listeners) and replaced `enqueueOffline`.
**Files touched:** `mobile/src/hooks/useNetworkStatus.tsx`, `mobile/src/hooks/useConnectivityToasts.ts`, `mobile/src/services/sync/{reachabilityProbe,reachabilityProbe.test,sendOrQueue,sendOrQueue.test,offlineEnqueue}.ts`, `mobile/src/services/api/{index,retryKeys}.ts`, `mobile/src/services/auth/refreshRejection.ts`, `mobile/src/utils/errors.ts`, `mobile/src/app/i18n/locales/{de,zh}.ts`, `docs/test-plans/{offline-sync,auth}.md`, `SDS.md` §4.4
**Related reports:** follows `2026-10-19-offline-first-server-unreachable.md` (its follow-ups were closed there; none carried open)

## Method

- Re-read `CLAUDE.md` (unchanged since session start: `git diff HEAD -- CLAUDE.md AGENTS.md aif-sdlc-checklist.md` empty) and `aif-sdlc-checklist.md`.
- Phase 1: a read-only agent swept the diff for dead code, duplication, races, rule violations, cross-layer drift and doc drift; each finding below was re-checked against the code before acting.
- Phase 2: `npm run typecheck`; `npm test -w @sora/mobile`; `npm test -w @sora/server` with `DATABASE_URL` on a throwaway cluster (`initdb`, `127.0.0.1:55471/scratch_itest`, migrated) so integration tests run; `node scripts/check-contract-parity.mjs`; dangling-reference grep; `DESIGN_GUIDELINES.md` Part 4 recovery-action check; Maestro on AVD `Medium_Phone` via `mobile/e2e/outage-switch.mts`.

## Findings

1. **NetInfo raised the reachability flag** (`useNetworkStatus.tsx:60`, `setCurrentlyOnline(online)`) — confirmed. During a server outage any NetInfo event would show "Connected to Sora again", refetch every screen, then fail and toast again. **Regression from this work.** Fixed.
2. **Refetch-everything loop**: the probe reset its backoff on every flag change, so one endpoint timing out while `/health` answered would refetch all reads every ~5 s — confirmed by reading `reachabilityProbe.ts`. Fixed for reads. The sync-queue variant (a proxy/WAF answering one queued write with a non-envelope 4xx keeps it pending, blocking the rows behind it) is slowed to the 60 s cap but not resolved — Follow-up.
3. **Double-tapped Save could record twice**: `sendOrQueue` pinned a fresh key per call, bypassing `RetryKeys`' shared key for identical in-flight writes — confirmed (`client.ts` skips `RetryKeys` when a key is pinned). **Regression from this work.** Fixed.
4. **Header and probe pinged `/health` separately and could disagree**; every flag change also flashed "checking" — confirmed. Fixed with 1.
5. **Outage toast missed when the outage began during session restore** — confirmed by reading `useConnectivityToasts.ts`. Fixed.
6. `YearlyTrend`'s note says "once Sora can be reached" even for a month that failed with a refusal — minor, left (Follow-up).
7. Duplication: `refreshRejection.ts` re-implemented the envelope check — fixed by exporting `isErrorBody`.
8. Stale comment `retryKeys.ts:10` ("24-hour retention") — fixed.
9. MB-09 register: new de toasts used *du*, zh used 你 — the catalogs use *Sie*/您 — fixed. A pre-existing 你 at `zh.ts:75` is outside this diff (Follow-up).
10. Doc drift: `docs/test-plans/offline-sync.md` lacked the new cases → TC-SYNC-29…34 added, -14/-27/-31/-32 refreshed; `auth.md` TC-AUTH-26 anchors pointed at shifted lines → fixed; SDS §4.4 described NetInfo raising the flag → fixed.

Checked, still correct:

- No references to removed `enqueueOffline`, `isSelfResolvingError`, `CONNECTIVITY_WORDS` in code, docs, plans, skills, `.agents`, AGENTS.md.
- `all-exceptions.filter.ts` is `@Catch()`-all: every API error, including unmatched-route 404 and 429, carries the envelope; live: `/api/v1/nope` → `ROUTE_NOT_FOUND`, bad refresh → `TOKEN_INVALID`.
- `onQueryStarted`/`invalidatesTags` key off `isStillQueued`, so an online write that ends up queued is patched like an offline one.
- Idempotency fingerprints match between a send and its queued replay (contribution adapter strips `goalId`; cancel forwards `reason`).
- Every `StateView` caller that can render the unreachable view passes a retry (Part 4 "recoverable error has a recovery action"); `CategoryListScreen:52` is the no-wallet state.
- MB-10: providers never import `@/hooks`; `RetryKeys` now imported through the `@/services/api` barrel.

## Fixes Applied

- `useNetworkStatus.tsx`: NetInfo only lowers the flag; `checkServer`'s `/health` answer sets it both ways; header status follows flag changes without a second ping.
- `reachabilityProbe.ts`: `STABLE_MS` (2 min) — a fall within it of a rise keeps the backoff growing. Test: `reachabilityProbe.test.ts:82`.
- `sendOrQueue.ts`: key from `RetryKeys` by write fingerprint (local id excluded), released once answered or queued. Tests: `sendOrQueue.test.ts:67`, `:78`.
- `useConnectivityToasts.ts`: evaluates once signed in if the flag is already down.

Re-verified after the fixes:

| Command | Result |
| --- | --- |
| `npm run typecheck` | exit 0 |
| `npm test -w @sora/mobile` | 774/774 pass |
| `npm test -w @sora/server` (integration on `scratch_itest`) | 301/301 pass, 0 skipped |
| `node scripts/check-contract-parity.mjs` | exit 0 |
| `maestro test mobile/e2e` (rebuilt APK, AVD `Medium_Phone`) | 9/9 Flows Passed in 16m 29s, incl. `offline-sync` (reconnect now via `/health`) and `server-outage` |

## Follow-ups

- A queued write that a proxy or WAF answers with a non-envelope 4xx stays pending, with the queue behind it waiting; it now retries at most once a minute but is never parked for the user. Needs the transport status kept on the error to tell it from an offline tunnel.
- `YearlyTrend` caption wording for months refused with a 4xx.
- `zh.ts:75` (`ai` offline message) uses 你; pre-existing.
- CI e2e job change unproven until the workflow runs.
