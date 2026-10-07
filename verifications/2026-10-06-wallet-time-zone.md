# Wallet time zone: every wallet calendar day read in the wallet's IANA zone

**Date:** 2026-10-06T08:35:57Z
**Method:** ad hoc, plus the scratch-probe procedure for the database run
**Verdict:** PASS (copy and picker not seen on a device; no device attached)
**Scope:** The [timezone.md](../plans/architecture/timezone.md) brief, implemented as recorded in [wallet-timezone-plan.md](../plans/architecture/wallet-timezone-plan.md):
- `wallets.time_zone`;
- `packages/contracts/src/calendar.ts` threaded through `calc.ts`;
- the server's list, dashboard, budget and audit date logic;
- the app's date utilities, screens, guest mode and offline-sync maths;
- the time-zone picker;
- docs and tests.

**Files touched:** see the plan's audit table, plus `docs/API_SPECIFICATION.md` (§2.3, §2.12 new, §5.1, §5.3, §6, §11.1, §12, §14, §15.1, §18), `SRS.md`, `SDS.md`, `plans/architecture/domain-database-design.md`, `CLAUDE.md` (tree, rule 18), `AGENTS.md`, `.agents/rules/bug-prevention-and-gotchas.md`, `plans/README.md` and `docs/test-plans/{wallets,transactions,budgets,dashboard,README}.md`. `server/src/common/utc-day.ts` was removed.
**Related reports:** 2026-10-06-double-check-seed-data-plan.md (raised the midnight case)

## Method

- Audit: grep over `server/src`, `packages/contracts/src` and `mobile/src` for `slice(0, 10)`, `T00:00:00`, `todayUtc`, `dayAfter`, `dayOfInstant`, `isWithinPeriod`, `today()` and `getUTC*`. Each hit was classified 1–5 per brief §8 (table in the plan).
- `npm run typecheck`, `npm test`, `node scripts/check-contract-parity.mjs`, `npm run agents:check`.
- `npx expo export --platform android --output-dir <scratchpad>`.
- Baseline listings taken: `docker ps -a` (10) and dangling volumes (20).
- Disposable database:
  - `docker run --name scratch-tz-e10b … -p 127.0.0.1:55617:5432 postgres:17`;
  - `node scripts/migrate.mjs --constraints`, run twice;
  - `001_constraints.sql` piped through `psql` to read the new probe lines;
  - `SELECT is_iana_time_zone(…)`;
  - `DATABASE_URL=… npm run test -w @sora/server`;
  - `docker rm -f -v scratch-tz-e10b`, then both listings diffed against the baseline.
- The first container, on port 55005, recorded the port binding but never opened it (`NetworkSettings.Ports` empty). The port isn't in Windows' reserved ranges, so I removed that container by name and re-ran on 55617.

## Findings

1. **Regression case, shared code.** `dayOfInstant('2026-10-31T23:30:00Z', 'Asia/Ho_Chi_Minh')` gives `2026-11-01`. Also covered:
   - 23:59 local stays Oct 31;
   - 00:00 and 06:59 local are Nov 1;
   - a UTC midnight crossing doesn't change the day;
   - Los Angeles reads 03:00Z on Nov 1 as Oct 31;
   - New York across the 2026-03-08 spring-forward;
   - DST days are 23 and 25 hours long;
   - spring-forward gap times resolve forward, and fall-back overlaps (New York, London) resolve to the earlier instant;
   - `withDay` keeps the local time across DST;
   - results are identical with the process `TZ` set to Ho Chi Minh, Tokyo and Los Angeles.

   `calendar.test.ts`: 21/21 PASS.
