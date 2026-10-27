# Invitations inbox in Settings: list, accept and decline received invitations (WAL-US-14)

**Date:** 2026-10-23
**Method:** ad hoc
**Verdict:** PASS (server against a real Postgres, contracts, mobile tests); the UI was not driven on a device
**Scope:**
- New `GET /invitations`, `POST /invitations/{id}/accept`, `POST /invitations/{id}/decline`.
- `users.email_verified_at` is now set by a Google sign-in, and `UserResponse.emailVerified` is new.
- A new Settings → Invitations section.

**Files touched:**
- **Contracts:** `routes.ts`, `responses.ts`, `test/responses.test.ts`.
- **Server:**
  - `auth.service.ts`, `invitations.service.ts`, `invitations.controller.ts`, `audit-events.ts`, `app-error.ts`;
  - `test/integration.members.test.ts`, `test/integration.session.test.ts`.
- **Mobile:**
  - `services/api/invitations.ts`, `store/api/invitationsApi.ts`, `store/api/apiSlice.ts`, `utils/errors.ts`;
  - `features/settings/components/InvitationsSection.tsx` (new), `components/index.ts`, `screens/SettingsScreen.tsx`;
  - all 10 locales.
- **Docs:**
  - `docs/API_SPECIFICATION.md` (§3 index, §5 `/auth/me`, §8.6–8.8, §16.1), `docs/ERROR_CODES.md`, `docs/test-plans/wallets.md` (TC-WAL-41..47);
  - `SRS.md` (BR-11, WAL-US-14), `SDS.md`;
  - `CLAUDE.md` BR-08, `.agents/rules/business-rules-and-access.md`.

**Related reports:** 2026-10-23-ui-guidelines-audit.md

## Method

1. **Scratch database.** The `sora` role on :5433 has no CREATEDB, so a throwaway cluster was started (CLAUDE.md rule 10). It was stopped afterwards; its data directory stays in the session scratchpad.
   ```
   initdb -D <scratchpad>/pg-scratch-inbox -U postgres -A trust
   pg_ctl -o "-p 55433" start
   createdb sora_scratch_inbox
   DATABASE_URL=postgresql://postgres@127.0.0.1:55433/sora_scratch_inbox node scripts/migrate.mjs
   ```
2. `DATABASE_URL=… npm run test` in `server/`.
3. Repo-wide checks:
   - `node scripts/check-contract-parity.mjs`
   - `npm test -w @sora/contracts`
   - `npm run typecheck`
   - `npm run test -w @sora/mobile`
   - `node --test src/app/i18n/localeParity.test.ts src/app/i18n/plurals.test.ts`
   - the literal `t()` key scan against `en.ts`

## Findings

- **Server:** 308 tests, 308 pass. The new suite "invitations inbox (§8.6–§8.8, WAL-US-14)" has 6 tests:
  - an unverified account gets 403 `INVITATION_EMAIL_UNVERIFIED` on every inbox route, while the link still joins;
  - the list returns only the caller's open invitations, with no token;
  - accept-by-id joins once, and the link then answers 409;
  - another address's invitation or a random id answers 404 and stays untouched;
  - decline answers 204, after which the link answers 404, the decline is audited with no actor role, and the owner can re-invite;
  - an accepted invitation answers 409 to decline, and an expired one answers 410.
- **Google sign-in tests:** they assert `emailVerified` is true after Google and false for a password account until it links Google.
- **First run:** one failure, the exact-shape `/auth/me` assertion missing `emailVerified`. The expectation was updated and the re-run passed.
- **Contracts:** 184 pass. The new 403 code tripped the AC-01 tripwire test, as designed. It was reviewed and added: the code is raised before any invitation lookup, so it reveals nothing about a target.
- **Parity and checks:**
  - contract parity: 149/149;
  - typecheck: clean in every package;
  - mobile: 816 pass;
  - locale parity and plurals: 13 pass (`_one`/`_few`/`_many` forms added per language);
  - key scan: all literal keys exist.

## Fixes Applied

None beyond the feature. The single test failure was an expected contract-shape change.

## Follow-ups

- **Never verified in this build:** password accounts are never verified, so they see "Open the invitation link to join". Every seeded demo user is a password account, so trying the inbox locally needs a Google sign-in, or `email_verified_at` set on a test account by its exact id.
- **Pre-existing risk:** linking Google to an existing password account (`/auth/google`, same email) now also verifies that account. If someone else registered the address first, they keep the password. This risk already existed with account linking (they get the victim's future data), and the inbox does not widen it.
- **Not reachable from the inbox screen:** `AcceptInvitationScreen` (the link flow) is still not reachable from the app (2026-10-23 UI audit).
- **Not checked on a device:** the Settings section.
