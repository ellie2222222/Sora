---
name: comment-audit
description: >-
  Sweeps a repo (or a named scope within one) for comments that violate the "comments explain why, never
  what" principle -- restates-the-code comments, stale/wrong comments, commented-out dead code, untracked
  TODO/FIXME, task/PR-referencing comments that will rot, rotting magic-count claims, animation/visual
  narration prose -- and rewrites or deletes them; also adds a missing "why" comment where complex/non-
  obvious code has none, and flags (without auto-fixing) fragile cross-file comment references and
  verbatim-duplicated "why" prose for a human decision. Comment-only edits: never changes code logic. Use
  when asked to "clean up comments", "audit comments", "remove dead/redundant comments", "strip
  commented-out code", or similar -- distinct from `double-check` (broad codebase health, of which stale
  comments are only one item among many) and `restructure` (file layout, not content). Since a full sweep
  already reads every file once, it looks for excess and deficit in the same pass rather than requiring a
  second paid-for read.
---

# Comment Cleanup

A focused pass over comments only — never code logic. Every edit this skill makes must be provably
comment-only (see Phase 3): if a fix requires touching a non-comment line, that's out of scope for this
skill, not something to sneak in.

This cuts both ways: removing/fixing comments that shouldn't be there (Phase 1/2 below), and adding a
comment where complex or non-obvious code has none (see "What's missing" below). A full-repo sweep already
pays the cost of reading every file once — running only the removal half and leaving the addition half for
a hypothetical future sweep means paying that read cost twice for two halves of one job. Do both in the
same pass.

Every pattern below is illustrated with a made-up, generic example (`fooBar`/`some_module.py`-style) —
none of them assert that a specific file in any particular repo currently contains that exact text. The
job of this skill is to find the repo's own live instances of these patterns each time it runs, not to
check whether a frozen example from a past run still holds; a skill file that quoted real current comments
verbatim would itself go stale the moment those comments were cleaned up.

## First: does this repo document its own comment policy?

Check for a contributor-facing conventions doc at the repo root — `CLAUDE.md`, `AGENTS.md`,
`CONTRIBUTING.md`, or a project README section on code style — read fresh, every run, not from memory.
If it states a comment policy of its own, that's authoritative for this repo; apply it in place of (or
layered on top of) the generic patterns below, and note in the report which source governed each call.
If no such doc exists, apply the widely-held default this skill otherwise assumes: comments explain the
*why*, never the *what*.

## What counts as a violation

1. **Restates-the-code** — the comment says in words what the next line already says in code
   (`// increment counter` above `i++`, `# save the user` above `save_user(user)`). Delete outright.
2. **Commented-out dead code** — delete outright. Version control is the record; a commented-out block is
   never "kept just in case."
3. **Task/PR/caller-referencing comments that will rot** — "used by the X flow", "added for the Y
   feature", "handles the case from issue #123" (when #123 isn't a real, checkable link). These belong in
   a commit message/PR description, not the code, because they rot as the codebase evolves out from under
   them. Delete; don't relocate them into a docstring either.
4. **Stale/wrong comments** — describes behavior the code next to it no longer has (a common side effect
   of a refactor that touched the code but not its comment). Either fix it to match current behavior, or
   delete it if it was never more than restating-the-code to begin with.
5. **Untracked `TODO`/`FIXME`** — no concrete tracking reference (an issue link, a dated report/doc this
   repo already uses for that purpose). A bare `TODO` with no reference is worse than no comment — delete
   it, or if a real tracking reference exists elsewhere, attach it instead of deleting.
6. **Multi-paragraph comment blocks/docstrings that could be one line or nothing** — condense to the
   single non-obvious fact worth keeping; don't preserve prose padding around it.
7. **Rotting magic-count claims** — a comment citing a specific historical count of call sites/duplicates
   it replaced ("was hand-written in 8 places", "consolidates 13 near-identical call sites"). The count is
   unverifiable at a glance and guaranteed to drift the next time a caller is added or removed, with
   nothing to update it. The qualitative rationale is usually worth keeping; drop the specific number
   instead of deleting the whole comment ("was duplicated across call sites," not "in 8 places").
