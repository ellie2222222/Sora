# Debug-code sweep (clean-up-comments / Front-End Checklist rule): repo-wide, one stray dev script found

**Date:** 2026-09-12T16:54:06Z
**Method:** `clean-up-comments` skill (Front-End Checklist rule, `frontendchecklist.io/en/rules/html/clean-up-comments`) — its actual charter is narrower than "comment-audit": remove `console.log`/`debugger` statements, dev-only debug panels/routes, and stray debug scripts before production, distinct from the comment-*wording* sweep the comment-audit pass just did.
**Verdict:** PASS — repo-wide sweep clean except one finding, flagged not fixed (see below)
**Scope:** Whole repo, per the user's "full" request: `mobile/src`, `server/src`, `webpage/src` (the only tree with actual rendered HTML, per this rule's literal target — CLAUDE.md documents it as "parked" but it was checked anyway since it's genuine HTML output).
**Files touched:** none — the one finding is flagged, not auto-fixed (see rationale below).
**Related reports:** [2026-09-12-comment-audit.md](2026-09-12-comment-audit.md) (the comment-*wording* pass this
session, immediately prior — that pass already confirmed zero `TODO`/`FIXME`/`HACK`/`XXX` and zero
commented-out code repo-wide, so this pass did not re-run those checks; it covers what comment-audit's
comment-only charter excludes: actual debug **code**, not comment text),
[2026-09-12-infra-audit.md](2026-09-12-infra-audit.md) (first flagged the same stray script, Tier 1)

## Method

This skill's actual rule (read from `.claude/skills/clean-up-comments/references/rule.md`) targets
rendered HTML/production code for `console.log`/`console.table`/`debugger` statements, dev-only debug
panels or routes gated on nothing, stray `*.debug.js`-style files, and hardcoded dev credentials —
not comment *wording* (that's `comment-audit`, run immediately before this in the same session). Ran
direct greps rather than delegating, since the checks are mechanical pattern matches, not judgment
calls:

```
grep -rn "console\.(log|debug|table)|debugger" mobile/src server/src webpage/src --include=*.ts,*.tsx
grep -rniE "debug" mobile/src server/src webpage/src
grep -rn "TODO|FIXME|XXX|HACK|console.log|debugger" server/src
grep -rn "<!--" webpage/src                                    # literal HTML comments
grep -rniE "api[_-]?key\s*=|password\s*=\s*['\"]|secret\s*=\s*['\"]" mobile/src server/src webpage/src
```

## Findings

### Checked and clean

- **`console.log`/`console.table`/`debugger` statements** — zero in `mobile/src`, zero in
  `webpage/src`. One hit in `server/src`: `verify-boot.ts:46`'s own
  `console.log('verify app listening')` — this is the scratch harness's intentional CLI status
  message when run manually (`node server/dist/verify-boot.js`), never part of the actual served app,
  and the file itself is an already-tracked follow-up (delete pending explicit permission, per both
  infra-audit reports) rather than a fresh finding for this skill to act on.
- **Case-insensitive `debug` sweep** — zero hits anywhere in `mobile/src`, `server/src`, or
  `webpage/src` beyond the one file already accounted for above. No debug-only UI panels, no
  `debugMode` flags, no conditional debug blocks.
- **Dev-only routes** — no `/debug`-style route anywhere in `server/src`'s controllers.
- **Hardcoded credentials/API keys/passwords in source** — zero matches for inline `apiKey=`/
  `password=`/`secret=` literals across all three trees. Consistent with the 2026-09-03 infra-audit's
  LA-01 finding (no secrets logged) and this session's own check.
- **Literal HTML comments (`<!--`) in `webpage/src`** — none found.
- **Untracked `TODO`/`FIXME`/`DEBUG`-tagged comments** — already confirmed zero repo-wide by the
  immediately-preceding comment-audit pass; not re-run here.

### Flagged, not fixed

**`mobile/src/check_hardcoded.js`** — a 48-line, untracked, standalone Node script that walks
`./src`, regex-scans every `.tsx` file for hardcoded `title=`/`placeholder=`/`label=`/JSX-text
strings that should be going through i18n, and `console.log`s the results. This is precisely the
shape this rule targets: a development-only tool with a `console.log`-driven report, committed
alongside shipped source rather than kept outside `src/` or in `scripts/`. It has zero importers
anywhere in the tree (confirmed by this session's earlier infra-audit) and is never invoked by any
`npm` script — it can only be run manually via `node src/check_hardcoded.js`.

**Not deleted this pass.** It's untracked (no git history would be lost either way), but CLAUDE.md's
destructive-action rule requires explicit permission before removing something not named by the
user, and this file predates this session — it isn't scratch work of mine to clean up freely. The
infra-audit already listed it as a Tier-1 follow-up; recording it again here under this skill's own
rubric rather than silently deleting it.

## Fixes Applied

None. The one finding is flagged per above; everything else was already clean.

## Follow-ups

- Delete or relocate `mobile/src/check_hardcoded.js` (to `scripts/` if it's worth keeping as a
  reusable i18n-coverage check, otherwise remove outright) — carried forward from the infra-audit,
  now doubly confirmed by this skill's own sweep. Needs the user's go-ahead per CLAUDE.md's
  destructive-action rule.
- `server/src/verify-boot.ts` remains the one standing follow-up already tracked across three reports
  this session (infra-audit x2, comment-audit) — still not deleted, still needs explicit permission.
