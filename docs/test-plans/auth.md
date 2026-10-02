# Test plan: Authentication & session

**Stories:** SRS §9 AUTH-US-01 Register · AUTH-US-02 Sign in · AUTH-US-03 Stay signed in · AUTH-US-04 Sign out
**Contract:** API spec §5 (`/auth/*`), §2.4 Authentication, §2.9 Rate limiting
**Rules:** CLAUDE.md Part 6 Security Requirements (Argon2id, 12–200 length-only policy, single-use rotating refresh tokens, identical `401 CREDENTIALS_INVALID`, rate limits + per-email lockout); LA-01 (no secrets logged), LA-03/AC-05 (401/403 at WARN)
**Code under test:** `server/src/auth/`, `packages/contracts/src/schemas.ts` (`registerSchema`, `loginSchema`), `mobile/src/services/auth/`, `mobile/src/services/api/client.ts`, `mobile/src/features/auth/`

## Objectives

1. Nobody can find out whether an address is registered: login answers the same either way.
2. A stolen refresh token is caught on replay, and that replay ends every session of the user.
3. Registration leaves a usable wallet: an OWNER membership and starter categories, created together.
4. The app stays signed in across relaunches and token expiry, and never restores a session it was told to end.

## Scope

In: register, login, refresh, logout, `GET /auth/me`, the bearer guard on every protected route, the mobile session manager and its 401 handling.
Out: Google OAuth against a real Google client (needs real credentials; stub `verifyIdToken` instead).

## Test data & environment

- Server: `registerProbeUser(api, tag)` ([probe-data.ts](../../server/test/support/probe-data.ts)) creates a unique probe user and returns its tokens and personal wallet id.
- `startTestApi()` raises `AUTH_RATE_LIMIT_PER_MINUTE` to 100000, so the HTTP per-IP test stubs `RateLimitService.hit` back to the spec's 10/min on a fresh key.
- Mobile: `SessionManager` with in-memory storage and a stubbed refresh call ([session.test.ts](../../mobile/src/services/auth/session.test.ts)).
- E2E: the seeded user from `mobile/e2e/seed.mts`.

## Test cases

