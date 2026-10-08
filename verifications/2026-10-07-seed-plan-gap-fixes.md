# Fixing the seed plan's remaining gaps: simulation, measured throughput, relationLabel, Planning states

**Date:** 2026-10-07T09:10:53Z
**Method:** ad hoc. Two background agents: a ledger simulation, and a throughput measurement using the scratch-probe procedure. Every agent figure was spot-checked by re-running its script
**Verdict:** PASS (Planning screen and switcher not driven on a device: no device attached)
**Scope:** the eight gaps listed after the five-pass review: unproven numbers, the `relationLabel` meaning, states the app couldn't show, reproducibility, one time zone, modelling compromises, uncovered areas, plan size and the unmeasured estimate. The user chose the inviter's meaning for `relationLabel`, approved adding the states to the app, and approved one disposable Postgres container for the measurement
**Files touched:**

- `mobile/src/features/planning/{planningSections.ts,planningSections.test.ts}` (new)
- `mobile/src/features/planning/screens/PlanningScreen.tsx`, `mobile/src/features/planning/components/GoalCard.tsx`
- `mobile/src/features/wallets/components/WalletSwitcher.tsx`
- `mobile/src/app/i18n/locales/{en,vi}.ts`
- `packages/contracts/src/{schemas,responses}.ts` (comments only)
- `SRS.md`, `SDS.md`, `docs/API_SPECIFICATION.md`
- `docs/test-plans/{budgets,goals,README}.md`
- `plans/architecture/domain-database-design.md`, `plans/tooling/seed-data-plan.md`

**Related reports:** 2026-10-07-seed-data-plan-five-pass-review.md (follows up)

## Method

- **Simulation** (scratchpad `seedsim.mts`, `evalchecks.mts`, `pickseed.mts`):
  - models the plan's rules with seeded randomness, using `budgetWindow`, `zonedInstant` and `dayOfInstant` from `@sora/contracts`;
  - asserts that every row's local day equals its generated day;
  - covers 300 seeds at A = 2026-10-06 and 300 at 2027-03-15, plus a 48-anchor sweep.
- **Re-checked by hand:**
  - `node evalchecks.mts 100 2026-10-06,2027-03-15 baseline,final` (23 s);
  - `node pickseed.mts`.
- **Throughput:**
  - one container, `scratch-seed-55b2b4` (postgres:17, 127.0.0.1:55417), migrated with `node scripts/migrate.mjs`;
  - API built and started on port 3417 with every variable set explicitly;
  - a probe user `probe+throughput-<uuid>@example.invalid`, then 600 creates at concurrency 1, 4 and 8, 100 transfers, 50 dashboard reads, 50 account reads and 50 PATCHes, run twice;
  - teardown: the server process (by PID), then `docker rm -f -v scratch-seed-55b2b4`.
  - Re-checked by hand: `docker ps -a` lists the same 10 containers as before, there are 20 dangling volumes as before, and nothing listens on 3417 or 55417.
- **Code checks:**
  - `node --test src/features/planning/planningSections.test.ts` (in `mobile/`);
  - `npm run test -w @sora/mobile`, `npm run typecheck`, `npm run test -w @sora/contracts`;
  - `node scripts/check-contract-parity.mjs`, `npm run agents:check`.

## Findings

1. **The numbers did not hold** (gap 1). With the plan as written:
   - Vietcombank went negative in 1.7% of seeds at the reference anchor and 76% at 2027-03-15;
   - House Kitty went negative in 33% of seeds;
   - Japan Cash couldn't cover the ryokan in 60–68%;
   - Bills was over in Apr–Jun in 20%;
   - the Tet cluster reached 12M in about 61%;
   - Monthly Cap was over in its event months in 85%.

   The §7 item 5 states held in 300/300. The re-run of the baseline matched: vcb ≥ 0 98/100 and 23/100; kitty ≥ 0 64/100 and 69/100. FAIL, fixed.