8. **Animation/visual narration** — a comment describing what a UI effect *looks like* in prose, instead
   of explaining a non-obvious constraint (e.g. `// Slides in from the left and settles` sitting directly
   above the transform/animation values it's just narrating in words) — a visual restates-the-code, not a
   why. Distinguish this from a neighboring comment explaining an actual constraint (e.g. why the value
   lives on this element rather than a parent, because a library would otherwise overwrite it) — that one
   stays. If the two are bundled in one comment block, split them rather than deleting the whole thing.

## What to leave alone

Don't touch a comment that explains something genuinely non-obvious from the code alone. Recognize these
shapes rather than specific past examples — the same category shows up in any codebase, just attached to
different code each time:

- A business constraint or external-system quirk (a rate limit, a pagination cap, an upstream API's
  documented-but-surprising behavior).
- Why a workaround/hack was chosen over the "correct" approach.
- A non-obvious side effect, perf risk, or ordering requirement (e.g. why a blocking call must be
  offloaded to a background thread, or why a value is read through a ref instead of a reactive dependency
  to avoid a specific bug that already happened once).
- An assumption the caller must uphold (non-null input, prior validation already done elsewhere; e.g. a
  callback prop's doc explaining the caller must also update its own local state because a cache
  invalidation alone won't cover it).
- A magic number/value that looks arbitrary or "wrong" without the comment (why a value is scoped
  per-instance instead of shared, to avoid two unrelated instances being treated as the same object by a
  library; a specific spacing/padding value explained by an overlapping element it would otherwise clip
  into; a floor value explained by a "must look visually distinct from zero" requirement).
- An explicit contract/limitation on what a hook/function can and can't tell its caller (e.g. "a closed
  connection with no terminal event is inconclusive, not failure — don't treat it as either").
- Documentation of a data-migration/backfill gap so old code paths don't look like dead code (e.g. "rows
  saved before this field existed simply lack it; the fallback below is not unreachable").
- A real external reference (a ticket/spec/prior-art link, a dated report/doc this repo already uses).
- License headers, shebang lines, `type: ignore`/`eslint-disable`/`noqa` directives (these are tooling
  directives, not prose comments, even though they use comment syntax).

When in doubt whether a comment counts as "explains why" or "restates what," lean toward keeping it — this
skill is a precision cut, not a blanket comment-stripping pass.

## What's missing — add a comment where one is owed

The mirror image of "what to leave alone": if code exhibits one of those same shapes (a business
constraint, a workaround, a non-obvious side effect/ordering requirement, a caller-must-uphold assumption,
an arbitrary-looking magic value, a documented gap/limitation) and carries **no** comment explaining it,
that's a gap worth closing, not just a violation worth removing. The bar is the same one used to decide
what to leave alone — just applied in the opposite direction. Recognize it by the same shapes:

- A conditional, early return, or special-case branch whose *reason* isn't inferable from the condition
  itself (e.g. `if retries > 2 and status == 429:` with no note on why 429 specifically gets special
  handling, or why the cutoff is 2 and not 1 or 3).
- A magic number/threshold/timeout with no visible justification (why *this* value, not a neighboring one).
- Code that looks like it could be simplified or deleted but can't be, for a reason that isn't visible
  locally (e.g. a seemingly-redundant null check that guards a real upstream data gap, an extra await/lock
  preventing a race that already happened once).
- A workaround for an external library/API/runtime quirk, where the "obvious" code would actually be wrong
  (the fix looks unmotivated without the quirk it's working around).
- A function whose control flow is dense enough (nested branches, multiple early exits, non-linear order)
  that a future reader would plausibly need to trace execution by hand to recover an invariant the author
  already knew.

Do **not** add a comment just because a function is long, or because it lacks any comment at all — plenty
of straightforward code (simple CRUD, a linear sequence of clearly-named calls, a plain data transform)
correctly has zero comments, and adding one would itself be a future violation of pattern 1. The test is
the same "would a competent reader be surprised or make a mistake without this" bar from "What to leave
alone," not "does this function have a comment yet."

**Never fabricate a rationale.** A comment describing a *why* you're inferring rather than one you can
verify is worse than no comment — it will read as authoritative and can be flatly wrong. Before writing
one:
- Check git history for the line/block (`git log -L` / `git blame`) — the commit message or an adjacent
  commit often states the actual reason.
- Check this repo's own dated reports/verification docs (see Phase 0) for a pass that touched this code and
  recorded why.
- Check sibling comments in the same file/module for an already-stated convention that just wasn't repeated
  here.
- If none of these surface a real answer, don't guess — flag it in the report as "complex, undocumented,
  reason not recoverable" instead of inventing one. That's a legitimate finding on its own (surfaces a
  place where institutional knowledge lives only in one person's head), not a failure to complete the task.

## Flag, don't auto-fix

Two patterns are genuinely good comments today but carry a structural rot risk this skill can't safely fix
by itself — a comment-only edit can't add the guardrail that would actually prevent the drift. Surface
these in the report as findings; don't silently rewrite or delete them.

- **Fragile cross-file/component references** — a comment justifies a choice by naming another file,
  component, or external artifact ("matching `X`'s pattern," "within the spec's ranges," steps numbered
  against a design brief that isn't in the repo). Before flagging, grep to confirm the referenced thing
  still exists and the claim still holds:
  - If the reference is provably broken (the named file/component was renamed or removed, or a numbered
    sequence no longer matches the code's actual order), that's a stale comment (pattern 4) — fix or
    delete it now.
  - If it still resolves, leave the comment as-is but note it in the report: nothing mechanically keeps it
    in sync, so a future rename/refactor of the thing it points at will silently orphan it.
- **Verbatim-duplicated "why" prose across files** — the same substantive explanation hand-copied into two
  or more places (e.g. an identical multi-line explanation of one external API's surprising quirk, copied
  near-verbatim into two unrelated components that each call it). Both copies are individually correct and
  worth keeping — don't delete either. Flag it as a finding: the comment itself has a DRY problem even
  though the code doesn't share an abstraction, and a real fix (extracting to one canonical location the
  others reference) is a code change, out of scope for this skill's comment-only edits.

## Non-negotiable constraints

- **Comment-only edits.** Never change a non-comment line as part of this skill's own fix — if fixing a
  stale comment properly would require a code change too, flag it as a separate finding for the user
  instead of making the code change here.
- **Never touch dependency/build-output directories** (`node_modules/`, `.next/`/`.output/`/`dist/`/
  `build/`, `__pycache__/`, `vendor/`), lockfiles, or any other generated/vendored tree — those aren't this
  repo's authored comments.
- **Don't delete a `TODO`/`FIXME` that has a real tracking reference** — only the untracked kind.
- If this repo documents safety rules around touching running services/data (check its conventions doc),
  follow them for anything this pass happens to exercise along the way — this skill is about comments, not
  an excuse to relax those.

## Phase 0 — Scope

- **Named by the user** (a file, directory, feature) — use that.
- **Unscoped** ("clean up comments", "sweep the repo") — the whole repo, minus the excluded trees above.
  Say so before starting so a wrong assumption is cheap to correct.
- Check whether this repo already keeps dated audit/report files somewhere (grep for a reports/audits
  directory, or a convention described in its conventions doc) and skim the most recent comment-audit-
  flavored one before starting — don't re-flag something a recent pass already deliberately kept (record
  the reason if so), and carry forward open follow-ups instead of rediscovering them.

## Phase 1 — Find violations (and gaps)

Delegate the search to a read-only exploration agent when the scope is large, so raw grep/read output
doesn't fill the main context — ask it to report `file:line — comment text — which violation pattern`
lines, not paste every file. Ask the same agent to also report missing-comment candidates in the same pass
(`file:line-range — what the code does — why a comment seems owed`, per "What's missing" above) — it's
already reading every file for violations, so surfacing gaps costs nothing extra and is why this phase
covers both. If this repo has a code-intelligence/graph index available, use it first — reading a symbol's
verbatim source through it surfaces its comments (or lack of them) for free, cheaper than a separate grep
pass.

For every candidate — violation or gap — verify against the live file yourself (grep/read it) before
deciding — a background agent's findings can go stale if other edits landed while it was running, and both
"is this comment actually redundant" and "does this code actually need a comment" often need the
surrounding function in view, not just the one line or range.

**Calibrate expectations before padding the report.** A codebase that already follows the "why not what"
principle closely will yield little from the blunt categories (1, 2, 5) — that's a real, common outcome,
not a sign the sweep was too shallow. In a disciplined codebase most of the real signal shows up in the
subtler categories (7, 8) and the two flag-only patterns, plus correctly recognizing good comments that
should stay untouched. Don't manufacture restates-the-code findings against solid "why" comments just to
have something to report — and the same restraint applies to gaps: a codebase full of simple, self-evident
code correctly yields few or no missing-comment findings, that's not under-coverage of the sweep.

## Phase 2 — Fix

- Delete restates-the-code comments, commented-out dead code, and untracked `TODO`/`FIXME` entirely —
  don't leave an empty comment marker or a blank line where a whole block used to be unless that matches
  the surrounding style.
- Rewrite stale comments to match current behavior only if there's a real "why" left worth keeping once
  corrected; otherwise delete.
- Condense multi-line blocks down to the single sentence carrying the non-obvious fact.
- For each verified missing-comment gap, add one concise comment stating the recovered *why* (from git
  history, a repo report, or a sibling convention — never invented, per "What's missing" above). Match the
  surrounding file's comment style/verbosity; a one-liner is almost always enough. If no real reason was
  recoverable, don't add a guessed one — leave the code as-is and report it as a finding instead.
- Batch by file — one edit pass per file rather than round-tripping per comment.

## Phase 3 — Verify comment-only

For every file touched, confirm the diff is comment-only:

- Diff the file and manually confirm every added/removed line is a comment, a comment's continuation, or
  a blank line left by removing a comment block — no removed/added code statement.
- If a language has a mechanical check available (e.g. a formatter/AST diff), prefer that over eyeballing;
  otherwise the manual line-by-line read is the check.
- Run whatever this repo's real post-change checks are for the languages touched — its own type-check/
  build command and test suite, discovered from its actual config (`package.json` scripts, a Makefile, CI
  config) rather than assumed. Comment-only changes should never break either, so a failure here means
  something was miscategorized as comment-only and needs to be re-examined, not pushed past.

## Phase 4 — Report

Every run ends with:

1. **A written record of what was found and fixed.** If this repo already has an established convention
   for recording audit/verification passes (a reports directory, a documented template in its own
   conventions doc), follow it exactly — same field names, same file-naming/dating pattern already in use.
   If no such convention exists, write a dated summary somewhere sensible (ask the user where, if it's not
   obvious) rather than inventing a new one silently. List each removed/rewritten comment (file:line, what
   it said, which violation pattern, what was done), and each added comment (file:line-range, what code it
   covers, the recovered why, and its source: git history, a report, or a sibling convention). Give the
   "Flag, don't auto-fix" items their own entries too, explicitly marked as not fixed (that's the correct
   outcome for that category, not a gap) — carry them forward as follow-ups so they're not lost if a later
   pass re-runs this skill. Do the same for any "complex, undocumented, reason not recoverable" gaps found
   but not filled — they're a legitimate finding, not an incomplete task.
2. **The chat summary** — following whatever response format this repo/session otherwise expects for a
   change that touches files: one bullet per file touched, not one bullet per comment (the written record
   from step 1 is the per-comment detail).
