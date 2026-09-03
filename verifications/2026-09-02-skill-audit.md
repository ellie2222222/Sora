# Skill audit — every skill in every scope

**Date:** 2026-09-02T03:27:50Z
**Method:** skill-audit skill
**Verdict:** PASS
**Scope:** Unscoped ("audit the skills") — every project skill under `.claude/skills/`, the one user-scope
skill visible to this session (`graphify`), and the bundled/built-in skills the session's own listing
names (checked only for name collisions, per the skill's own Phase 1 rule — they can't be read as files).
No plugin-scope skills present this session.
**Files touched:** `.claude/skills/brainstorm-features/SKILL.md`
**Related reports:** none (no prior skill-audit-flavored report exists in this directory)

## Method

Read `CLAUDE.md` fresh in full (755 lines) rather than from memory. Read all 7 project skill files
(`brainstorm-features`, `comment-audit`, `commit-messages`, `double-check`, `infra-audit`, `restructure`,
`skill-audit`) in full — `double-check`/`comment-audit`/`commit-messages` confirmed byte-identical to
the copies already in context via `diff` against `/home/app/scraper`'s copies of the same files (a
separate, unrelated repo that happens to share this skill set). Read `graphify`'s frontmatter and header
(user-scope, 677 lines — not deep-audited line-by-line since it isn't editable regardless of findings).
Got real `git log`-based last-modified dates per file (not filesystem mtimes, which were identical across
all 7 from a single checkout). Checked `verifications/` for a prior skill-audit report (none found) and
for a `.codegraph`-style report the phrase-overlap/cross-reference checks could reuse (n/a).

For every "distinct from X" clause and every named tool/path/directory, grepped or listed it against the
live repo/session rather than trusting the claim.

## Findings

### Inventory (Phase 1)

| Skill | Scope | Lines | Last modified | Trigger phrases claimed |
|---|---|---|---|---|
| `brainstorm-features` | project | 194→201 | 2026-08-24 | "suggest features based on what we've built", "brainstorm what we could build next", before roadmap/backlog grooming |
| `comment-audit` | project | 257 | 2026-08-24 | "clean up comments", "audit comments", "remove dead/redundant comments", "strip commented-out code" |
| `commit-messages` | project | 95 | 2026-08-24 | "generate commit messages", "write commit messages for these changes", "draft commits" |
| `double-check` | project | 168 | 2026-08-24 | "double check", "review", "audit" (this codebase), before calling any non-trivial change done |
| `infra-audit` | project | 165 | 2026-08-24 | "audit infrastructure", "find infrastructure improvements", quarterly cadence |
| `restructure` | project | 179 | 2026-08-24 | "clean up the project structure", "reorganize the codebase/folders", "audit the file layout" |
| `skill-audit` | project | 144 | 2026-08-24 | "view all skills", "list the skills", "audit/improve the skills", "check my skills", after a rename |
| `graphify` | user | 677 | 2026-06-29 | "any question about a codebase, its architecture, file relationships, or project content" |

Bundled/built-in named by this session's listing (checked for collisions only): `dataviz`,
`artifact-design`, `artifact-diagramming`, `update-config`, `keybindings-help`, `code-review`,
`simplify`, `fewer-permission-prompts`, `loop`, `claude-api`, `workflow-authoring`, `run`, `init`,
`security-review`, `design`, `artifact-capabilities`, `schedule`. No plugin-scope skills present.

Structural notes: every `SKILL.md`'s `name:` field matches its directory (verified via a YAML parse +
assertion, not eyeballing). No directory lacked a `SKILL.md`. No two skills claim an identical trigger
phrase with nothing distinguishing them — the five "audit"-triggered skills (`double-check`,
`comment-audit`, `restructure`, `infra-audit`, `skill-audit`) all name a distinct object (codebase /
comments / file layout / infrastructure / skills) in the same breath as "audit", which is itself the
disambiguator.

### Audit (Phase 2)

1. **`brainstorm-features` had no scope-handling step** (category 3-adjacent). Every sibling skill that
   can be invoked bare — `double-check`, `comment-audit`, `restructure`, `skill-audit` (explicit
   "Phase 0 — Scope"), `infra-audit` (an equivalent "Phase 1 — Scope Definition") — states what to do
   when the user names an area vs. invokes it unscoped. `brainstorm-features` jumped straight into
   "Phase 1 — Pattern Inventory" with no such branch, so a bare invocation had no stated default (whole
   repo) and a scoped one ("brainstorm features for the wallet-transfer flow") had nothing telling the
   inventory phase to confine itself. CONFIRMED — a real, if minor, inconsistency against its own
   sibling pattern, not a category-3 violation to the letter (the skill doesn't mutate anything), but
   the same class of ambiguity category 3 exists to catch.
2. **Frozen specifics (category 1):** none found. All 7 project skills are explicitly written
   layout-agnostic (each states this intent in its own header) and none names a concrete path/symbol
   belonging to today's code — the one repo-specific thing any of them names (`verifications/`-style
   report conventions, `git mv`, `EnterPlanMode`) is either a real tool confirmed present in this session
   or phrased as "whatever this repo's own convention is," discovered live rather than hardcoded.
