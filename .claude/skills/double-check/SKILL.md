---
name: double-check
description: >-
  Full double-check pass for this repo -- scope it, sweep for codebase health issues (dead code,
  duplication, inefficient data access, constant/util placement, cross-layer drift, design-pattern
  inconsistency), run pre-completion verification (typecheck/build, smoke tests, log checks), and end
  with a written report. Use whenever asked to double check, review, or audit this codebase, or before
  calling any non-trivial change done. Deliberately not named "verify" -- that collides with a bundled
  built-in skill of the same name that takes over the /verify command; invoke this one explicitly by name
  via the Skill tool, or by asking to double check, review, or audit. Hands off to `extract-modules` to
  carry out decomposition/duplication extractions its sweep flags, and to `scratch-probe` to exercise a
  changed server path against a disposable database.
---

# Double-Check

Check the repo root for a contributor-facing conventions doc — `CLAUDE.md`, `AGENTS.md`,
`CONTRIBUTING.md`, or a README section on code conventions — and **read it fresh, every time this skill
runs**, along with any actionable checklist it points to. Do not rely on memory of its contents from
earlier in the conversation or from this file: it gets amended as new issues are found, and this skill is
only correct if it's checking against the current rules, not a stale copy. If no such doc exists, this
skill still runs — Phase 1's checks are generic engineering-health checks that don't depend on one.

Never duplicate that doc's rule text into this file. If a check below turns out to need a new standing
rule (not just a one-off fix), add it to the repo's own conventions doc instead of growing this file. Every
example below is generic/illustrative — this file names no specific path, module, or identifier belonging
to any one project, because a skill that hardcodes today's file layout goes stale the moment that layout
changes; Phase 1 is written to *discover* the real equivalent in whatever repo it's run against.

## Non-negotiable constraints (apply throughout)

- **Don't fire real requests at rate-limited, paid, or otherwise consequential third-party/production APIs
  to test.** If the repo's conventions doc documents a safe way to exercise the same code path (mocking
  conventions, a synthetic-data seeding script, a sandbox environment), use that instead. Absent explicit
  documented guidance, treat any call that could rate-limit/charge/mutate a real external system as
  requiring the user's explicit, unambiguous go-ahead first.
- **Never accept or paste a real credential/token/cookie value** even if surfaced while grepping `.env` or
  logs — if one is visibly present, stop and flag it to the user rather than reading/using it.
- **Any synthetic data used to drive a real endpoint/datastore must be clearly isolated and cleaned up.**
  If a check needs to insert something to observe real behavior (not just read existing data), tag it with
  an obviously-fake identifier so it can't be confused with real records, confirm it doesn't collide with
  anything existing first, and delete it once the check is done — don't leave test artifacts behind.
- **Don't reach for browser automation (Playwright, raw DevTools Protocol, etc.) unprompted.** It's a lot
  of moving parts for what's often a quick check. Prefer describing what to click and asking the user to
  look, or a plain HTTP-level check of the same data path, before standing up a headless browser session.
  Only build one when the user asks for it or explicitly agrees it's the right call.

## Phase 0 — Determine scope

- **Named by the user** — a feature, file, or bug they mentioned. Use that; don't expand it to "the whole
  codebase" unless they said so.
- **"Double check"/"review"/"audit" with nothing else named** — the most recently discussed or built
  feature in this conversation. Say what you're taking the scope to be before starting, so a wrong guess
  is cheap to correct.
- **Explicitly "the whole codebase"** — genuinely run Phase 1 broadly; budget for it accordingly (it's the
  expensive path, not the default).

If this repo is a git repository, `git status`/`git diff` (against its default branch, if there's a clear
one) can help establish exactly what's new or changed since a given point — use that to ground the scope
when it's ambiguous. If it isn't a git repository, or git alone doesn't resolve the ambiguity, fall back to
scoping from the conversation as above.

Before starting, check whether this repo already keeps dated audit/verification reports somewhere (grep
for a reports/audits directory, or a convention its own conventions doc describes) and skim the most
recent one(s) touching the same area. Carry forward any open follow-ups from those into this pass rather
than re-discovering them, and link back to them from this pass's own report. Don't re-verify something a
recent, still-relevant report already confirmed clean unless the scope of this pass touches it again.

## Phase 1 — Codebase health sweep

Only run this phase when asked to double-check/review/audit broadly, or after a change large enough that
it plausibly left something behind (new abstraction, replaced an old code path, touched shared modules).
Skip it for small, scoped fixes — go straight to Phase 2.

Delegate the search itself to a read-only exploration agent (or a general-purpose agent for deeper
reasoning) so the main context isn't spent on raw grep output — ask it to report file:line findings, not
paste full files. Look for:

1. **Dead code** — functions, exports, modules, or files with zero external references (grep before
   deleting; a CLI-only/demo-only usage still counts as live).
2. **Duplicated logic** — near-identical blocks across files that should be one shared helper/component.
   Check this repo's own established shared-code locations first (a `utils`/`lib`/`shared` directory, a
   data-access layer) — identify where *this* repo actually consolidates that way by looking at how
   existing similar functionality is organized, don't assume a name or path from any other project.
