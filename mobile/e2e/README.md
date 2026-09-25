# Mobile E2E (Maestro)

Critical journeys on an Android emulator, driven from outside the app. Why Maestro, and when to
reconsider: [plans/mobile/e2e-framework-decision.md](../../plans/mobile/e2e-framework-decision.md).
Selectors are the NC-04 `testID`s (CLAUDE.md).

| Path | What |
|---|---|
| `flows/` | One journey per file; `config.yaml` runs them all |
| `subflows/login.yaml` | Fresh install, then sign in as the seeded user |
| `scripts/` | Maestro JS run on the host: records or reads data through the API |
| `seed.mts` | Creates the probe user the flows sign in as |

## Run locally

Needs the Maestro CLI, JDK 17, an Android emulator, and a **disposable** database: the seed and the
flows write data and never clean it up.

1. Start the API on a scratch database, e.g. on port 3417 (`PORT=3417 npm start -w @sora/server`,
   with `DATABASE_URL` pointing at a `scratch_*` database).
2. Seed it, and keep the output:

   ```bash
   E2E_API_URL=http://127.0.0.1:3417 node mobile/e2e/seed.mts e2e.env
   ```

3. Build the E2E APK. `SORA_E2E_BUILD=1` lets this release build use plain HTTP to the local API
   (`app.config.js`). The prebuild regenerates `mobile/android/`, so back up anything you changed there.

   ```bash
   cd mobile
   SORA_E2E_BUILD=1 npx expo prebuild --platform android --clean --no-install
   cd android
   EXPO_PUBLIC_API_BASE_URL=http://localhost:3417 EXPO_PUBLIC_ALLOW_INSECURE_API=true NODE_ENV=production ./gradlew assembleRelease
   ```

4. Install it and run the flows. `adb reverse` makes the emulator's `localhost:3417` reach the host:

   ```bash
   adb reverse tcp:3417 tcp:3417
   adb install -r mobile/android/app/build/outputs/apk/release/app-release.apk
   maestro test mobile/e2e -e E2E_API_BASE=… -e E2E_EMAIL=… -e E2E_PASSWORD=… -e E2E_WALLET_ID=…
   ```

   Pass the four `E2E_*` values from `e2e.env`.

5. Regenerate a normal `android/` afterwards (`npx expo prebuild --platform android --clean`), so a
   later local release build doesn't keep the E2E cleartext setting.

CI does the same in the `e2e` job of `.github/workflows/ci.yml`.

## Writing a flow

- Check the `screen-*` root before acting. Tabs and stacked screens stay mounted, so some ids
  appear on more than one screen.
- Inspect what Maestro sees with `maestro hierarchy`, or with `maestro studio`.
- Prove writes through the API (`scripts/find-transaction.js`), not only on screen.
