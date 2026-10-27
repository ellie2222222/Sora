# Double-check of the email-verification / translated-form-errors pass, plus full re-verification of the working tree

**Date:** 2026-10-27T02:58:57Z
**Method:** double-check skill
**Verdict:** PASS. Typecheck, contracts, mobile and server tests, DB probes and parity pass. Three bugs were found and fixed, each with a test or a re-run. Nothing was driven on a device.
**Scope:**
- **Phase 1:** the ~75 files changed after `2026-10-23-double-check-session.md` (09:32Z). They came from the ad hoc follow-up pass in `2026-10-23-email-verification-and-followups.md`, which never had a Phase 1 sweep: the email-verification service, `server/src/mail/`, migration 007, `fieldErrors`, `VerifyEmailSheet`, `InvitationsSection`, and the forms that adopted translated errors.
- **Phase 2:** the whole uncommitted tree. Nothing has changed on disk since the last report.

**Files touched:**
- `server/src/auth/email-verification.service.ts`
- `server/test/integration.email-verification.test.ts`
- `mobile/src/utils/transactionForm.ts`
- `mobile/src/utils/transactionForm.test.ts`
- `mobile/src/features/transactions/components/TransactionFormModal.tsx`
- `mobile/src/features/settings/components/VerifyEmailSheet.tsx`
- `docs/test-plans/auth.md`
- `docs/test-plans/transactions.md`

**Related reports:** 2026-10-23-double-check-session.md and 2026-10-23-email-verification-and-followups.md. Their open follow-ups are carried below.

## Method

- **Phase 1:** a general-purpose agent did a read-only review of the scope above against CLAUDE.md Parts 3, 5 and 7. I re-read the code behind each finding before acting on it.
- **Static checks:**
  - `npm run typecheck`
  - `node scripts/check-contract-parity.mjs`
  - `npm run agents:check`
- **Tests:**
  - `npm run test -w @sora/contracts`
  - `npm run test -w @sora/mobile`
- **Throwaway cluster:**
  - Created with `initdb -D <scratchpad>/pg-scratch-dc -U scratch -A trust -E UTF8` and run with `pg_ctl … -o "-p 55436"`.
  - Used database `scratch_dc`, with `DATABASE_URL=postgresql://scratch@localhost:55436/scratch_dc`.
  - Ran `node scripts/migrate.mjs` twice.
  - Ran `psql -v ON_ERROR_STOP=1 -f db/tests/*.sql` with `PGCLIENTENCODING=UTF8`.
  - Ran `npm run test -w @sora/server`.
  - Stopped the cluster afterwards. The host Postgres was not touched.

## Findings

- **Typecheck:** clean in contracts, server, mobile and the seed scripts. → PASS
- **Contract parity:** 153/153. → PASS
- **Agent skills:** in sync (11). → PASS
- **Contracts tests:** 184/184. → PASS
- **Mobile tests:** 822/822 before the fixes and 822/822 after.
  - The self-transfer test now asserts more; no tests were added. → PASS
- **Migrations:** applied 001–007; the second run printed "Up to date (7 migration(s) applied)". → PASS
- **DB probes:**
  - 001 (87 PASS notices), 002, 003, 004 and 005 all pass. → PASS
  - The first run of 001 failed with `character with byte sequence 0x90 in encoding "WIN1252"`. That is psql's Windows client encoding, not a constraint: it passes with `PGCLIENTENCODING=UTF8`. This is environmental.
- **Server tests:** 319/319, then 320/320 with the new test. → PASS
- **Security of code verification (clean):**
  - The comparison is constant-time (`timingSafeEqual`).
  - Only an HMAC of the code is stored.
  - Attempts are claimed atomically by `UPDATE … WHERE attempts < 5 … RETURNING`.
  - `email_verified_at` is set only when the address still matches.
  - The code is never logged (LA-01).
