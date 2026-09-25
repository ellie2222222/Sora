# Double-check: disk cleanup and the scratch-probe volume fix

**Date:** 2026-09-25T11:44:02Z
**Method:** double-check skill
**Verdict:** PASS
**Scope:** the cleanup pass that followed the E2E work. It covers:
- deleting Gradle output under `node_modules/*/android/{build,.cxx}`;
- removing 9 orphaned Docker volumes from today's scratch containers;
- the uncommitted edit to `.claude/skills/scratch-probe/SKILL.md`.

This is a small, docs-only change, so the Phase 1 sweep was skipped.
**Files touched:** `.claude/skills/scratch-probe/SKILL.md`
**Related reports:** `2026-09-25-e2e-and-follow-ups-double-check.md`. This pass closes its Gradle-output follow-up.

## Method

- `git status --short`, `git diff --stat`
- `find node_modules -maxdepth 4 -type d -path "*/android/*" \( -name build -o -name .cxx \) | wc -l`
- `docker volume ls -qf dangling=true`, with each volume's `docker volume inspect -f '{{.CreatedAt}}'` tallied by date
- `docker ps -a --format '{{.Names}}'`
- A live `-v` check:
  - record the dangling-volume baseline;
  - `docker create --name scratch-volcheck-cb20 -e POSTGRES_PASSWORD=x postgres:17`;
  - read its mount name;
  - `docker rm -f -v scratch-volcheck-cb20`;
  - `docker volume inspect <that volume>`, then compare the dangling list with the baseline.
- `awk 'length > 105'` on the skill file (line-wrap check)

## Findings

| Check | Evidence | Verdict |
|---|---|---|
| Gradle output removed | `find … \| wc -l` → `0` | PASS |
| Git tree untouched by the deletions | only `.claude/skills/scratch-probe/SKILL.md` modified | PASS |
| No dangling volume left from today's runs | 17 dangling, created 2026-08-02 through 2026-09-24; none dated 2026-09-25 | PASS |
| Containers unchanged | the 10 names match the pre-cleanup list (`sora-*`, `scraper_*`, `vigorous_pare`) | PASS |
| `docker rm -f -v` removes the postgres data volume | `volume removed`; the dangling list matches the baseline | PASS |
| The skill's teardown check can be answered | no: "no volume this run created" had no baseline, and 17 unrelated dangling volumes exist | FIXED |
| The skill's baseline matches its teardown | no: the constraint recorded `docker ps`, but teardown compared `docker ps -a` | FIXED |
| Line wrap | line 33 was 138 columns (the rest ≤ 100) | FIXED |

## Fixes Applied

- `.claude/skills/scratch-probe/SKILL.md:25-28`: the pre-run record is now `docker ps -a` plus `docker volume ls -qf dangling=true`.
- `.claude/skills/scratch-probe/SKILL.md:31-34`: rewrapped the `-v` rationale.
- `.claude/skills/scratch-probe/SKILL.md:69-71`: teardown re-runs both baseline listings, and each must match exactly.

Re-verified with the live `-v` check above, and `awk` now reports no lines over 105 columns.

## Follow-ups

- The skill edit is uncommitted; commit it through `commit-messages` when asked.
- The 17 older dangling volumes, created 2026-08-02 through 2026-09-24, are left alone: their origin is unverified, and some may belong to other projects.
- Carried forward from `2026-09-25-e2e-and-follow-ups-double-check.md`:
  - the CI `e2e` job has never run on GitHub;
  - the literal `/api/v1/health` in `ci.yml`;
  - `btn-logout` has no entity;
  - the `selectQueueEntryFor` intent;
  - the `migrate.mjs --reset` guard is untested;
  - the next E2E journeys.
