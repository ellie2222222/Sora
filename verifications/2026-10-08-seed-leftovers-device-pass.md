# Seed plan leftovers: phase 9 built and proven, manual app pass on the emulator, scratch database dropped

**Date:** 2026-10-08T03:05:39Z
**Method:** ad hoc
**Verdict:** PASS (two items not done: Bao on a Melbourne device and an offline edit synced back; see Follow-ups)
**Scope:** the follow-ups of 2026-10-07-seed-plan-implementation.md:
- phase 9's in-app loader and upload proof;
- the §7 manual pass;
- seeing the tab bounce run;
- dropping `scratch_seed_68a017`.

**Files touched:**

- `mobile/src/services/guest/guestFixture.ts` (new), `guestFixture.test.ts` (new), `index.ts`
- `mobile/src/features/settings/components/SettingsBottomActions.tsx`, `mobile/src/app/config/env.ts`
- `mobile/src/app/i18n/locales/{en,vi}.ts`, `.env.example`
- `scripts/seed/{serve-guest-fixture.mts,guest-upload-check.mts}` (new), `scripts/seed/client.ts`
- `plans/tooling/seed-data-plan.md`, `plans/README.md`, `RUNBOOK.md`

**Related reports:** 2026-10-07-seed-plan-implementation.md (follows up)

## Method

- **Fixture:** `node scripts/seed/seed-demo.mts --dry-run --guest-fixture demo-guest.json` (anchor 2026-10-08, SEED 2, 1,568 transactions).
- **Upload check from Node:** the API on 3419 against `scratch_seed_68a017`, then `SEED_API_URL=http://127.0.0.1:3419 node scripts/seed/guest-upload-check.mts demo-guest.json`.
- **Emulator setup:** `Medium_Phone` with Expo Go. The API ran on 3000 against `sora_dev`, `serve-guest-fixture.mts` on 3420, and Metro via `CI=1 EXPO_PUBLIC_DEMO_FIXTURE_URL=http://10.0.2.2:3420/ npx expo start --go`. The app was driven with `adb shell input`, `adb exec-out screencap` and `adb shell screenrecord`; frames were extracted with a scratch-venv `imageio-ffmpeg`.
- **On-device upload check:** a scratchpad script read the uploaded wallet's accounts and transaction count from `sora_dev` and compared them with the fixture.
- **Code checks:** `npm run typecheck`, `npm run test -w @sora/mobile`, `node scripts/check-contract-parity.mjs`, `npm run agents:check`.

## Findings

1. **Upload from Node:** 1,568 transactions uploaded through `uploadGuestData` in 25.9 s. 8/8 account balances, 7/7 goals (amount and status) and the transaction count match the fixture. PASS.
2. **"Load demo data" (guest Settings, development build):**
   - the button shows only when the URL is set;
   - the confirm sheet appears;
   - the toast "Demo data loaded" appears;
   - the wallet changes to "Ví của An".

   The user approved replacing the emulator's one existing guest row first. PASS.
3. **Planning on the fixture:**
   - Budgets: Current, then Upcoming (Next Tet, 0), then Ended (11.11 Sale, "Over budget").
   - Goals: In progress (Laptop Repair marked **Overdue** with a red deadline; Wedding Fund at 0%), then Completed (New Motorbike, 35.7M / 35M, 100%), then Cancelled (Learn Guitar, 20%).

   PASS.
4. **Tab bounce:** a screen recording of Planning → Dashboard at 30 fps shows the underline stretching in flight and the Dashboard icon lifting, both settled within about 12 frames (≈ 400 ms). PASS.
5. **Upload on the device:**
   - Signing in as An offered the upload; the screen has no skip. The data went into a new wallet, "Guest upload test", in 2.5 min.
   - Compared with the fixture: 8/8 balances and 1,568/1,568 transactions.
   - The wallet was then archived through the API (exact name, one match, 204), so An's demo is unchanged.

   PASS.
6. **Seeded account (An, vi):**
   - October shows separate USD, VND and JPY totals, the AI-confirmed "Spent 45k on coffee from MoMo" on 7 Oct, and the pending ryokan on 10 Oct.
   - The year list says "the newest 100 of 1,212", and 15 fast flings rendered without trouble.
   - Offline (airplane mode): Dashboard and Planning render from the cache. The balances equal the seed ledger: Vietcombank 28,374,100, Techcombank 58,634,000, MoMo 228,000 (273,000 less the AI coffee), Visa −299,000, Wise $5,809.18, Japan Cash ¥43,920.

   PASS.
7. **Tab underline, seen once:** it showed under Planning while Settings was selected, after a device time-zone change and a sign-out sheet opened and dismissed. Not reproduced in two attempts (sheet open and close; Planning → zone change → Settings). Recorded, not fixed.
8. **Metro, environment only:** one lazy chunk failed with `EMFILE: too many open files` (Windows file-handle limit), which showed a red dev overlay. The app continued normally. Not an app defect.
9. **Scratch database:**
   - Before dropping: only seed users (`seed+…-3af398e7`, `seed+guest-99c60e7c`) and no sessions.
   - Ran `DROP DATABASE scratch_seed_68a017`. Remaining: `postgres` and `sora_dev`.
   - Device zone restored to Asia/Bangkok. Ports 3000, 3420 and 8081 freed (the leftover Metro child, PID 18328, was stopped).

   PASS.
10. **Checks:**
    - typecheck clean;
    - mobile 665/665 (the 2 new `guestFixture` tests included);
    - parity 65/65; agents in sync.

    PASS.

## Fixes Applied

None needed beyond the new code. Each item was verified by the run described for it.

## Follow-ups

- **Bao's wallet on a device set to Melbourne:** not driven. The DST-day filing is proven through the API (verify item 9 on 2026-10-07). Only display times depend on the device's zone.
- **Offline at scale, the write half:** queuing an edit and an expense offline, then syncing, was not done. It would add rows to the seeded `sora_dev`. Offline reads were checked.
- **The tab underline mispositioning (finding 7):** worth one more look if it shows up again.
- **The guest upload screen has no "don't bring my data" option:** existing behaviour, noticed while testing, not changed.
