# Guest upload: cancel, run in background, resume, per-step counts, and the redesigned screen

**Date:** 2026-10-08T03:49:41Z
**Method:** ad hoc
**Verdict:** PASS
**Scope:**
- the guest → account upload flow, reworked so it can be cancelled and moved to the background;
- its screen, redesigned;
- the upload sequencer's handling of a stop or a failure part-way.

**Files touched:**
- `mobile/src/services/guest/guestUpload.ts` and `guestUpload.test.ts`
- `mobile/src/services/guest/guestUploadTask.ts` and `guestUploadTask.test.ts` (new)
- `mobile/src/services/guest/index.ts`
- `mobile/src/app/providers/AuthProvider.tsx`
- `mobile/src/app/navigation/RootNavigator.tsx`
- `mobile/src/features/guest/` (screen, `components/`, `useGuestUpload.ts`, `index.ts`)
- `mobile/src/design-system/sizes.ts`
- `mobile/src/app/i18n/locales/{en,vi}.ts`
- `SRS.md`, `SDS.md`, `docs/DESIGN_GUIDELINES.md`, `docs/test-plans/guest.md`

**Related reports:** 2026-10-08-seed-leftovers-device-pass.md. It noted "the guest upload screen has no don't-bring-my-data option"; this adds "Not now".

## Method

**Code checks:**
- `node --test src/services/guest/guestUpload.test.ts src/services/guest/guestUploadTask.test.ts`
- `npm run test -w @sora/mobile`
- `npm run typecheck`
- `node scripts/check-contract-parity.mjs`
- `npm run agents:check`

**Device setup:**
- `Medium_Phone` emulator with Expo Go.
- API on 3000 against `sora_dev`.
- `serve-guest-fixture.mts` serving the 1,568-transaction demo fixture on 3420.
- Metro started with `--clear`.

**Device steps:**
- Signed out An, entered guest mode, and used "Load demo data".
- Registered `probe-upload-8fde4124@example.invalid`. One wallet, so the upload started on its own.
- Drove the screen with `adb shell input`. While the screen animates, uiautomator can't read it ("could not get idle state"), so taps went by coordinates.

**Server check:**
- Read-only `SELECT`s on `sora_dev` for the probe's wallet, compared with the fixture.
- The device's typed password didn't match the saved one, so the API login was not retried. Two failed attempts, under the limit of 5.

## Findings

1. **Sequencer order bug, found while reading the code:**
   - Goal statuses were settled before budgets uploaded.
   - The server refuses a budget on a non-ACTIVE goal (`GOAL_NOT_ACTIVE`, `budgets.service.ts:128`).
   - So a guest goal budget on a completed or cancelled goal failed on every retry.
   - Fixed by moving `settleGoalStatuses` after `uploadBudgets`.
   - New test `guestUpload.test.ts:749` passes.
2. **Resuming can repeat the steps that create nothing:**
   - Goal cancel/complete and archives are not recorded in the progress maps.
   - The server treats a repeat as a no-op: `goals.service.ts:162`, `accounts.service.ts:201` and `categories.service.ts:257` return early.
   - Resuming is safe. PASS.
3. **Cancel (unit):**
   - The request in flight finishes and is recorded; nothing after it is sent.
   - A resume creates only the rest.
   - An already-aborted signal sends nothing.
   - Tests at `:766` and `:791`. PASS.
4. **The upload task (unit):**
   - running → done; cancel → stopping → stopped.
   - A failure keeps its error and can start again.
   - A second start is ignored.
   - A reset drops a late outcome.
   - The background flag holds while the upload runs.
   - 6/6 tests. PASS.
5. **Running screen (device):**
   - Steps listed in run order: categories, accounts, goals, transactions, budgets, archives.
   - Each row shows done / total: 53/53, 8/8, 47/47, 191/1.568, 0/11, 0/4.
   - Vietnamese digit grouping, and the totals sum to 1,691 rows.
   - Ring, comet, title dots and bar move; the running row's highlight has soft edges.
   - PASS.
6. **Continue in background (device):**
   - The app shows with "Đang đồng bộ dữ liệu… 11%" at the top.
   - Home and Settings stayed usable while it ran, up to 27%.
   - Tapping the pill reopened the screen at 17% → 27%.
   - PASS.
