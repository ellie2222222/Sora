# Follow-ups from the 2026-10-27 double-check: daily code cap and atomic resend, dependency pass, on-device checks

**Date:** 2026-10-27T03:58:10Z
**Method:** ad hoc
**Verdict:** PASS for everything that ran. Static checks, all four test suites, the DB probes and migration 008 pass. The device flows on the Android emulator in Expo Go pass after three bugs found on the device were fixed.

BLOCKED:
- Deleting the orphan users: denied by the session's permission check.
- The keyboard check on a development build: installing it would first wipe leftover app data on the emulator.

**Scope:** Every follow-up in 2026-10-27-double-check-email-verification-pass.md, on the user's "proceed, approve all, do all fix all".
**Files touched:**
- **Database:**
  - `db/migrations/008_email_verification_send_window.sql` (new)
  - `db/tests/005_email_verifications.sql`
- **Server:**
  - `server/src/auth/email-verification.service.ts`
  - `server/src/database/types.ts`
  - `server/test/integration.email-verification.test.ts`
- **Mobile:**
  - `mobile/src/features/settings/components/VerifyEmailSheet.tsx`
  - `mobile/src/app/store/api/apiSlice.ts`
  - `mobile/src/features/auth/screens/{LoginScreen,RegisterScreen}.tsx`
  - the 10 locale catalogs (`settings.verifyEmail.resendAt`)
- **Dependencies:**
  - `package-lock.json` (`follow-redirects` 1.16.0 → 1.16.1)
  - `scripts/audit-runtime-deps.mjs`
- **Docs:**
  - `docs/API_SPECIFICATION.md` (§2 rate limits, §5.8)
  - `SRS.md` (AUTH-US-05)
  - `plans/architecture/domain-database-design.md`
  - `docs/test-plans/{auth,wallets}.md`
- **Local, gitignored:** `.env.seed`, rebuilt for run 016a89d4 (see Findings).

**Related reports:** 2026-10-27-double-check-email-verification-pass.md, whose follow-ups this pass closes. It also follows 2026-10-23-email-verification-and-followups.md.

## Method

- **Throwaway cluster:**
  - Reused `<scratchpad>/pg-scratch-dc` on port 55436, database `scratch_dc`, and stopped it afterwards.
  - Before applying 008, inserted one `email_verifications` row (`probe+mig008@example.invalid`), so the backfill had existing data to run on.
  - Applied with `node scripts/migrate.mjs` twice, then deleted the probe row by its id.
  - Ran `psql -f db/tests/*.sql` with `PGCLIENTENCODING=UTF8`.
- **Test suites:**
  - `DATABASE_URL=…/scratch_dc npm run test -w @sora/server`
  - `npm run test -w @sora/mobile`
  - `npm run test -w @sora/contracts`
- **Static checks:**
  - `npm run typecheck`
  - `node scripts/check-contract-parity.mjs`
  - `npm run agents:check`
  - `node scripts/audit-runtime-deps.mjs`
- **Dependencies:** `npm update follow-redirects --before=2026-10-13`, which takes the newest release that is at least two weeks old.
- **Probe API:**
  - `node --env-file-if-exists=../.env dist/src/main.js` on :3100 against `scratch_dc`.
  - Settings: `NODE_ENV=development`; mail goes to a scratchpad outbox because no `SMTP_URL` is set; `EXCHANGE_RATE_API_URL=http://127.0.0.1:9/`, so no external calls are made.
- **Seed:**
  - `SEED_API_URL=http://127.0.0.1:3100 node scripts/seed/seed-demo.mts` (run `95bc47be`, 3147 requests).
  - Invitations to An were created through `POST /wallets/{id}/invitations`.
- **Emulator:** `Medium_Phone`, Expo Go.
  - Metro ran as `npx expo start --go --localhost` with `EXPO_PUBLIC_API_BASE_URL=http://localhost:3100`.
  - `adb reverse` was set for 8081 and 3100.
  - The app was driven with Maestro flows by `testID`, `adb shell input`, and `screencap`.

## Findings