- **Error codes, routes and spec (clean):** the 5 new codes are in `ERROR_CODES`, `ERROR_STATUS`, `docs/ERROR_CODES.md` and the mobile map. There are no route literals.
- **Rule 15, MB-10 and tokens:** clean in the touched mobile files.
- **Bug: the transaction form showed English errors.**
  - `TransactionFormModal` rendered `issue.message`, which is the contract's English text.
  - Every other form had moved to `fieldErrorMessage`, and the transfer and amount refinements already carry an `i18nKey`. → FAIL, fixed
- **Bug: a parallel confirm was audited twice.**
  - `confirm()` deleted the code and wrote an `EMAIL_VERIFIED` audit row even when its `users` update matched 0 rows, because a parallel confirm had already won.
  - With the guard disabled, the new test failed 3 out of 3 runs. → FAIL, fixed
- **Bug: the countdown timer kept running.**
  - In `VerifyEmailSheet`, the `useSecondsUntil` interval never cleared at 0.
  - The sheet stays mounted inside Settings, so it re-rendered every second indefinitely. → FAIL, fixed
- **UX: reopening the sheet showed an expired code.** It went straight to code entry for the expired code instead of offering a new send. → fixed
- **Cosmetic, not fixed:**
  - `FieldErrorKey` is exported but only used locally. It is the return type of an exported function, so the export was kept.
  - One import in `auth.controller.ts:32` is out of order.

## Fixes Applied

- **`email-verification.service.ts:112-120`:**
  - The `users` update now uses `executeTakeFirst()` and returns early when `numUpdatedRows === 0n`, so there is no second delete and no second audit row.
  - New test `integration.email-verification.test.ts:131` sends 4 parallel right-code confirms and expects exactly 1 `EMAIL_VERIFIED` row.
  - Verified both ways: the test fails 3/3 with the guard disabled and passes with it; the server suite is 320/320.
- **`transactionForm.ts` (`DraftIssue`):**
  - Now carries the `ZodIssue` instead of its English `message`.
  - `TransactionFormModal.tsx:173-176` words each issue through `fieldErrorMessage(issue, t)`, keeping the special case for an unpicked account.
  - The leftover `defaultValue` on `transactions.cancelledNotice` was dropped, because the key exists in `en.ts`.
  - The self-transfer test (`transactionForm.test.ts:226`) now asserts that the issue resolves to `validation.transferSameAccount`.
  - Re-run: typecheck clean; mobile 822/822.
- **`VerifyEmailSheet.tsx`:**
  - The interval clears itself once the target has passed.
  - Reopening drops a `sent` whose `expiresAt` has passed.
  - Re-run: typecheck clean.
- **Test plans:**
  - In `auth.md`, the anchors after the inserted test moved (131→142, 145→156, 155→166, 173→184), and TC-AUTH-34 now lists `:131`.
  - In `transactions.md`, the TC-TXN-27 anchors moved for the added lines.

## Follow-ups

- **Race in the resend cooldown:** `send()` reads the cooldown and then upserts as a separate step, so two concurrent sends both pass and the first code is replaced. The per-IP rate limit bounds this. A conditional upsert would close it. Not fixed: low impact, and it needs its own test.
- **Rotating `JWT_SECRET` voids open codes:** the HMAC key for verification codes is derived from `JWT_SECRET`, so a rotation invalidates any code already sent. This is acceptable, but worth noting in RUNBOOK if secrets are rotated.
- **Carried forward from 2026-10-23, still open:**
  - The 4 orphan users from seed run `61b401e4` on sora_dev: deleting them needs your approval.
  - Device checks are still pending: the deep link, the inbox (TC-WAL-49), the larger type in de/ru, the donut Others arc, and Decline from the inbox. The new sheet behaviour (timer stop, reopen after expiry) has not been checked on a device either.
  - The keyboard covers sheets in Expo Go.
  - The `follow-redirects` upgrade.
  - A real SMTP provider.
  - A per-account daily cap on code sends.
  - Clipping of `AccountCard` and the tab bar at the new type size.
