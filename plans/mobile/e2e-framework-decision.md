# E2E framework: Maestro vs Detox

**Date:** 2026-09-25
**Status:** Accepted 2026-09-25
**Decision:** Maestro, scored 61.5% vs 38.5% for this repository
**Context:** `verifications/2026-09-25-test-coverage-audit.md` — gestures, sheets, navigation and
the critical journeys have no automated coverage because the repo has no E2E framework.

## What is being chosen for

- Expo 57 / React Native 0.86. `mobile/android/` is gitignored and regenerated on prebuild.
- Every existing suite runs on `node --test`. There is no Jest.
- Offline-first: the queue, session restore and sync are the core behaviour.
- The UI has Reanimated animations, gesture-handler pull-to-refresh, skeleton loaders and sync
  timers. Streamed AI replies are likely later.
- CI is GitHub Actions, not EAS.
- The target suite is 15–30 outside-in user journeys. Business rules stay in the contracts, unit
  and real-database integration tests.

## Method

- Each criterion is weighted 1–5 for this repository.
- The winner of a criterion gets its full weight; a tie gives half the weight to each tool.
- Each dimension's raw score is normalized to its share of the decision.
- Criteria that cannot separate the tools are left out of the score: speed per step, cost and
  licence, iOS (both need macOS), and real devices.
- Future AI features are also left out as a separate criterion. They are counted once, under
  long-running async UI.

## Matrix

### A. Maintenance and platform fit — 25%

| Criterion | W | Maestro | Detox | Why |
|---|---|---|---|---|
| Upkeep through Expo/React Native upgrades | 5 | ✅ | | Maestro sits outside the app's native build. Detox adds native test and build configuration that upgrades can affect |
| Fits the existing test setup | 4 | ✅ | | Detox requires Jest as its runner; the repo runs `node --test` |
| Initial setup | 3 | ✅ | | Maestro is one CLI. Detox needs Jest, `@config-plugins/detox`, a test APK and `.detoxrc` |
| CI upkeep (GitHub Actions) | 3 | ✅ | | Both need an emulator. Detox also needs its test build and Jest config |
| Expo first-party integration | 2 | ✅ | | Expo documents Maestro E2E and has a Maestro EAS Workflows job. That job is alpha, and this repo does not run CI on EAS |
| Runs against a production-like build | 2 | ✅ | | Maestro can drive the same kind of build used for release validation. Detox needs its own test build configuration |

- Raw score: Maestro 19, Detox 0, out of 19.
- Normalized: Maestro 25.00%, Detox 0.00%.

### B. Reliability for this app — 35%

| Criterion | W | Maestro | Detox | Why |
|---|---|---|---|---|
| Long-running async UI (animations, streaming, sync timers) | 5 | ✅ | | Maestro tests from outside the app, so it doesn't rely on Detox's app-idle synchronization |
| Real offline mode | 5 | ✅ | | Built-in device and network control, versus an `adb` helper (`svc wifi/data disable`) that must be written and maintained |
| Kill, relaunch, background | 4 | tie | tie | Both can do it. Neither can kill the app at an exact point mid-request |
| Clean state between tests | 3 | tie | tie | Maestro `clearState`; Detox `launchApp({ delete: true })` |
| Failure diagnostics | 3 | tie | tie | Both capture screenshots, video, logs and the view hierarchy |
| System dialogs | 2 | ✅ | | Maestro can interact with OS dialogs; Detox pre-grants permissions |
| Deep links | 2 | tie | tie | Maestro `openLink`; Detox `device.openURL` |

- Raw score: Maestro 18, Detox 6, out of 24.
- Normalized: Maestro 26.25%, Detox 8.75%.

### C. Test-suite scalability — 30%

| Criterion | W | Maestro | Detox | Why |
|---|---|---|---|---|
| Reusable helpers | 4 | | ✅ | TypeScript screen helpers and fixtures |
| Test-id safety when renaming | 3 | | ✅ | Typed test-id constants fail at compile time |
| Complex test logic | 3 | | ✅ | Real code, not YAML control flow |
| Test data setup | 2 | | ✅ | Can import the server's `registerProbeUser`/`createAccount` directly |
| Swapping app code during tests | 2 | | ✅ | `*.e2e.ts` files load in place of the real module |
| Precise assertions | 2 | | ✅ | Checks text, value and toggle state |
| Track record with React Native | 2 | | ✅ | Built for React Native |
| Running tests in parallel | 2 | tie | tie | Maestro sharding; Jest workers across emulators |
| Reversibility and lock-in | 2 | tie | tie | Test ids, the seed script and a fake AI endpoint serve either tool |

