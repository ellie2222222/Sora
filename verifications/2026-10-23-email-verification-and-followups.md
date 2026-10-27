# Email verification by code, translated form errors, invitation letter, and on-device checks

**Date:** 2026-10-23T11:40:00Z
**Method:** ad hoc
**Verdict:** PASS. Server, contracts and mobile tests pass. Exercised end to end over HTTP and by hand on the Android emulator in Expo Go. Not run on a development build or on iOS.
**Scope:** The follow-ups in 2026-10-23-double-check-session.md ("proceed all"):
- the four flagged comments;
- the forms still showing English;
- email verification for password accounts;
- device checks;
- the orphan seed users.

Also the user's mid-turn request to redesign the invitation screen as a letter.

**Files touched:**
- **Contracts:** `packages/contracts/src/{routes,schemas,responses}.ts`, `test/responses.test.ts`.
- **Database:** `db/migrations/007_email_verifications.sql`, `db/tests/005_email_verifications.sql`.
- **Server:**
  - `server/src/mail/{mail.module,mail.service,verification-email}.ts`;
  - `server/src/auth/{email-verification.service,auth.controller,auth.module}.ts`;
  - `server/src/{config/env,common/app-error,audit/audit-events,database/types,wallets/invitations.service}.ts`;
  - tests: `integration.email-verification`, `mail.service`, `integration.wallets`, `exchange-rate.service` (config fixture).
- **Mobile:**
  - `utils/{errors,errors.test,fieldErrors,fieldErrors.test}.ts`;
  - 11 forms;
  - `app/providers/AuthProvider.tsx`, `services/api/auth.ts`, `app/navigation/RootNavigator.tsx`;
  - `features/auth/screens/AcceptInvitationScreen.tsx`;
  - `features/settings/components/{InvitationsSection,VerifyEmailSheet}.tsx`;
  - `design-system/sizes.ts`;
  - 4 comment-only files;
  - all 10 locales.
- **Docs:**
  - `docs/API_SPECIFICATION.md` (§2.6, §2.9, §3 index rows 9–10 renumbered, §5.8, §5.9, §8.4, §8.6, §16.1);
  - `SRS.md` (AUTH-US-05, WAL-US-14, BR-11, totals);
  - `SDS.md`;
  - `docs/ERROR_CODES.md`;
  - `docs/test-plans/{auth,wallets,README}.md`;
  - `plans/architecture/domain-database-design.md`.
- **Config and conventions:**
  - `RUNBOOK.md`, `CLAUDE.md`, `AGENTS.md`, `.agents/rules/{business-rules-and-access,technical-standards}.md`;
  - `.env.example`, `.gitignore`, `docker-compose.yml`, `server/package.json`, `package-lock.json`.

**Related reports:** 2026-10-23-double-check-session.md (its follow-ups are closed here or carried below)

## Method

- **Throwaway cluster:** `initdb -D <scratchpad>/pg-scratch-verify -U scratch -A trust`, started on port 55434.
- **Databases:**
  - `scratch_verify` uses the `C` locale.
  - `scratch_verify_locale` uses `en-US`.
  - On both, `node scripts/migrate.mjs` was run twice; the second run reported "Up to date (7 migration(s) applied)".
- **Probes:** `psql … -f db/tests/*.sql`.
- **Test suites:**
  - `DATABASE_URL=…/scratch_verify_locale npm run test -w @sora/server`
  - `npm run typecheck`
  - `npm run test -w @sora/mobile`
  - `npm run test -w @sora/contracts`
- **Static checks:**
  - `node scripts/check-contract-parity.mjs`
  - the locale tests
  - `check-keys.mts`
  - `npx tsc -p scripts/seed/tsconfig.json --noEmit`
  - `npm run agents:check`
  - `node scripts/audit-runtime-deps.mjs`
- **Probe API:** `node dist/src/main.js` on :3100 against `scratch_verify_locale`, with `NODE_ENV=development` and no `SMTP_URL`, so mail goes to the outbox.
  - Driven with `probe-verify.mjs` and `probe-device-data.mjs` from the scratchpad.
  - Every user created was `probe+…@example.invalid`.
- **Emulator:** `Medium_Phone` in Expo Go 57.
  - Metro started with `EXPO_PUBLIC_API_BASE_URL=http://localhost:3100` and `adb reverse` for ports 8081 and 3100; `mobile/.env` was not changed.
  - Driven with `adb shell input` and `screencap`.

## Findings

1. **Migration 007 and its probe:** 5/5 PASS. That covers one code per user (`email_verifications_pkey`), a sixth guess, expiry at send time, and a plain code instead of a digest. The other four probe files also pass (86, 11, 6, 11).
2. **Server suite:** 319/319 on `scratch_verify_locale`, including the 8 new email-verification tests and 3 mail tests.
   - On the `C`-locale database, one categories test failed: `lower()` does not fold `Ă`. The same file passes 16/16 on `en-US`, so the failure comes from the cluster's locale, not the code.