1. **Resend race and daily cap:**
   - `send()` is now one `INSERT … ON CONFLICT DO UPDATE … WHERE`. The update happens only when the minute's wait has passed and either the day's window is over or it holds fewer than 5 sends, then it returns the row.
   - Concurrent sends queue on the row lock and see each other's send.
   - Refusals answer `429 RATE_LIMITED` with `Retry-After`.
   - The `resendAfter` returned by the day's fifth send is the end of that day's window.
   - Integration tests:
     - "mails one code when several sends arrive at once": 1×200, 3×429, 1 mail.
     - "sends at most five codes in a day": the fifth `resendAfter` is more than 1 h away, the sixth send gets 429 with `Retry-After` over 3600, and a day later the window restarts at 1.
   - Server suite: 322/322.
   - The new parallel test was not run against the old read-then-write code, so it is not proven to fail without the fix.
   - → PASS
2. **Migration 008:**
   - The existing row was backfilled with `window_started_at = sent_at` and 1 send. The second run was a no-op.
   - Probe 005 now runs 8 checks: it accepts a fifth send, rejects a sixth (`chk_email_verification_sends`), and rejects a window that opens after its send (`chk_email_verification_window`). Probes 001–004 also pass.
   - → PASS
3. **`JWT_SECRET` rotation note:** already in `RUNBOOK.md:322-326` ("voids any emailed verification code still open"). Nothing to do.
4. **`follow-redirects`:**
   - Moved to 1.16.1 (published 2026-10-01). The only other lockfile change aligns `nodemailer`'s spec with `server/package.json`.
   - The audit then reported three new high advisories that were absent on 10-23, plus one stale accepted entry:
     - **body-parser** GHSA-27r3-jxmh-p828: the fix, 2.4.0, was published 2026-10-22.
     - **multer** GHSA-q7qp-rjg7-q26m: the fix, 2.5.0, was published 2026-10-22, and no route accepts uploads.
     - **zod** GHSA-mrhx-c7xc-m3w5: fixed only in zod 4; no contract schema validates an array or set, and bodies stop at express's 100 kB default.
     - **braces** GHSA-vfj7-8cjw-p6xm: no longer reported.
   - The first three were accepted with review dates: 2026-11-05, when both fixes are two weeks old, and 2026-11-26 for zod. Braces was removed.
   - The audit passes with 4 accepted.
   - → PASS
5. **Orphan users `61b401e4` on sora_dev:**
   - Read-only checks confirmed the target is `sora_dev` on the host Windows Postgres service, port 5433.
   - The rows match the 2026-10-23 counts: 4 users, 6 wallets, 4 accounts, 152 categories, 5 invitations, 16 audit rows, 5 refresh tokens, 11 idempotency keys.
   - No other user's rows are involved: 0 shared memberships, 0 transactions, 0 audit rows by other actors.
   - The guarded script `<scratchpad>/delete-orphans-61b401e4.sql` runs in one transaction. It aborts unless the database name and every count match and 10 users remain afterwards. The session's permission check denied running it.
   - → BLOCKED
6. **`.env.seed` overwritten:**
   - The scratch seed run replaced the file. It had held run `016a89d4` (sora_dev) with generated passwords, and no backup was made first.
   - Rebuilt it from `.seed/016a89d4.json` (emails, run id, seed, anchor, wallets). The 4 emails were confirmed present on sora_dev.
   - The generated passwords are lost; `npm run db:seed:passwords` against sora_dev resets them to `SEED_PASSWORD`.
   - The scratch run's `.seed/95bc47be.json` was moved to the scratchpad.
7. **Device: verify-email sheet:**
   - Send, then Back, then reopen with a live code: the sheet goes straight to code entry with the countdown.
   - **Bug:** the countdown stopped at "1 giây" and the resend button stayed disabled for more than 20 s after the deadline. A fresh render showed it enabled.
   - After the fix, it counted down to 0 and re-enabled itself (the screenshot at 10:33:37 shows "Gửi mã mới").
   - On the day's fifth send, the button read "Gửi mã mới lúc 10:24" (disabled), which matches the window end `2026-10-28 10:24` in the row.
   - Entering the code from the outbox verified the email; `EMAIL_VERIFIED` was audited.
   - → PASS after the fix