3. **Cross-reference validity (category 8):** every "distinct from `X`" clause was checked against `X`'s
   actual current description — `comment-audit`→(`double-check`, `restructure`), `restructure`→
   (`double-check`, `infra-audit`), `infra-audit`→(`double-check`, `restructure`), `skill-audit`→
   (`double-check`, `restructure`). All four still hold; none has drifted since the last edit
   (all 7 files last touched in the same 2026-08-24 commit, so no time has passed for drift, but the
   text itself was re-checked rather than assumed current).
4. **`double-check`'s "distinct from a bundled `/verify`" claim:** this session's own available-skills
   listing does not name a skill called `verify` — but a slash command implemented at the CLI level
   (rather than as a discoverable "skill") wouldn't be expected to appear there either, and `CLAUDE.md`
   states this collision "has already caused the wrong one to run," i.e. it's an empirically observed
   problem, not a guess. Could not be confirmed or refuted mechanically from repo content alone.
   Flagged as a note, not a defect — no contradicting evidence found.
5. **Possible soft trigger overlap, `double-check` vs. the bundled `code-review`:** both could plausibly
   fire on a bare "review this." Considered as a category-2 candidate, but downgraded to a follow-up
   rather than a fix: `code-review`'s own description is explicitly diff/PR-scoped ("the current diff,
   or a PR number/branch/path target"), while `double-check`'s is explicitly whole-codebase-scoped
   ("review... this codebase") — a real, if implicit, distinction already exists in both descriptions'
   own object nouns, unlike the `/verify` case where `CLAUDE.md` records an actual observed misfire.
   Not fixed, to avoid manufacturing a disambiguation clause for a collision with no observed instance.
6. **Contradicts-conventions-doc (category 4):** none found. `commit-messages`' draft-only default,
   explicit-ask-to-commit, no-attribution-trailers rules all match `CLAUDE.md`'s Git section verbatim.
   `double-check`'s report convention matches the Verification Reports section. No skill instructs
   anything the Destructive Commands or Data Safety sections forbid (n/a here — no DB in this repo, but
   the equivalent `rm`/`git reset --hard`/force-push language is respected by `restructure`'s own
   constraints).
7. **No-observable-check prose (category 5), restated bloat (category 6), frontmatter defects
   (category 9):** none found across any of the 7. Consistent with the calibration note that a small,
   well-maintained set yields little here — not a sign of a shallow sweep.
8. **Harness-capability check (category 7):** `restructure` names `EnterPlanMode` — confirmed present in
   this session's deferred-tools list. `double-check`/`restructure`/others name `git`, discovered
   commands (`npm test`, etc.) rather than hardcoding a stack assumption — fine.
9. **`graphify` (user scope):** frontmatter parses, `name` matches directory, description carries a
   clear trigger clause. Not deep-audited beyond that (677 lines, not editable regardless of findings;
   proportionate effort per the skill's own scope guidance).

## Fixes Applied

1. `.claude/skills/brainstorm-features/SKILL.md` — added a `## Phase 0 — Scope` section (named-by-user
   vs. unscoped-whole-repo), placed immediately before `## How It Works`, matching the pattern already
   established by `double-check`/`comment-audit`/`restructure`/`skill-audit`. Re-verified: `git status`
   shows only this one file touched; frontmatter re-parsed as YAML with `name: brainstorm-features`
   matching its directory; re-read the whole file top to bottom to confirm the new section doesn't
   contradict "When to Use" or "How It Works" around it.

## Follow-ups

- The `/verify` bundled-skill collision `double-check` guards against (finding 4) can't be mechanically
  confirmed or refuted from this environment — noted, not acted on.
- The soft `double-check`/`code-review` trigger-overlap candidate (finding 5) was deliberately left
  unfixed — no observed misfire exists to justify a disambiguation clause the way `/verify`'s does.
- `CLAUDE.md`'s own one-line summary of `comment-audit` (Project Skills table) describes only the
  removal half of what the skill does, not the "also adds a missing why-comment" half the skill file
  itself leads with. Out of this skill's charter (it audits skill files, not `CLAUDE.md`'s summary of
  them) — mentioned here so a future `double-check`/docs pass can reconcile it if worth the words.
