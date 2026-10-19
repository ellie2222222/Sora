# Mobile E2E (Maestro)

Critical journeys on an Android emulator, driven from outside the app. Why Maestro, and when to
reconsider: [plans/mobile/e2e-framework-decision.md](../../plans/mobile/e2e-framework-decision.md).
Selectors are the NC-04 `testID`s (CLAUDE.md).

| Path | What |
|---|---|
| `flows/` | One journey per file; `config.yaml` runs them all |
| `subflows/login.yaml` | Fresh install, then sign in as the seeded user |
| `subflows/add-expense.yaml` | Record a 12,000 expense described `DESCRIPTION` through the sheet |
| `subflows/guest-with-expense.yaml`, `guest-to-sign-in.yaml` | Fresh install as a guest with one expense; then from the guest to the sign-in screen |
| `scripts/` | Maestro JS run on the host: records or reads data through the API |
| `seed.mts` | Creates the probe user the flows sign in as |
| `outage-switch.mts` | Sits between the app and the API; `scripts/outage.js` takes the API "down" behind it (`server-outage` flow) |

## Run locally

Needs the Maestro CLI, JDK 17, an Android emulator, and a **disposable** database: the seed and the
flows write data and never clean it up.

1. Start the API on a scratch database, e.g. on port 3417 (`PORT=3417 npm start -w @sora/server`,
   with `DATABASE_URL` pointing at a `scratch_*` database).
2. Seed it, and keep the output:

   ```bash
   E2E_API_URL=http://127.0.0.1:3417 node mobile/e2e/seed.mts e2e.env
   ```

3. Start the outage switch in front of the API, and keep it running:

   ```bash
   E2E_API_URL=http://127.0.0.1:3417 node mobile/e2e/outage-switch.mts 3418
   ```

4. Build the E2E APK, pointed at the switch. `SORA_E2E_BUILD=1` lets this release build use plain HTTP to the local API
   (`app.config.js`). The prebuild regenerates `mobile/android/`, so back up anything you changed there.

   ```bash
   cd mobile
   SORA_E2E_BUILD=1 npx expo prebuild --platform android --clean --no-install
   cd android
   EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3418 EXPO_PUBLIC_ALLOW_INSECURE_API=true NODE_ENV=production ./gradlew assembleRelease
   ```

5. Install it and run the flows. `10.0.2.2` is the emulator's route to the host's loopback. Use it,
   not `adb reverse`: a reversed port bypasses airplane mode, so the offline-sync flow would never go
   offline.

   ```bash
   adb install -r mobile/android/app/build/outputs/apk/release/app-release.apk
   maestro test mobile/e2e -e E2E_API_BASE=… -e E2E_EMAIL=… -e E2E_PASSWORD=… -e E2E_WALLET_ID=… -e E2E_OUTAGE_SWITCH=http://127.0.0.1:3418
   ```

   Pass the four `E2E_*` values from `e2e.env`, plus the switch's host-side address.

6. Regenerate a normal `android/` afterwards (`npx expo prebuild --platform android --clean`), so a
   later local release build doesn't keep the E2E cleartext setting.

CI does the same in the `e2e` job of `.github/workflows/ci.yml`.

## Writing a flow

- Check the `screen-*` root before acting. Tabs and stacked screens stay mounted, so some ids
  appear on more than one screen.
- Inspect what Maestro sees with `maestro hierarchy`, or with `maestro studio`.
- Prove writes through the API (`scripts/find-transaction.js`, `count-transactions.js`), not only on screen.
- A flow that turns the network off (`setAirplaneMode`) turns it back on in `onFlowComplete`, so a
  failure never strands the flows after it offline.
