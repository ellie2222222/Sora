# Google sign-in button shown; "offline" only when the device has no internet

**Date:** 2026-10-16T08:46:04Z
**Method:** ad hoc
**Verdict:** PASS (the Google round trip itself is BLOCKED, see Follow-ups)
**Scope:**
- why the Login screen showed no Google button;
- why a phone that has internet but can't reach the API was told "Bạn đang ngoại tuyến" (you're offline).

**Files touched:**
- Code: `mobile/src/utils/{deviceConnectivity.ts (new), errors.ts, errors.test.ts, index.ts}`, `mobile/src/hooks/useNetworkStatus.tsx`, `mobile/src/components/StateView.tsx`, `mobile/src/features/accounts/components/AccountDetailModal.tsx`, `mobile/src/features/chat/{chatExchange.ts, chatExchange.test.ts}`, `mobile/src/features/auth/hooks/useGoogleSignIn.ts`, `mobile/src/app/config/env.ts`
- Locales: all ten (`ai.failure.unreachable`)
- Docs: `.env.example`, `RUNBOOK.md`, `docs/test-plans/{ai.md, auth.md}`
- Local, gitignored: `mobile/.env`

**Related reports:** `2026-10-16-double-check-dashboard-caching-test-logins.md`

## Method

```
grep EXPO_PUBLIC_GOOGLE_* in .env and mobile/.env      # names and lengths only
node: compare each EXPO_PUBLIC_GOOGLE_CLIENT_ID_* with the server's GOOGLE_CLIENT_ID list   # booleans only
npm run typecheck -w @sora/mobile
npm run test -w @sora/mobile
cd mobile && npx expo export --platform android --output-dir <scratchpad>/expo-export2; grep -c apps.googleusercontent.com <bundle>.hbc
node <scratchpad>/checkrefs.mjs                          # test-plan #L links land on a test start
keytool -list -v -keystore mobile/android/app/debug.keystore -alias androiddebugkey -storepass android
```

## Findings

1. **The button already existed** (`LoginScreen.tsx`, `testID="login-google"`). It is hidden when no client ID is configured.
   - The three `EXPO_PUBLIC_GOOGLE_CLIENT_ID_*` were only in the root `.env`, and Expo reads `mobile/.env`.
   - → copied into `mobile/.env`. The bundle now contains the ID (1 match).
2. **The old hook could not finish on a phone.** It asked Google for an ID token directly (`ResponseType.IdToken`, no PKCE), and only the web build may do that.
   - → rewritten on `expo-auth-session/providers/google`'s `useIdTokenAuthRequest`: the code flow with PKCE on native, the ID token directly on web.
   - It waits for the provider's later `response`, with a 60 s limit so the button never spins forever.
   - The server requires no nonce (`verifyIdToken` checks `audience` only), so dropping the nonce is safe.
3. **Only one OAuth client exists.** WEB, IOS and ANDROID are the same single ID, and it is the one in the server's `GOOGLE_CLIENT_ID`.
   - A Web client can't complete sign-in from a native app or Expo Go: Google only redirects to the app that owns the client.
   - → documented in `.env.example` and the RUNBOOK. The old comment claiming "WEB alone is usually enough" is corrected.
4. **Every no-response error said "offline".** `getServerErrorMessage`, `StateView`, `AccountDetailModal` and the chat's `failureOf` all mapped any network error to `errors.offlineTitle` / `ai.failure.offline`. Yet `useNetworkStatus` already knew from NetInfo whether the device itself was online.
   - → a new module-level `isDeviceOnline()` flag (`utils/deviceConnectivity.ts`), set only by the NetInfo listener.
   - A no-response error now reads `errors.connectionUnreachable` ("Không kết nối được Sora" / "Can't reach Sora") while the device is online, and "offline" only when it isn't.
   - The chat uses the new `ai.failure.unreachable`, in ten locales.
   - The existing `setCurrentlyOnline` flag is left alone: `readSignedIn` also sets it false on a failed request, so it means "use local data", not "the device has no internet".
5. **Why the user's phone couldn't reach the API:** `mobile/.env` points `EXPO_PUBLIC_API_BASE_URL` at `10.0.2.2`, the emulator's alias for the host, and `--tunnel` carries only Metro. → explained to the user, with the `adb reverse tcp:3000 tcp:3000` + `http://localhost:3000` steps from `docs/DEVICE_NETWORKING.md` (case B). Not changed: it's their device setup.

## Fixes Applied

| Check | Result |
|---|---|
| `npm run typecheck -w @sora/mobile` | 0 errors |
| `npm run test -w @sora/mobile` | 749 pass, 0 fail. `errors.test` and `chatExchange.test` now assert both offline and unreachable |
| `expo export --platform android` | exit 0, 3835 modules, 7.9 MB; the provider and its nested `expo-application` resolve |
| test-plan links | 687 checked. 6 shifted by these edits were re-pointed (`ai.md:42`, `auth.md:56`), leaving the known 8 that point inside a test |

## Follow-ups

- **BLOCKED: the Google round trip was not run.** It needs:
  - an Android OAuth client for package `com.sora.app` with debug SHA-1 `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`;
  - that client's ID in `EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID` (`mobile/.env`), added to `GOOGLE_CLIENT_ID`;
  - a development build (`npx expo run:android`).
- **No on-device check of the new message.** Expected on a phone with internet but no route to the API: "Không kết nối được Sora" instead of "Bạn đang ngoại tuyến".