8. **Device: inbox (TC-WAL-49):**
   - The inbox listed the invitations from Bao and Khoa.
   - Decline asked for confirmation, toasted and removed the row; `INVITATION_DECLINED` was audited. Declining both reached the empty state.
   - **Bug:** each decline raised a red LogBox error: "queryFn returned an object containing neither a valid error and result".
     - Every `void` mutation hit this, because `toQueryFnResult` returned `{ data: undefined }`. RTK checks for that only in development, and the mutation still fulfilled.
     - After the fix, the second decline showed no LogBox and added 0 `ERROR` lines to Metro's log.
   - → PASS after the fix
9. **Device: donut:**
   - The Others arc ("Khác 27%") draws with its callout.
   - The "Rent" callout beside the "Nhà ở" legend row is by design. The `CategoryBreakdown` doc says the donut draws flat slices and the legend rolls up by parent.
   - → PASS
10. **Device: larger type in de and ru:**
    - Home, the overview Accounts segment (`AccountCard` deck), segments and the tab bar all fit. "Einstellungen" and "Настройки" fit on full-resolution crops.
    - **Bug:** on the Russian login screen, the "Просто хотите посмотреть? Продолжить как гость" row ran past the side gutter. It was a non-wrapping `flex-row`.
    - After the fix (`flex-wrap` on the three prompt-and-link rows in Login/Register), the link wraps to its own line inside the gutter.
    - → PASS after the fix
11. **Device: invitation deep link (`exp://…/--/invite?token=`):**
    - **Signed in:** the letter is shown with a masked email; Accept toasts and creates `VIEWER`/`ACTIVE` membership.
    - **Signed out:** the letter offers Sign in and Create account. After signing in, the app returns to the same invitation.
    - **Guest:** the letter offers only Sign in, which leaves guest mode.
    - → PASS
12. **Keyboard over sheets:**
    - Reproduced in Expo Go: the number pad covers the whole verify sheet.
    - A development-build check was not possible. `adb install` of the 2026-10-19 debug APK fails with `INSTALL_FAILED_VERSION_DOWNGRADE`, because an uninstalled `com.sora.app` kept its data at version code 2. Clearing that is a destructive step that was not approved.
    - → BLOCKED

## Fixes Applied

- **`email-verification.service.ts:18-22, 44-87, 166-189`:** the conditional upsert, `sendRefusal`, and `nextSendAt`.
  - Migration 008 adds `window_started_at` and `sends_in_window`, guarded by `chk_email_verification_sends` and `chk_email_verification_window`.
  - The tests now backdate both timestamps through a `backdate()` helper.
  - Re-verified: server 322/322 and probe 005, with 8 checks.
- **`VerifyEmailSheet.tsx:12-25`:** the countdown now schedules from the value it rendered. It wakes 20 ms past each second boundary, or at most once a minute while more than a minute remains.
  - **`:44`:** reopening drops an expired code.
  - **`:134-140`:** the clock-time label is used when the wait is longer than a minute.
  - Re-verified on device, item 7.
- **`apiSlice.ts:101-110`:** `toQueryFnResult` reports `null` for a `void` result. No endpoint is typed to return `undefined`. Re-verified on device, item 8.
- **`LoginScreen.tsx:170,184` and `RegisterScreen.tsx:151`:** `flex-wrap`. Re-verified on device, item 10.
- **Locales:** `settings.verifyEmail.resendAt` added in all 10. Mobile tests, including locale parity: 822/822.
- **Dependencies:** item 4. Audit re-run: passes.
- **Test plans:** TC-AUTH-33 covers the parallel send and the daily cap, and its anchors were remapped. TC-AUTH-38 and TC-WAL-49 record today's device runs.

## Follow-ups

- **Orphan users:** run `psql "$DATABASE_URL" -f <scratchpad>/delete-orphans-61b401e4.sql`, or allow the command. The script refuses anything but `sora_dev` with the exact counts above.
- **Seed passwords for `016a89d4`:** lost. Run `npm run db:seed:passwords` against sora_dev if you sign in as those accounts.
- **Development-build keyboard check:** needs `adb uninstall com.sora.app` on the emulator to clear the kept version-2 data, or a fresh `npm run dev:mobile:build`.
- **body-parser 2.4.0 / multer 2.5.0:** take them on or after 2026-11-05.
- **Zod 4 migration:** plan it before 2026-11-26.
- **Not driven on a device:** reopening the verify sheet after a code has expired.