2. **Final numbers** (Vietcombank 65M, the electricity split, Tet amounts, Japan ¥6–11k a day, Monthly Cap 27M, Y0 = A − 10 months, Mom Market 5.5M, Linh Groceries 3.5M, the Kitty float and rent, counts):
   - every hard check passes at 100/100 at 2026-10-06, except Monthly Cap over in event months at 99/100;
   - 99–100/100 at 2027-03-15;
   - `pickseed`: 26 of seeds 1–60 pass every non-descriptive check at both anchors, starting with SEED 1;
   - three claims can't reach 95% at any number and were reworded: Food "42–65%", Linh Everything near on average (67–70/100), and the 11.11 month under the cap.

   PASS.
3. **Plan statements the simulation corrected:**
   - "A yearly budget reads the calendar year" is wrong. `budgetWindow` steps 12 months from the start date (`calc.ts:320-329`), so Y0 = A − 10 months.
   - Coffee: a 60k cup is exactly 100%, not over.
   - The tightest earmark day is A − 5 months (+7.2M), not July.
   - Several story elements broke at other anchors: Wedding Season, "Shared House 2025", a missing Tet or 11.11 window, and the Tet table ending at 2027.

   All fixed (Next Tet budget, H0 extension rule, rename, Tet table to 2029).
4. **Throughput** (gap 8):
   - creates: 59–65 req/s sequential (p95 ≈ 21 ms), 180–240 at concurrency 4, 255–310 at 8;
   - 0 non-2xx; no deadlocks in either log;
   - balances re-derived in SQL matched the API's;
   - concurrent inserts reorder `created_at` by up to 4 positions.

   Plan now: ≈ 50 s sequential, ≈ 20 s with personas in parallel; no reliance on insertion order. PASS.
5. **`relationLabel` = the inviter's word** (gap 2):
   - the switcher shows the wallet's own name and the viewer's role, not the label (`WalletSwitcher.tsx:60`, `:77`, `:244`, `:264`);
   - SRS §6.2, SDS, the API spec §6 and §8.1, the domain design and the contract comments are aligned;
   - nothing in E2E or tests relied on the label as a wallet name (grep).

   PASS.
6. **App states** (gap 3):
   - Planning lists every budget, grouped Current/Upcoming/Ended, and every goal, grouped In progress/Completed/Cancelled;
   - an Overdue badge is derived from the wallet-zone today;
   - Cancel is offered only on active goals, matching the detail sheet's `canEdit`;
   - pure grouping in `planningSections.ts`: 7/7 tests;
   - SRS BUD-US-02 and SAV-US-03 criteria, TC-BUD-25 and TC-SAV-26, and the index counts (280/278) updated;
   - en/vi copy added.

   PASS.
7. **Reproducibility, zones, compromises, coverage, size** (gaps 4–7). In the plan:
   - every date is now a rule from A, there are no `COMPLETED` rows on A, and `--dry-run` computes every figure;
   - Bao is in `Australia/Melbourne` (AUD; DST on 2025-10-05, 2026-04-05 and 2026-10-04, checked with `Intl`) with verify item 9;
   - the Japan trip is under way at A, giving completed JPY expenses;
   - earmarks are defined against what goal progress means;
   - the yen purchase is documented as v1's model (BR-07);
   - phases 7–9 cover AI (`MockLlmProvider`), exchange rates (a stub in the provider's shape, FRESH then STALE, per `exchange-rate.service.ts:104-183`) and a guest `GuestData` fixture;
   - an offline-at-scale manual check;
   - three milestones.

   PASS (docs).
8. **Regressions:**
   - mobile 663/663, with the design-token gate inside;
   - typecheck clean in all three packages;
   - contracts 167/167; parity 65/65; agents in sync.

   PASS.

## Fixes Applied

Listed per finding above; each was re-verified by the command named there.

## Follow-ups

- Drive Planning (the groups and the Overdue badge) and the switcher on a device or emulator; only the pure grouping is unit-tested.
- The simulation scripts live in this session's scratchpad. Phase 3's `--dry-run` is meant to replace them. Port their checks into it rather than re-deriving them.
- `WalletResponse.relationLabel` is still returned, but the app no longer reads it. Whether to keep or drop it is a contract decision left open.
- The plan is still Draft and not implemented; milestones M1–M3 are in §10.