3. **HTTP probe, Vietnamese account:**
   - registration answers `emailVerified false`;
   - send 200; an immediate resend 429 with `Retry-After 60`;
   - the outbox message is in Vietnamese with a 6-digit code;
   - inbox 403 `INVITATION_EMAIL_UNVERIFIED`;
   - confirm 200 `emailVerified true`;
   - inbox 200;
   - the `EMAIL_VERIFIED` audit row has result SUCCESS;
   - the code appears 0 times in the API log (LA-01).
4. **Emulator, invite link signed out:** the invitation preview shows; Sign in reopens the invitation after login (the handoff).
5. **Bug found on the emulator: a cold-opened link left no way back.** Signed in, the link made AcceptInvitation the only route in the stack, so Android back closed the app and the screen had no back arrow.
   - First fix, in the screen: reset the stack on mount. It was not effective; see item 9.
   - Final fix: `linkingFor(home)` in `RootNavigator.tsx` sets `initialRouteName` to Main or Login.
   - Re-checked on a fresh bundle: a cold open signed in shows the back arrow, and "Not now" lands on Home.
6. **Invitation letter (user request):**
   - envelope icon in a tinted circle (`sizes.emblem`);
   - "From {inviter}", "Join {wallet}", and a sentence on what joining shows;
   - detail rows for access with its description, sent to (masked), and valid until;
   - Accept, plus a new "Not now".
   - The inviter's name needed `inviterName` on `InvitationPreviewResponse`. It was added to §8.4 and the server query, with an assertion in `integration.wallets:150`.
   - Checked on the emulator.
7. **Dashboard Spending:** the top three slices plus Others with plain leader lines, at the new type size. Checked on the emulator.
8. **Settings → Invitations → Confirm email, on the emulator:**
   - send, then the countdown "Send a new code in 42 s";
   - a malformed value shows "Enter the 6-digit code from the email." (the contracts' `i18nKey` path);
   - a wrong code shows "That code isn't right…" under the field;
   - the right code toasts "Email confirmed", and the inbox loads "1 waiting for you";
   - Accept toasts "Joined Probe sister's wallet" and the list is empty.
9. **Bug found on the emulator: the code field showed "929,343".** `Input` formats any `number-pad` field as money. The field now keeps digits only, the same way the card-digits field does.
   - Metro's watcher twice stopped seeing edits. Bundle greps (`setCode(next)` and the probe log still present) showed the device was running stale code, so Metro was restarted before each re-check.
10. **Translated form errors:**
    - All 11 forms pass `t` to `issueMessagesByPath`.
    - Every custom refinement in `schemas.ts` names `params.i18nKey`.
    - A test fails if a named key is missing from `en.ts` (`fieldErrors.test.ts:125`).
11. **Comment follow-ups:** the four cycle comments now point at CLAUDE.md MB-10 instead of each other or a rule number. `AcceptInvitationScreen`'s doc names `invitationLink` instead of repeating the URL.
12. **Orphan seed users (61b401e4) on sora_dev:**
    - Read-only checks: 4 users, 6 wallets, 4 accounts, 152 categories, 16 audit rows, 5 invitations. There are no transactions, no goals, and no other user is involved.
    - The guarded delete was denied by the session's permission check and was not retried.
    - The script is at `<scratchpad>/delete-orphans-61b401e4.sql`.
13. **Dependency audit:**
    - The two accepted advisories pass.
    - It reports two `follow-redirects` 1.16.0 advisories (fixed in 1.16.1) through the mobile app's `axios`. They predate this work: the lockfile diff does not touch `follow-redirects`.
    - `nodemailer@10.0.16`, published 2026-10-07, has no dependencies.

## Fixes Applied

See items 5, 6, 9, 10 and 11. Each was re-checked by repeating the step that found it: the emulator flow, or the test or grep named.

## Follow-ups

- **Orphan users:** deleting the 4 users needs your approval. Run the script above, or allow the command.
- **Keyboard over sheets in Expo Go:** the keyboard covers the bottom of a sheet. `BottomSheetModal` sets no `KeyboardAvoidingView` behaviour on Android and relies on `adjustResize`, which the development build's manifest sets; Expo Go may differ. Check on a development build before changing the shared sheet.
- **`follow-redirects`:** upgrade to 1.16.1 once it is two weeks old, or accept the advisories, in a dependency pass.
- **Not checked:**
  - a real SMTP provider (`SMTP_URL`), since none is configured;
  - a development build or iOS;
  - Decline from the inbox on a device.
- **Rate limit on guesses:** a code allows 5 guesses and can be resent once a minute, and both routes share the 10-per-minute per-IP limit. A per-account daily cap is not built; add one if abuse shows up.