3. **Inefficient data access** — sequential round-trips that could be one join/aggregation, N+1 queries,
   a hand-rolled join duplicating an existing query-composition helper this repo already has. Match
   whatever pattern this repo has already established for combining related data in one query, if it has
   one.
4. **Drifted config/docs** — a second copy of a dependency manifest, a README command that references a
   deleted file or renamed script, a doc describing a module/directory structure that no longer matches
   reality.
5. **Rule violations already documented in this repo's own conventions doc** — if it keeps a running list
   of past bugs/lessons-learned, re-run that list as a checklist against the change; each entry there
   exists because it was reintroduced or hit once already.
6. **Constants/enums scattered instead of centralized** — a literal (a status code, a filter value, a
   user-facing string) hardcoded inline instead of pulled from this repo's own shared constants/messages
   module, if it has one. Locate it live via grep — don't assume a name or path. New constants belong
   grouped with their existing category, not declared locally in the file that first needed them.
7. **Utils not reused or misplaced** — a formatting/parsing/URL-building helper reimplemented locally
   instead of an existing shared utility this repo already has for the same purpose. A genuinely new
   cross-component util belongs in the repo's established shared-utility location, not inlined in the
   file that first needed it — check whether a second consumer already exists or is imminent.
8. **Components/modules not decomposed / doing too much** — a route/controller file or top-level module
   holding data-fetching, presentation/response-shaping, *and* multiple concerns inline instead of
   delegating to smaller, purpose-scoped pieces. Match whatever split this repo has already established
   for that layer (if any) — a component mixing "feature-specific" and "cross-feature-primitive" concerns
   is a signal it should split between the two.
9. **Shared components/primitives not reused** — a new implementation of a pattern (a list-with-detail
   view, a fallback-aware avatar/image, a result/error banner) built from scratch instead of reaching for
   an existing shared version of the same thing, if this repo already has one. If two features now share a
   pattern that isn't yet extracted, that's a finding even if neither copy is "wrong" on its own.
10. **Cross-layer/cross-stack drift** — a client-side type/schema that's supposed to mirror a server-side
    contract (API client types, a generated SDK, a validation schema) but doesn't match what the server
    actually returns/expects (check the real response, don't assume); an enum or status code whose values
    differ between two representations of "the same thing" in different layers or languages — same value,
    same meaning, everywhere it's represented.
11. **Design-pattern inconsistency across features** — one feature's read pipeline, error handling, or
    component/module structure diverging from the pattern already established for an equivalent feature
    elsewhere in the same repo (e.g. a new list feature not using the shared grid-with-detail component an
    existing, equivalent feature already uses). New code should look like it was written by the same
    person as the code next to it — flag the feature that's the odd one out, not necessarily the newer one.

For every finding, verify it against the live repo (grep it yourself) before fixing — a background agent's
findings can go stale if other changes landed while it was running.

## Phase 2 — Pre-completion verification

Run every item below that applies to what changed, using this repo's *actual* commands — discover them
from its `package.json`/`Makefile`/CI config/README rather than assuming a stack:

- **Typecheck/build**: run the real command for whatever's changed. If a known, pre-existing, unrelated
  failure is already documented somewhere in the repo, that's the only acceptable exception — anything
  else surfacing is a regression.
- **If a backend/service module changed**: rebuild/restart it per this repo's own dev-loop convention
  (discover the actual command — a compose file, a process manager, a documented dev script) and check its
  logs for import errors/tracebacks. Prefer the fullest/least-summarized log view available; a truncated or
  auto-summarized log view can hide the actual error.
- **Exercise every changed/new read path against real, non-empty data** — synthetic seed data is fine, an
  empty dataset is not (serialization bugs around ID types, joins, or optional fields often only surface
  with actual records present).
- **If a dependency was added, confirm it actually landed** in the running environment, not just declared
  in a manifest — a stale cached install can mask a "not found" error indefinitely.
- **Sweep for dangling references to anything this pass deleted or renamed** — an import of a removed
  module, a doc link to a removed file, a config entry pointing at something that no longer exists. If this
  repo documents a style rule this pass could plausibly violate (an icon-library-only rule, a naming
  convention), sweep for violations of that too.

## Phase 3 — Report

Every run ends with two things, in this order:

1. **A written record.** If this repo already has an established convention for recording audit/
   verification passes (a reports directory, a template described in its own conventions doc), follow it
   exactly — same field names, same file-naming/dating pattern already in use, dated correctly (get the
   real date from the system, never guess it). If no such convention exists, write a dated summary
   somewhere sensible (ask the user where, if it's not obvious) rather than inventing a new one silently.
   Do this even when nothing needed fixing — a clean report is still evidence the pass ran, and lets a
   later session skip re-checking the same ground.
2. **The chat summary.** Short, not prose — one line per thing checked:

   ```
   - [x] Typecheck clean (no unexpected errors)
   - [x] Backend rebuilt, no errors in logs
   - [x] Changed read endpoints verified against real data — 200
   - [ ] Found: one module duplicates a query-composition helper instead of reusing the shared one — fixed
   Full report: <path to the written record>
   ```

   Don't manufacture findings to justify having run the sweep — "nothing needed fixing" is a fine, and
   common, outcome.