7. **Cancel (device):**
   - The screen became "Đã tạm dừng tải lên" with "290 trên 1.691 mục đã có trong Ví của Probe".
   - The transactions row shows the pause icon at 182 / 1.568.
   - The API log's last POST was at 10:33:27, when Cancel was pressed.
   - PASS.
8. **Relaunch after cancel (device):**
   - Expo Go was force-stopped and relaunched.
   - The same paused view came back from the saved maps, and the upload didn't restart on its own.
   - "Not now" opened the app with "Đã tạm dừng · Chạm để tiếp tục".
   - Tapping it, then Resume, continued from 182 → 191 → 193.
   - PASS.
9. **Theme (device):**
   - Switched to light mode with the Sage palette while the upload ran.
   - The screen followed: teal ring, bar and button, light card, light background.
   - The comet's head used the text colour, which is near-black in light mode. Now the accent colour in light mode; see Fixes.
   - PASS after the fix (code only).
10. **Finish in background (device):**
    - Sent to the background, it finished. API activity stopped at 1,650 POSTs.
    - The pill went away, and Home showed the uploaded data.
11. **Server against the fixture:**

    | | Server | Fixture |
    |---|---|---|
    | Transactions | 1,568 (1,568 distinct by accounts, amount, date and description) | 1,568 |
    | Goals | 7 | 7 |
    | Goal statuses | 5 active, 1 cancelled, 1 completed | the same |
    | Budgets | 11 | 11 |
    | Contributions | 40 | 40 |
    | Account balances matching | 8 / 8 | |

    - The new account's own default "Tiền mặt" sits alongside at 0; the uploaded one holds 739,000, as in the fixture.
    - Nothing was uploaded twice across the cancel, the relaunch and the resume. PASS.
12. **Checks:**
    - mobile 678/678, including `tokens-usage` (no literal design values);
    - typecheck clean;
    - parity 65/65;
    - agent skills in sync.

    PASS.

13. **E2E, with the animated screen:**
    - E2E release APK built with `SORA_E2E_BUILD=1`, the API on 3417, and `mobile/e2e/seed.mts`, against the scratch database `scratch_e2e_855321`.
    - `maestro test mobile/e2e/flows/guest-upload-register.yaml mobile/e2e/flows/guest-upload-choose-wallet.yaml` → "2/2 Flows Passed in 4m 4s".
    - Maestro reads the screen while it animates, unlike plain uiautomator.

    PASS.
14. **Light-mode comet, after the fix:**
    - In the E2E build, I registered `probe-comet-f71141f6@example.invalid` on the scratch API in light Obsidian.
    - The emulator's network was slowed (`adb emu network delay gprs`, `speed gsm`, both reset after).
    - In a 25 s `screenrecord` at 1 fps, the head is the accent blue with no dark smudge.
    - The recording also shows each step's count rising (categories 2/38 → 14/38 → 27/38 → 38/38), the check landing on accounts 1/1, and the "Your data is now in your wallet" toast after it finished.

    PASS.

## Fixes Applied

- `guestUpload.ts`: goal statuses move after budgets (finding 1). Re-verified by `guestUpload.test.ts:749`.
- `UploadStepsCard.tsx`: the running row's highlight changed from a flat rectangle to a gradient. Seen on the device in finding 8.
- `UploadProgressBar.tsx`: the track uses `colors.border`, so it shows on the pill. Seen on the device in finding 8.
- `SyncRing.tsx`: the comet's head is `colors.primary` in light mode. Seen on the device in finding 14.
- The screen formats counts with the app language's digit grouping. Seen on the device in finding 5.

## Follow-ups

- **Scratch database `scratch_e2e_855321`:** dropped with the user's approval, after checking it held only four `@example.invalid` probe users and had no open connections. Remaining databases: `postgres` and `sora_dev`.
- **`mobile/android/` was regenerated** by `expo prebuild --clean` (README step 5): no cleartext setting, the same debug keystore. `gradle.properties` now has `expo.sqlite.useSQLCipher=true`, from the current app config; the old copy (2026-09-25) predated it.
- **Probe data in `sora_dev`:** `probe-upload-8fde4124@example.invalid` and its wallet "Ví của Probe" remain. They're kept apart from the seeded personas, and there is no delete path for a user.
- **The gear at the top left** in the request's mock-up is Expo Go's developer-menu button. It isn't part of the app and isn't in a real build.