2. **Budget boundary (brief §12).** In a Vietnamese wallet, 23:30 on Nov 30 (16:30Z) counts toward November and 00:30 on Dec 1 (17:30Z on Nov 30) does not. Checked in contracts, on the real server (`integration.timezone:71`, `spent` = `300.0000`) and in the offline patch (`pendingTotals:256`). PASS.
3. **Server on a real database** (`integration.timezone.test.ts`, 8/8):
   - a wallet with no zone, `+07:00` or `Vietnam/Hanoi` gets 422;
   - the list filter and dashboard month put 23:30Z Oct 31 under Nov 1, with `period.timeZone` echoed;
   - the Los Angeles wallet reads behind UTC;
   - an owner and a viewer get identical figures and lists;
   - the owner changes the zone (EDITOR gets 403), days re-file, and the stored `transaction_date` stays `2026-10-31T23:30:00.000Z`;
   - the all-wallets list reads each row in its own wallet's zone;
   - the dashboard defaults to the zone's current month.

   PASS.
4. **Database.** The migration applies, and the second run reports "Up to date". New probes, all PASS:
   - accept an IANA zone;
   - reject `+07:00`;
   - reject an unknown name;
   - reject a wallet with no zone.

   `is_iana_time_zone` returned `t|t|f|t` for `Asia/Ho_Chi_Minh`, `asia/ho_chi_minh`, `+07:00` and `UTC`.
5. **Older suites under the new rule.** Three server tests failed on the first run, all because of the rule change rather than a code fault:
   - two dashboard assertions predated `period.timeZone`;
   - one planning fixture at 23:00Z on May 31 is 06:00 on June 1 in the probe wallet's zone, so it correctly counted in June.

   Fixed by keeping each test's intent: the fixture moved to 16:00Z (23:00 local on May 31), and the default-month test computes the month in the wallet's zone (it would otherwise flake in the last seven hours of every month). Re-run: 252/252, 0 skipped. Two mobile fixtures failed the same way and are now pinned to `'UTC'`:
   - a budget with no zone fell back to this machine's Asia/Bangkok zone;
   - a guest dashboard assertion expected the period without `timeZone`.
6. **Mobile:**
   - day groups (`groupByDate:45`);
   - the date picker keeps the local time on the new day (`date:185`);
   - contributions are stamped at local midday (`date:179`);
   - guest mode in a Vietnamese zone: list filter, dashboard and budget (`guestTimeZone:35`);
   - picker options (`timeZones.test`).

   The picker test caught that V8's `Intl.supportedValuesOf` lists only `Asia/Saigon`, so "Ho Chi Minh" was unsearchable; the suggested modern names are now always offered. PASS.
7. **Sweep after the change.** The remaining `slice(0, 10)` and `T00:00:00.000Z` hits are all calendar-date arithmetic (class 2), the exchange-rate snapshot date (class 5), or the invitation expiry display (class 4). `GoalDetailModal:191`, a contribution's UTC day and class 3, was missed in the first pass and is now fixed. Nothing references `todayUtc`, `utc-day` or `instantOfDay`. PASS.
8. **Final runs:**
   - typecheck: 0 errors;
   - `npm test`: contracts 167/167, server unit 66/66, mobile 650/650;
   - parity 65/65; agents in sync;
   - `expo export`: "Android Bundled 28751ms (3789 modules)";
   - scratch-DB server suite 252/252, constraint suites PASS;
   - teardown: containers and dangling volumes match the baseline.

## Fixes Applied

See Findings 5–7. Each was re-verified by the run in item 8.

## Follow-ups

- Run on a device:
  - create a wallet and see the device zone preselected;
  - change it as owner and confirm the dialog;
  - record at 06:30 local and see it under today;
  - check that Hermes' `Intl` resolves `timeZone` and `formatToParts`. Node was the only engine exercised.
- Product question: row times still show device time (brief §15). A member whose phone sits in another zone sees the wallet's day heading with their own clock time. Decide whether times should follow the wallet too.
- The guest wallet's zone can't be changed. The edit card is hidden in guest mode, as before.
- The local `sora-postgres` database and the `sora-server` image need rebuilding, because `001_schema.sql` changed again.
