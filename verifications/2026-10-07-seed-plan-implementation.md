# Seed plan implemented: scripts/seed run against the local dev database and a scratch one

**Date:** 2026-10-07T10:09:52Z
**Method:** ad hoc
**Verdict:** PASS (phase 9 is only partly built; see Follow-ups)
**Scope:** a final review of `plans/tooling/seed-data-plan.md`, then building it (`scripts/seed/`) and running it. Seeded into the local `sora_dev`, which was empty, at the user's request. Phase 8 and the determinism re-run used a scratch database.
**Files touched:**

- `scripts/seed/` (new)
- `package.json` (`db:seed`; `typecheck` includes the seed)
- `.gitignore` (`.seed/`)
- `plans/tooling/seed-data-plan.md`, `plans/README.md`
- `RUNBOOK.md`, `README.md`, `CLAUDE.md`, `AGENTS.md`

**Related reports:** 2026-10-07-seed-plan-gap-fixes.md (follows up)

## Method

- **Dry runs (no API):**
  - `node scripts/seed/seed-demo.mts --dry-run`, with `SEED_ANCHOR=2026-10-07`;
  - scratchpad sweeps of `buildLedger` + `storyChecks`: 48 anchors 2026-10 … 2030-09 at SEED 1; seeds 1–40 at 2026-10-06 and 2027-03-15; seeds 1–40 at 2026-10-07, 2026-10-08, 2026-10-15 and 2027-03-15.
- **Local run:**
  - the API was started on port 3417 from the current `server/dist`, with `.env` (so `DATABASE_URL` → `sora_dev` on 5433);
  - `SEED_API_URL=http://127.0.0.1:3417 node scripts/seed/seed-demo.mts`.
- **Scratch run:**
  - as `postgres`: `CREATE DATABASE scratch_seed_68a017 OWNER sora`, then `node scripts/migrate.mjs` on it;
  - `rates-stub.mts` on 3418;
  - the API on 3419 with `EXCHANGE_RATE_API_URL=http://127.0.0.1:3418 EXCHANGE_RATE_CACHE_TTL_MINUTES=1`;
  - `SEED_API_URL=http://127.0.0.1:3419 SEED_ANCHOR=2026-10-07 SEED_RATES_URL=http://127.0.0.1:3418 node scripts/seed/seed-demo.mts`.
- **Targets confirmed:** `select count(*) from users` gave 4 in `sora_dev` and 4 in `scratch_seed_68a017`. After the stops, ports 3417–3419 were free.
- **Code checks:** `npm run typecheck` (includes `tsc -p scripts/seed/tsconfig.json`), `tsc --noUnusedLocals` on the seed, `node scripts/check-contract-parity.mjs`, `npm run agents:check`.

## Findings

1. **Final review of the plan, before building:**
   - **Phase 7:** a statement without an account name gets "which account?", because An's wallet has eight. The messages now name one.
   - **Phase 8:** after the TTL, STALE comes from the expired in-memory cache, not the snapshot. The seed can't stop a stub in another process, so the stub got `/_control/down` and `/up`. The stub's rates are written to the snapshot table, so phase 8 must run on a scratch database.
   - **Phase 9:** nothing says how a fixture file reaches the device.
   - All three are amended in the plan.
2. **Anchor sweep, first pass: 23 of 48 anchors errored.** Causes:
   - the Tet table ended at 2029;
   - the June trip could fall before H0;
   - Shared House weekend rows could land on H0 before the kitty was funded;
   - an anchor on the 1st has no rows in its own month, so Housing read 0.

   Fixes:
   - Tet table to 2031;
   - a June-trip H0 extension;
   - kitty rows start at H0 + 2;
   - a reading day of A − 1 when A is the 1st.

   After the fixes: 0 errors and 0 required-state misses at 48 anchors and for seeds 1–40. "Monthly Cap under at A" holds only when A is in a month's first week (the A − 7 currency exchange), so it is now a reported claim and Travel is the required "under". FAIL, fixed.
3. **Realism:**
   - With the plan's rows, Linh's BIDV ended at ≈ 172M. She now has BIDV Savings, taking 11M a month.
   - Khoa's wallet ended at ≈ 142M. That came from my own 12M salary; the plan specified none. He now opens at 40M with no income.

   Plan amended; dry runs re-run. Fixed.
4. **SEED:** SEED 1 misses one claim at 2026-10-07 (Linh Everything 77%). Seeds 2, 9, 18, 23 and 28 meet every claim at four anchors, so the default is now 2. PASS.
5. **Local run (`sora_dev`):** 3,083 requests in 24.4 s.

   | Phase | Result |
   |---|---|
   | Phase 1 | 20 requests |
   | Phases 3–4 | 2,708 transactions |
   | Item 1 before corrections | 19/19 |
   | Phase 6 | 49 corrections |
   | Item 1 | 19/19 |
   | Items 2–3 | 158/158 (two wallets, 13 months each) |
   | Item 4 | 54/54 |
   | Item 5 | 37/37 |
   | Item 6 | 22/22 |
   | Item 7 | 6/6 |
   | Item 9 | 8/8 |

   Coverage: an EXPENSE COMPLETED 1,343 / PENDING 3 / DELETED 11, TRANSFER 186; linh 73 / 352 / 49; mom 26 / 319 / 25; house 6 / 83 / 6; khoa 29; bao 53 / 121 / 3. PASS.
6. **Scratch run:**
   - same ledger digest `2a24917a2e2544b4`, same coverage table and balances, every item passing (item 8, determinism);
   - phase 8: FRESH `240271800.0000` VND, then STALE `240271800.0000` after 60.4 s;
   - run total 84.6 s.

   PASS.
7. **Regressions:**
   - typecheck clean (four projects);
   - seed with `--noUnusedLocals` clean, after removing two dead exports;
   - parity 65/65; agents in sync.

   PASS.

## Fixes Applied

Listed per finding; each re-verified by re-running the dry run or sweep that found it. The live runs came after all fixes.

## Follow-ups

- **Phase 9 is only partly built.** `--guest-fixture` writes An's wallet as `GuestData` (1,520 transactions at 2026-10-07). Not built: the `__DEV__` "Load demo data" action and the upload proof, because the plan doesn't say how the file reaches the device. That needs a decision.
- **`scratch_seed_68a017`** (local Postgres 5433) is left in place. Dropping it needs the user's go-ahead.
- **Manual pass in the app** (§7: Planning groups, Bao on a Melbourne device, offline at scale) not done. No device was driven.
- **The `sora_dev` seed can't be undone row by row.** Removing it means resetting `sora_dev`.