| ID | Story | Scenario | Type | Expected result | Automated by | Status |
|---|---|---|---|---|---|---|
| TC-AUTH-01 | AUTH-US-01 | Register a new address | Integration | 201; `wallet_members` row OWNER/ACTIVE; every `STARTER_CATEGORIES` name present; one `USER_REGISTERED` audit row | [integration.auth:20](../../server/test/integration.auth.test.ts#L20) | Covered |
| TC-AUTH-02 | AUTH-US-01 | Register an address already taken, in a different case | Integration + DB probe | 409 `EMAIL_ALREADY_REGISTERED`; DB rejects the case-variant duplicate | [integration.auth:38](../../server/test/integration.auth.test.ts#L38), [001_constraints:73](../../db/tests/001_constraints.sql#L73) | Covered |
| TC-AUTH-03 | AUTH-US-01 | Email normalised, base currency defaults to VND, password under 12 chars refused | Unit + Integration | Schema output lower-cased + `VND`; short password rejected, over HTTP as a 422 naming `password` | [schemas:217](../../packages/contracts/test/schemas.test.ts#L217), [schemas:229](../../packages/contracts/test/schemas.test.ts#L229), [integration.session:37](../../server/test/integration.session.test.ts#L37) | Covered |
| TC-AUTH-04 | AUTH-US-01 | Password of 201 characters | Unit | Rejected | [auth-schemas:9](../../packages/contracts/test/auth-schemas.test.ts#L9), [auth-schemas:14](../../packages/contracts/test/auth-schemas.test.ts#L14) | Covered |
| TC-AUTH-05 | AUTH-US-01 | Starter categories are valid and unique | Unit | No two names equal ignoring case; types allowed; at least one INCOME and one EXPENSE | [starter-categories:11](../../packages/contracts/test/starter-categories.test.ts#L11), [:22](../../packages/contracts/test/starter-categories.test.ts#L22), [:31](../../packages/contracts/test/starter-categories.test.ts#L31), [:38](../../packages/contracts/test/starter-categories.test.ts#L38) | Covered |
| TC-AUTH-06 | AUTH-US-01 | A failure partway through registration | Integration | No user, wallet, membership or categories left behind | [integration.session:54](../../server/test/integration.session.test.ts#L54) | Covered |
| TC-AUTH-07 | AUTH-US-02 | Wrong password vs unknown address | Integration | Both 401 `CREDENTIALS_INVALID` with an identical message | [integration.auth:47](../../server/test/integration.auth.test.ts#L47) | Covered |
| TC-AUTH-08 | AUTH-US-02 | Login email typed with spaces or capitals | Unit | Trimmed and lower-cased, so the lockout counts one address | [schemas:419](../../packages/contracts/test/schemas.test.ts#L419) | Covered |
| TC-AUTH-09 | AUTH-US-02 | 5 failures, then the right password | Integration + Unit | 429 `RATE_LIMITED` with `Retry-After` > 0; lockout lapses and stale streaks are forgotten | [integration.auth:62](../../server/test/integration.auth.test.ts#L62), [rate-limit:12](../../server/test/rate-limit.service.test.ts#L12), [:21](../../server/test/rate-limit.service.test.ts#L21), [:32](../../server/test/rate-limit.service.test.ts#L32) | Covered |
| TC-AUTH-10 | AUTH-US-02 | Per-IP limit on `/auth/login`, `/auth/register`, `/auth/refresh` | Unit + Integration | 429 once the per-minute limit is exceeded | [rate-limit:12](../../server/test/rate-limit.service.test.ts#L12), [integration.session:86](../../server/test/integration.session.test.ts#L86), default of 10: [env:13](../../server/test/env.test.ts#L13) | Covered — the HTTP test drives the limit at 10 by stubbing `RateLimitService.hit`, and the unit test proves 10 is the configured default |
| TC-AUTH-11 | AUTH-US-02 | Successful and denied sign-in | Integration | An audit row for each, the denial with `result = DENIED` | [integration.session:112](../../server/test/integration.session.test.ts#L112) | Covered |
| TC-AUTH-12 | AUTH-US-03 | Refresh, then replay the old token | Integration | First 200 with a new token; replay 401; the newer token now 401 too; two `TOKEN_REPLAY_DETECTED` rows, DENIED | [integration.auth:74](../../server/test/integration.auth.test.ts#L74) | Covered |
| TC-AUTH-13 | AUTH-US-03 | Ten concurrent refreshes of one token | Integration | Exactly one 200, nine 401 | [integration.auth:91](../../server/test/integration.auth.test.ts#L91) | Covered |
| TC-AUTH-14 | AUTH-US-03 | Expired or unknown refresh token | Integration | 401 `TOKEN_EXPIRED` / `TOKEN_INVALID`; the user's other sessions still refresh | [integration.session:126](../../server/test/integration.session.test.ts#L126) | Covered |
| TC-AUTH-15 | AUTH-US-04 | Log out one of two sessions | Integration | 204; the other session still refreshes; the logged-out token is refused | [integration.auth:100](../../server/test/integration.auth.test.ts#L100) | Covered |
| TC-AUTH-16 | AUTH-US-04 | Log out twice with the same token | Integration | Both succeed | [integration.session:151](../../server/test/integration.session.test.ts#L151) | Covered |
| TC-AUTH-17 | AUTH-US-04 | Logout is audited | Integration | One logout audit row | [integration.session:159](../../server/test/integration.session.test.ts#L159) | Covered |
| TC-AUTH-18 | API §2.4 | Every mounted route without a bearer | Integration | 401 for every route except the six public ones (health, register, login, Google, refresh, invitation preview); the list is read off the running router, so a new unguarded controller fails it | [integration.auth:112](../../server/test/integration.auth.test.ts#L112) | Covered |
| TC-AUTH-19 | API §5.6 | Google sign-in with a stubbed `verifyIdToken` (new user, existing user, bad token) | Integration | Session issued / linked / 401 | [integration.session:195](../../server/test/integration.session.test.ts#L195), [integration.session:239](../../server/test/integration.session.test.ts#L239), [integration.session:254](../../server/test/integration.session.test.ts#L254) | Covered |
| TC-AUTH-20 | API §5.5, §5.7 | `GET /auth/me`, `PATCH /auth/me/preferences` (theme, locale; base currency is not a §5.7 field and is refused) | Integration | 200 with the caller's profile; values outside the CHECK sets refused | [integration.session:262](../../server/test/integration.session.test.ts#L262) | Covered |
| TC-AUTH-21 | AUTH-US-03 | Many concurrent 401s on the device | Mobile unit | One refresh request; every caller gets the same session; the latch is released after success and after failure | [session:116](../../mobile/src/services/auth/session.test.ts#L116), [:147](../../mobile/src/services/auth/session.test.ts#L147), [:163](../../mobile/src/services/auth/session.test.ts#L163), [:180](../../mobile/src/services/auth/session.test.ts#L180) | Covered |
| TC-AUTH-22 | AUTH-US-03 | Refresh refused by the server vs. failed for another reason | Mobile unit | Refused → session cleared; network/429/5xx → session kept | [session:200](../../mobile/src/services/auth/session.test.ts#L200), [:217](../../mobile/src/services/auth/session.test.ts#L217), [refreshRejection:15](../../mobile/src/services/auth/refreshRejection.test.ts#L15), [:20](../../mobile/src/services/auth/refreshRejection.test.ts#L20) | Covered |
| TC-AUTH-23 | AUTH-US-04 | A refresh still in flight when the user logs out or another user signs in | Mobile unit | The old session is not restored; the next user's session is not overwritten or signed out | [session:323](../../mobile/src/services/auth/session.test.ts#L323), [:338](../../mobile/src/services/auth/session.test.ts#L338), [:352](../../mobile/src/services/auth/session.test.ts#L352) | Covered |
| TC-AUTH-24 | AUTH-US-03 | Relaunch with a saved session | Mobile unit + E2E | Saved session restored (an expired one as "not fresh"); after kill and relaunch the home screen shows without signing in | [session:249](../../mobile/src/services/auth/session.test.ts#L249), [:266](../../mobile/src/services/auth/session.test.ts#L266), [session-restore.yaml](../../mobile/e2e/flows/session-restore.yaml) | Covered |
| TC-AUTH-25 | AUTH-US-03 | A request gets a 401, then the refresh succeeds, fails offline, or is refused | Mobile unit | Replayed once with the new bearer, never twice; login/refresh 401s not retried; an offline refresh failure surfaces as no connection; a refused one as the 401 that signs out | [refreshRetry:41](../../mobile/src/services/api/refreshRetry.test.ts#L41), [:47](../../mobile/src/services/api/refreshRetry.test.ts#L47), [:53](../../mobile/src/services/api/refreshRetry.test.ts#L53), [:61](../../mobile/src/services/api/refreshRetry.test.ts#L61), [:66](../../mobile/src/services/api/refreshRetry.test.ts#L66) | Covered |
| TC-AUTH-26 | AUTH-US-04 | Which error codes end a session in the app | Mobile unit | Only the session-ending codes; never a wrong password or a 403 | [errors:147](../../mobile/src/utils/errors.test.ts#L147), [:153](../../mobile/src/utils/errors.test.ts#L153) | Covered |
| TC-AUTH-27 | Security | Release build pointed at an `http://` API | Mobile unit | Refused unless in development or explicitly opted in | [apiUrlPolicy:7](../../mobile/src/app/config/apiUrlPolicy.test.ts#L7), [:11](../../mobile/src/app/config/apiUrlPolicy.test.ts#L11), [:15](../../mobile/src/app/config/apiUrlPolicy.test.ts#L15) | Covered |
| TC-AUTH-28 | AUTH-US-02 | Sign in through the login screen on a fresh install | E2E | Home screen shown | [subflows/login.yaml](../../mobile/e2e/subflows/login.yaml) (run by every flow) | Covered |

## Gaps, by risk

None open.

## Running

```bash
npm run test -w @sora/contracts
DATABASE_URL=postgresql://…/scratch_auth npm run test -w @sora/server   # integration.auth and integration.session need it
npm run test -w @sora/mobile
```
