# Double-check: coverage follow-ups, NC-04 test ids, Maestro E2E suite and CI job

**Date:** 2026-09-25T11:20:21Z
**Method:** double-check skill
**Verdict:** PASS. The CI `e2e` job itself is BLOCKED until it runs on GitHub.
**Scope:** this round's uncommitted work:
- the money, date, sync and invitation fixes;
- the NC-04 test-id renames;
- the extraction of `server/test/support/probe-data.ts`;
- the `mobile/e2e/` suite and `mobile/app.config.js`;
- the Metro block list;
- the CI `e2e` job;
- the docs (API spec, CLAUDE.md, README, AGENTS.md, plans).

**Files touched:** listed under Fixes Applied, plus the files named in Scope.
**Related reports:** `2026-09-25-test-coverage-audit.md` (its follow-ups are carried forward below)

## Method

- A read-only sweep agent looked for:
  - dangling references to `scaledToDisplayNumber`, the `SheetFormHeader` `testID` prop, 22 renamed test ids and the re-exports in `integration.ts`;
  - duplication in the e2e scripts and in `roundToDecimals`;
  - doc drift (CLAUDE.md, README.md, AGENTS.md);
  - comment-rule violations;
  - NC-04 conformance.
- `npm run typecheck`; `npm run test -w @sora/contracts`; `node scripts/check-contract-parity.mjs`; mobile `npm run test`.
- Server suite against scratch Postgres (`scratch_itest_9d24`): `node --import ./dist/test/setup.js --test dist/test/*.test.js`.
- A live E2E run:
  - scratch Postgres `scratch-e2e-b6e0` (postgres:17, 127.0.0.1:55439), migrated;
  - API `node dist/src/main.js` on port 3417;
  - `E2E_API_URL=http://127.0.0.1:3417 node mobile/e2e/seed.mts`;
  - `SORA_E2E_BUILD=1 npx expo prebuild --platform android --clean`;
  - `./gradlew assembleRelease -PreactNativeArchitectures=x86_64`;
  - `adb reverse tcp:3417 tcp:3417` on emulator `Medium_Phone`;
  - `maestro test mobile/e2e -e E2E_API_BASE=… --format junit`.
- A check that the pull-to-refresh pass depends on the swipe: a temporary copy of the flow without it, run once and then deleted.
- `npx expo export --platform android` with the new Metro config.
- Checks on the CI file and flows: the YAML parses (`js-yaml`), and `maestro check-syntax` passes on every flow.

## Findings

| Check | Evidence | Verdict |
|---|---|---|
| Typecheck, all packages | `npm run typecheck`: no errors | PASS |
| Contracts | 114/114; parity 31/31 | PASS |
| Mobile unit tests | 528/528, 0 todo | PASS |
| Server tests on a real DB, after the probe-data move | 74/74 (all 6 integration suites included) | PASS |
| Dangling references | none outside dated `verifications/`; all 5 `SheetFormHeader` callers pass `entity`; the re-exports resolve | PASS |
| E2E suite | `3/3 Flows Passed in 3m 15s`; JUnit `tests="3" failures="0"` (run twice, the second after the script refactor) | PASS |
| UI write reached the server | psql: `25000.0000 \| 2026-08-15 … \| EXPENSE \| COMPLETED \| E2E sheet expense` | PASS |
| Pull-to-refresh pass depends on the swipe | the copy without the swipe fails at `Assert that "${output.description}" is visible` | PASS |
| API during E2E | 67 requests, 0 with a 4xx or 5xx status | PASS |
| x86_64-only build | `BUILD SUCCESSFUL in 8m 24s`, 44.7 MB (all ABIs: 32m 2s, 119 MB) | PASS |
| Bundle with the new block list | `expo export --platform android`: Exported | PASS |
| CI `e2e` job | the YAML parses (5 jobs); it has never run on GitHub | BLOCKED |

## Fixes Applied

| Finding | Fix | Re-verified by |
|---|---|---|
| Login block and `/api/v1` copied into both Maestro scripts | New `mobile/e2e/scripts/api-login.js` sets `output.apiToken`. The seed writes `E2E_API_BASE` from `API_PREFIX`, and the scripts, flows, CI and README use it | E2E 3/3 |
| Doc drift: the CLAUDE.md structure tree, CI line and CI paragraph, `server/test` note, `plans/` list and Dev Commands; the README layout, CI line and "no emulator in CI"; the AGENTS.md layout | All updated to cover `mobile/e2e/`, `app.config.js`, the `e2e` job and the integration tests | reread |
| Comment-rule slips: a what-comment in `add-transaction.yaml`; overlong headers in `seed.mts`, `probe-data.ts` and the `roundToDecimals` docblock; before/after narration in `money.ts` | Deleted or condensed to 1–2 lines of why | mobile tsc, tests |
| NC-04: the invite-form opener was `btn-add-member`; the `Fab` default was `fab-add-transaction`; the table had no row for segmented choices | Now `btn-add-invitation` and `btn-add-transaction`; added a `btn-[entity]-[field]-[value]` row, which `btn-category-type-EXPENSE` already used | sweep grep, tsc |
| User report: the Metro dev server ran out of its 4 GB heap after about 100 minutes | Gradle had written 31,008 files into `node_modules/*/android/{build,.cxx}`, all inside Metro's workspace watch root. `metro.config.js` now blocks `android/{build,.cxx,.gradle}` and `android/app/{build,.cxx}`; source paths are still kept | block-list path test; `expo export` |
| The emulator died twice during Gradle builds (3.6 GB of 31 GB RAM free) | Runs are now sequential: build first, then boot the emulator | E2E 3/3 |

Environment changes (outside the repo, requested by the user):
- Temurin JDK 17.0.20.1 installed through winget, and the stale user `JAVA_HOME` repointed to it;
- Maestro 2.10.0 installed by the user at `D:\maestro`.

Teardown:
- the API processes (PIDs 27300 and 13792, both `node dist/src/main.js`) were confirmed and then stopped;
- `scratch-e2e-8f21`, `scratch-e2e-b6e0`, `scratch-itest-9d24` and `scratch-e2eseed-3c7d` were removed by exact name;
- `docker ps -a` matches the pre-run list, and ports 3417, 55436–55439 are closed;
- `adb reverse` was removed and the emulator shut down;
- the Gradle and Kotlin daemons were stopped;
- `mobile/android/` was restored from its pre-E2E backup (`diff -rq` shows it identical, with no cleartext).

## Follow-ups

- The CI `e2e` job has never run on GitHub. The first push or PR is its real test. KVM, the emulator runner and the Maestro install are unverified there.
- Gradle output remains under `node_modules/*/android/{build,.cxx}` (31,008 files, regenerable). Metro now ignores it; delete it only if disk space matters.
- The CI health check in `ci.yml` still spells out `/api/v1/health`, because it runs before the seed that emits `E2E_API_BASE`.
- `btn-logout` has no entity. It's left as is: the table has no row that fits a session action.
- Carried forward from `2026-09-25-test-coverage-audit.md`:
  - the `selectQueueEntryFor` intent;
  - the `migrate.mjs --reset` guard is untested;
  - the next E2E journeys (offline → online, deep links, wallet and member flows, Vietnamese).
