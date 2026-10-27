# sora_dev brought to migration 008; account deck, Reduce Motion and theme switch checked on a development build

**Date:** 2026-10-27T06:03:04Z
**Method:** ad hoc
**Verdict:** PASS on the migrations, the deck and Reduce Motion. FAIL on the theme switch: colours ease, but text colour and the tab bar arrive late, leaving text unreadable for about 200 ms. That issue is recorded below, not fixed.
**Scope:** The open items from the "any left over" answer that the user approved:
- apply 007/008 to sora_dev;
- the 2026-10-19 theme-switch checks that were never run on a device (colour easing, icon crossfade, status bar, `DECK` fix);
- the TC-ACC-23 device clauses, including Reduce Motion.

**Files touched:**
- `docs/test-plans/accounts.md` (TC-ACC-23)
- the sora_dev schema (migrations 007, 008)

**Related reports:**
- 2026-10-19-theme-color-transition.md, whose open device checks this pass runs
- 2026-10-27-orphans-dev-build-keyboard.md

## Method

- **Migrations:**
  - `psql "$DATABASE_URL" -c "select current_database(), inet_server_port()"` → `sora_dev|5433`.
  - `DATABASE_URL=… node scripts/migrate.mjs --status` showed 007 and 008 pending. Then `node scripts/migrate.mjs` and `--status` again.
  - Counted users and transactions afterwards.
- **Device:**
  - Emulator `Medium_Phone` (API 36), development build from 2026-10-27, `expo start --dev-client --localhost`.
  - Probe API on :3100 against `scratch_dc`, signed in as `seed+an-95bc47be@example.invalid` (Russian locale).
  - Driven with `adb shell input`, `screencap` and `screenrecord`. Frames were extracted with `ffmpeg -vf fps=20,…,tile`.
- **Reduce Motion:**
  - Recorded the baseline first: `animator_duration_scale` unset, `transition_animation_scale=1.0`, `window_animation_scale=1.0`.
  - Set all three to 0 and relaunched the app.
  - Restored the baseline afterwards: `settings delete global animator_duration_scale`, the other two back to `1.0`, then read back.

## Findings

1. **Migrations on sora_dev:** "applied 007_email_verifications.sql", "applied 008_email_verification_send_window.sql", and `--status` shows both APPLIED. `email_verifications` has all 8 columns. Users stay at 10 and transactions at 8617. → PASS
2. **Deck at rest (TC-ACC-23):** neighbours sit behind the front card, and the backlight surrounds the front card. → PASS
3. **Deck swipe and the `DECK` worklet fix:**
   - Mid-swipe, the cards and names row move together; settled, Vietcombank is in front and its orange backlight follows.
   - The Metro log since opening the deck holds no `error`, `ReferenceError` or `DECK` line.
   - → PASS
4. **Tapping a side card:** Techcombank comes forward with a green backlight. → PASS
5. **Reduce Motion:** with all three scales at 0, the side cards are drawn flat: full height and level with the front card, where normally they are smaller and set back. The deck still swipes. → PASS
6. **Theme switch, light to dark:** 20 fps frames over 2.76 s, Settings → Appearance.
   - **Easing:** surfaces ease through grey over about 300 ms, with no jump. The status bar dims along with them; after the switch, the light theme no longer draws white status text on white. → PASS
   - **Text arrives late:** once the backgrounds were already dark (frame 18), the palette names, the preview amount `₫12,500,000` and the "Язык" row title were still dark text. They stayed nearly invisible through frame 21 and caught up over the following frames.
     - Every `Text` uses the same `colorTransition` (200 ms, `Text.tsx:93`) as `ThemedView`, so the duration is not the cause.
     - Assumption, not confirmed: on Android, Reanimated applies a `Text`'s `color` through the shadow tree, which is slower than the path a view's background takes.
     - → FAIL
   - **Tab bar arrives late:** `CustomTabBar` is a `ThemedView` (`MainTabNavigator.tsx:58-67`), yet it stayed light in frames 16–21 while the content above it was dark. It switched afterwards. → FAIL
   - Icon crossfade: icons follow their row's colour in the frames, with no separate artefact.
7. **First launch after the build:** the app sat on a blank light screen for more than 3 minutes after "Android Bundled 5856ms", with nothing in Metro or logcat. A force-stop and relaunch loaded normally. It was not reproduced, so it is not counted as a finding.

## Fixes Applied

- **TC-ACC-23** → Covered: its device clauses were driven by hand, and the row links here.
- **The theme-switch lag (item 6) is not fixed.** Finding out why text and the tab bar arrive late needs a profile of the JS and UI threads during the switch. No small change was shown to fix it.

## Follow-ups

- **Theme-switch lag:** profile the switch on a development build with the React Native performance monitor or Perfetto, to tell which applies:
  - text colour going through a slower path, a Reanimated limit;
  - the switch's re-render arriving in more than one commit.

  The options then are:
  - give text its own shorter or delayed transition;
  - switch text colours instantly;
  - batch the switch into a single commit.
- **Carried forward:**
  - take body-parser 2.4.0 and multer 2.5.0 on or after 2026-11-05;
  - plan Zod 4 before 2026-11-26;
  - the node-forge acceptance expires on 2026-11-02;
  - iOS not checked.
