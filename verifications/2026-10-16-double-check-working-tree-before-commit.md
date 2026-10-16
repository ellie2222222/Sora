# Double-check of the uncommitted working tree before committing

**Date:** 2026-10-16T11:19:51Z
**Method:** double-check skill
**Verdict:** PASS
**Scope:** The whole working tree (122 entries). The sweep covers changes since `2026-10-16-double-check-dashboard-caching-test-logins.md`:
- Google sign-in, auth preferences bar, shared `LanguageOptions`
- unreachable-vs-offline message
- dev-client scripts and run docs
- guest upload "nothing uploaded yet" text
- Metro IPv4 bind
- text contrast and tab states

Earlier parts (AI chat, net worth, dashboard caching, test logins) rely on their own reports and were re-run through the full test suites only.
**Files touched:** `.gitignore`, `README.md`, `docs/DEVICE_NETWORKING.md`
**Related reports:** `2026-10-16-google-button-and-unreachable-message.md`, `2026-10-16-text-contrast-and-tab-states.md`, `2026-10-16-double-check-dashboard-caching-test-logins.md`

## Method

- `git status --short`; `git ls-files '*.apk' '*.aab'`; `git check-ignore -v mobile/sora-fixed.apk`
- `rtk grep -r "YearlyReport|languageHint|auth.languageLabel|yearOf(" mobile/src docs plans SRS.md SDS.md`
- usage grep for `isDeviceOnline|setDeviceOnline|LanguageOptions|AuthPreferences|GoogleLogo|noResponseMessage|pausedBodyNone`
- every `npm run <script>` in RUNBOOK.md, README.md and docs/DEVICE_NETWORKING.md checked against `package.json`
- `git diff --stat` plus a CRLF count against HEAD for the files edited through Python
- `npm run typecheck`, `node scripts/check-contract-parity.mjs`, `npm test`, `npm run agents:check`

## Findings

- `mobile/sora-fixed.apk` (99.8 MB) was untracked and **not ignored**, so `git add -A` would have committed it. **FAIL → fixed.**
- `docs/DEVICE_NETWORKING.md` row B (USB phone) still said `npm run start:lan` with `http://localhost:3000`. RUNBOOK Flow 1 and `mobile/.env` use the development build, `dev:mobile:usb`, `127.0.0.1` and `adb reverse` for both ports. **Drift → fixed.**
- `README.md:152` typo "development buildw". **Fixed.**
- Dangling references to deleted `YearlyReport`, `yearOf` and removed `auth.languageLabel`/`auth.languageHint`: none.
- New modules are all referenced: `deviceConnectivity`, `LanguageOptions`, `AuthPreferences`, `GoogleLogo`, `noResponseMessage`, `pausedBodyNone`.
- Every documented `npm run` script exists.
- Line endings: the files were already CRLF at HEAD. The diff is only the real edits (4 files: +75/−8), with no whole-file churn.
- Google round trip, an open follow-up in the Google report: the server logged `POST /api/v1/auth/google 200` + `USER_REGISTERED` from the phone. **Resolved.**

## Fixes Applied

- `.gitignore:33-35`: `*.apk`, `*.aab`. Re-checked: `git check-ignore -v mobile/sora-fixed.apk` now reports `.gitignore:34:*.apk`. The file itself is untouched.
- `docs/DEVICE_NETWORKING.md:35`: row B now names `dev:mobile:usb`, `127.0.0.1:3000` and both `adb reverse` ports. Line 41 adds a `dev:mobile:usb` bullet; `start:lan` is now described as Expo Go for A and C.
- `README.md:152`: typo fixed.
- Re-verification after the fixes:

  | Command | Result |
  |---|---|
  | `npm run typecheck` | exit 0, 0 `error TS` |
  | `check-contract-parity.mjs` | 140/140 |
  | `npm test` | contracts 176/176, server 104/104, mobile 754/754 |
  | `agents:check` | 11 skills in sync |

## Follow-ups

- On-device look of the contrast and tab changes (carried from `2026-10-16-text-contrast-and-tab-states.md`).
- `mobile/.env` points at a Cloudflare quick-tunnel URL that has been shut down. It is gitignored local config; switch back to `127.0.0.1` for USB.
- Unreachable-message on-device check (carried from the Google report).
