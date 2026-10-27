# Comment audit of the files changed on 2026-10-27

**Date:** 2026-10-27T06:33:04Z
**Method:** comment-audit skill
**Verdict:** PASS. Four comments were rewritten and none were added. One comment's stated reason was false, which also invalidated the code it justified, so that code was changed separately, outside the comment-only audit.
**Scope:** The comments this session's passes added or changed today:
- the email-verification service and its tests;
- `VerifyEmailSheet`, `apiSlice`, `transactionForm`/`TransactionFormModal`, `BottomSheetModal` and the auth/chat screens;
- migration 008, probe 005, and `keyboardAvoiding.test.ts`.

Policy: CLAUDE.md Part 7 rule 11 (why only, one or two lines, no debug journal, no untracked TODOs).

**Files touched:**
- `server/src/auth/email-verification.service.ts`
- `mobile/src/features/settings/components/VerifyEmailSheet.tsx`
- `db/tests/005_email_verifications.sql`

**Related reports:** 2026-10-27-double-check-followups.md

## Method

- Listed the added comment lines with `git diff -U0 -- <file> | grep -E '^\+\s*(//|/\*|\*|\{/\*)'` for each tracked file in scope, and read the untracked ones whole.
- Checked each claimed reason against its source. One claim was checked with `grep -rn -i "long period of time\|MAX_TIMER_DURATION" node_modules/react-native/Libraries`, which returned no match in RN 0.86.3.
- Afterwards: `npm run typecheck` (exit 0) and `npm run test -w @sora/mobile` (824/824).

## Findings

- **`VerifyEmailSheet.tsx:20-21` was wrong (pattern 4).** It said "React Native timers can fire early" and "Android flags timers longer than a minute".
  - The first was never verified: the stall that was proved came from the effect reading a fresh clock rather than the rendered value.
  - The second is false in RN 0.86.3, which has no long-timer warning.
  - Rewritten to the reason that holds: the timer wakes just after the shown number changes, and beyond a minute the label shows a clock time.
- **`email-verification.service.ts:93` was stale (pattern 4).** It said only that "the cooldown must not hold back the retry", but the delete also resets the day's count (spec §5.8: "neither limit applies"). Rewritten to name both.
- **`email-verification.service.ts:172` was incomplete.** The row can also vanish because a parallel send's mail failed, not only because a parallel confirm used it. Rewritten.
- **`db/tests/005_email_verifications.sql:3-5`:** one 125-character header line was rewrapped to the file's width.
- **Kept, accurate and why-only:**
  - service `:17`, `:20`, `:50`, `:118-119`, `:142`, `:161`, `:184`;
  - test `:37`, `:46`, `:132`;
  - `apiSlice.ts` `toQueryFnResult` (checked against RTK 2.12.0 `rtk-query.legacy-esm.js:1015`);
  - `TransactionFormModal.tsx` (the unpicked-account case and the MB-10 deep import);
  - the `BottomSheetModal.tsx` edge-to-edge note;
  - the `keyboardAvoiding.test.ts` header;
  - the 008 header, which matches 007's header style.
- **Missing comments:** none owed in scope.
- **Flagged, not fixed:**
  - `keyboardAvoiding.test.ts` and `BottomSheetModal.tsx` point at CLAUDE.md Part 7 rule 20 by number, so a renumbering would orphan them.
  - `email-verification.service.ts:17,20` restate the `CHECK` bounds in migrations 007 and 008, and nothing keeps the two in sync.

## Fixes Applied

- **The comment edits above.** Every changed line was a comment line replaced by a comment line. Re-verified: typecheck exit 0; mobile 824/824.
- **Code change made outside the audit:** `VerifyEmailSheet.tsx:22` capped the long wait at one minute, and its only stated reason was the false Android claim.
  - The delay is now `remaining - 60_000` beyond the last minute; a 24 h `setTimeout` is within JS's limit of about 24.8 days.
  - Re-verified: `npm run typecheck -w @sora/mobile` exit 0.
  - Not re-driven on a device.

## Follow-ups

- Re-drive the fifth-send label on a device to see the timer wake at the last minute, which is the path the code change touched.
- The two flagged cross-references above.