- Raw score: Maestro 2, Detox 20, out of 22.
- Normalized: Maestro 2.73%, Detox 27.27%.

### D. Team ergonomics — 10%

| Criterion | W | Maestro | Detox | Why |
|---|---|---|---|---|
| Easy to write and read | 2 | ✅ | | Readable flows, no framework to learn |
| Debugging | 2 | tie | tie | Maestro Studio and `maestro hierarchy`, versus a JS debugger and Jest output |
| Targets what the user can see | 1 | ✅ | | Tests aim at visible, accessible elements rather than component internals |
| Testing both languages (en/vi) | 1 | tie | tie | Neither is better |

- Raw score: Maestro 4.5, Detox 1.5, out of 6.
- Normalized: Maestro 7.50%, Detox 2.50%.

## Result

| Dimension | Weight | Maestro | Detox |
|---|---|---|---|
| A. Maintenance and platform fit | 25% | 25.00% | 0.00% |
| B. Reliability for this app | 35% | 26.25% | 8.75% |
| C. Test-suite scalability | 30% | 2.73% | 27.27% |
| D. Team ergonomics | 10% | 7.50% | 2.50% |
| **Total** | 100% | **61.5%** | **38.5%** |

**Cross-check:** flat weights with ties split, no dimensions, give 61.3% vs 38.7%.

**Sensitivity:** Detox's lead is almost entirely in scalability. With A, B and D kept at their
25:35:10 ratio, Detox wins only once scalability is at least ~46% of the decision (30% is used
here).

## Conclusion

Maestro scores higher because the heaviest criteria match this app's actual risks:
- Expo/React Native upkeep;
- offline-first behaviour;
- long-running async UI;
- CI with little extra setup.

Detox's advantages are real but matter less for the current gap:
- reusable TypeScript helpers;
- complex test logic;
- precise assertions;
- swapping app code during tests.

This is a decision for this repository, not a claim that Maestro is the better E2E framework in
general.

**Caveat:** Expo's Maestro EAS integration (alpha) is separate from this repository's GitHub
Actions CI and is not needed for this decision. Maestro runs directly in the existing CI against
the project's Android build.

## Scope

The first Maestro coverage includes:
- navigation between the major screens;
- bottom-sheet interactions;
- swipes and other gestures;
- pull-to-refresh;
- going offline and back online;
- killing and relaunching the app, and session restore;
- deep links;
- system permission dialogs, where applicable;
- the critical transaction and wallet flows;
- English and Vietnamese, for flows where behaviour differs.

## Decision boundary

Choose Maestro while the E2E suite stays mostly outside-in testing of user-facing flows.

Re-evaluate Detox if E2E tests increasingly require any of:
- substantial programmatic control flow;
- reusable TypeScript test infrastructure;
- direct manipulation or replacement of application code, e.g. on-device AI;
- deep application-level assertions;
- extensive test-data setup inside the test process;
- a suite large enough that YAML duplication becomes a measurable maintenance problem.

Revisit based on observed maintenance cost, not on a set number of tests.

## Next steps

1. ✅ Test ids renamed to the NC-04 patterns (31 files). NC-04 gained rows for sheet Cancel, picker
   options and calculator keypads. Screen roots were added for login, register, home, transactions and planning.
2. ✅ `mobile/e2e/seed.mts` creates a probe user, an account and an expense through a running API,
   using `server/test/support/probe-data.ts` (shared with the integration harness). It needs
   `E2E_API_URL` and has no default.
3. ✅ First journeys in `mobile/e2e/flows/`:
   - session restore after a relaunch;
   - adding an expense through the sheet with the keypad and date picker, checked through the API;
   - pull-to-refresh (a copy without the swipe fails).

   Passed 3/3 locally on the `Medium_Phone` emulator against a scratch API.
4. ✅ `e2e` job in `.github/workflows/ci.yml`: Postgres service, API, seed, E2E APK
   (`SORA_E2E_BUILD=1`, x86_64 only), emulator, `maestro test mobile/e2e`. Failure artifacts are
   uploaded. It has not run on GitHub yet.
5. Next journeys from Scope: offline → online, deep links (invitation accept), the wallet and member flows,
   and a Vietnamese-locale pass.
