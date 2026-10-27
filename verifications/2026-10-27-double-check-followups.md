# Double-check of the 2026-10-27 follow-up passes, and the theme-switch lag investigation

**Date:** 2026-10-27T06:30:49Z
**Method:** double-check skill
**Verdict:** PASS. Types, all four test suites, the DB probes, parity, agent sync and the dependency audit pass. Four findings were fixed. The theme-switch lag is narrowed down but not fixed: the next step needs your decision.

**Scope:** Everything changed today after the first double-check:
- the send cap and migration 008;
- the `VerifyEmailSheet` countdown;
- `toQueryFnResult`;
- the auth screens' wrapping and `KeyboardAvoidingView` padding, plus `keyboardAvoiding.test.ts`;
- the dependency acceptances;
- the docs, test plans and rule 20.

Also the continuation of the theme-switch investigation from 2026-10-27-dev-db-migrations-theme-motion.md.

**Files touched:**
- `docs/test-plans/accounts.md`
- `docs/API_SPECIFICATION.md`
- `mobile/src/features/settings/components/VerifyEmailSheet.tsx`
- `CLAUDE.md`
- `.agents/rules/bug-prevention-and-gotchas.md`

**Related reports:**
- 2026-10-27-dev-db-migrations-theme-motion.md
- 2026-10-27-orphans-dev-build-keyboard.md
- 2026-10-27-followups-send-cap-and-device-checks.md

## Method

- **Phase 1:** a general-purpose agent reviewed the scope read-only against CLAUDE.md Parts 5 and 7. I re-checked each finding against the code before acting on it.
- **Phase 2:**
  - `npm run typecheck`
  - `node scripts/check-contract-parity.mjs`
  - `npm run agents:check`
  - `node scripts/audit-runtime-deps.mjs`
  - `node scripts/migrate.mjs`
  - `psql -f db/tests/*.sql` on `scratch_dc` (port 55436)
  - `npm run test -w @sora/{server,mobile,contracts}`
- **Theme lag experiments:** on a development build on emulator `Medium_Phone` (API 36), each switch was recorded with `adb shell screenrecord` and split into frames with `ffmpeg fps=20`.
  - **A:** Reduce Motion on (transitions at 0 ms).
  - **B:** a light → dark baseline.
  - **C:** `Text` given a `color`-only transition, recorded the same way.

## Findings

1. **Phase 2:**
   - typecheck exit 0; parity 153/153; agent skills in sync; audit passes with 4 accepted;
   - "Up to date (8 migration(s) applied)"; probes 001–005 ok;
   - server 322/322, mobile 824/824, contracts 184/184.
   - → PASS
2. **Conditional upsert, window edges, migration 008 backfill and constraints:** reviewed, correct. → PASS
3. **TC-ACC-22 anchors were stale:** `carouselLayout.test.ts` #L7/#L15/#L26/#L33/#L58/#L64 landed on an import, a blank line and asserts. → FAIL, fixed
4. **Spec §2 claimed `/auth/me/email-verification` and `/confirm` "share" one per-IP limit.** `auth-rate-limit.guard.ts:27` keys on `ip:path`, so each route has its own 10/min bucket. → FAIL, fixed
5. **The `resendAt` label after the day's fifth send** showed only a time about 24 h ahead (`formatTimeOfDay`), so it read as today. → FAIL, fixed
6. **`useSecondsUntil` with an unparsable instant:** `Date.parse` gives NaN, so `setTimeout(NaN)` re-fires at once and never stops. The server always sends ISO strings, so this is latent. → fixed defensively
7. **Rule 20 cited `edgeToEdgeEnabled=true`,** which exists only in the gitignored, generated `mobile/android/gradle.properties`. → fixed
8. **i18n:** `resendAt` with `{{time}}` is in all 10 catalogs. → PASS
9. **Dead code:** clean. `Platform` was dropped where unused, and `FieldErrorKey` is an exported return type. → PASS
10. **Theme-switch lag:**
    - **A (Reduce Motion):** the whole screen, text and tab bar included, flips in the same frame. React commits the switch at once.
    - **B (baseline):** the switch runs down the screen as a wave lasting more than 500 ms. The tab bar was still light after 20 frames, and text in the lower sections stayed dark on an already-dark background for several frames.
    - **C (`color`-only `Text` transition):** the same wave, so the per-text property count is not the cause. Reverted, and `grep textColorTransition` finds 0 matches.
    - Reanimated 4.5.1 runs with `ANDROID_SYNCHRONOUSLY_UPDATE_UI_PROPS: false` (`staticFlags.json`), so every frame of every running colour transition goes through the shadow tree.
    - The likely cause is that Reanimated falls behind with this many simultaneous colour transitions and works down the tree. This is an inference from A–C and has not been profiled.
    - → open
11. **Blank first launch reproduced:** this was the dev client's bundle download being cut off ("java.net.ProtocolException: unexpected end of stream" in `BundleDownloader`), not app code. A relaunch loads normally. Development builds only.

## Fixes Applied

- **`docs/test-plans/accounts.md` TC-ACC-22:** anchors moved to the eight `it(` lines (17, 25, 36, 43, 53, 63, 68, 74).
- **`docs/API_SPECIFICATION.md:136`:** "each have the same 10-per-minute per-IP limit".
- **`VerifyEmailSheet.tsx`:**
  - `resendAt` uses `formatSavedAt` ("14:32" today, "Oct 28 10:24" otherwise; covered by `date.test.ts:235`);
  - an unparsable instant counts as 0.
  - Re-verified: typecheck exit 0; mobile 824/824.
- **Rule 20 in `CLAUDE.md` and `.agents/rules`:** now cites Expo's edge-to-edge default and its enforcement from API 35.

## Follow-ups

- **Theme-switch lag needs a decision:**
  - **(a)** Turn on Reanimated's experimental `ANDROID_SYNCHRONOUSLY_UPDATE_UI_PROPS` static flag. It is native config, needs a rebuild, and affects every animation.
  - **(b)** Cut the number of transitioning nodes, for example by transitioning only surfaces and not text.
  - **(c)** Go back to a single snapshot crossfade.
- **Noted, not changed:**
  - A failed delivery deletes the row, which resets the day's count. This matches spec §5.8 ("Undelivered, nothing is kept").
  - Clock skew over 60 s between API instances could break `chk_email_verification_window`. There is one instance today.
  - `linkHitSlop` is computed inline in RegisterScreen as well as in LoginScreen.
  - TC-WAL-47 anchors point at `assert` lines inside the right `it(`.
- **Carried forward:**
  - node-forge acceptance expires 2026-11-02;
  - body-parser and multer on or after 2026-11-05;
  - Zod 4 before 2026-11-26;
  - iOS not checked;
  - real SMTP untested.
