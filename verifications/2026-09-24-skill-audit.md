# Skill audit — the seven project skills, against the live repo and CLAUDE.md

**Date:** 2026-09-24T06:01:59Z
**Method:** skill-audit skill
**Verdict:** PASS
**Scope:** unscoped — every project skill; the vendored Front-End Checklist corpus (~390) was inventoried by count only (third-party, unchanged); user scope has `graphify/` and `synced/` (not editable here)
**Files touched:** `.claude/skills/commit-messages/SKILL.md`, `CLAUDE.md` (Project Skills table row, a blank-line fix)
**Related reports:** `2026-09-02-skill-audit.md` (follow-ups carried)

## Inventory

| Skill | Scope | Lines | Last commit | Trigger phrases |
|---|---|---|---|---|
| double-check | project | 168 | 2026-08-24 | double check, review, audit; before calling a change done |
| commit-messages | project | 95→99 | 2026-08-24 | generate/write commit messages, draft commits |
| comment-audit | project | 257 | 2026-08-24 | clean up/audit comments, strip commented-out code |
| restructure | project | 179 | 2026-08-24 | clean up project structure, reorganize, audit file layout |
| infra-audit | project | 165 | 2026-08-24 | audit infrastructure, find infrastructure improvements |
| brainstorm-features | project | 201 | 2026-09-03 | suggest features, brainstorm what to build next |
| skill-audit | project | 144 | 2026-08-24 | view/list/audit/improve the skills |

The Front-End Checklist corpus is vendored and third-party. The user-scope `graphify` and `synced` skills are outside this repo. Every project `name` matches its directory (a node frontmatter parse printed `ok` ×7).

## Method

```bash
# frontmatter: node regex parse, name === directory
# frozen paths: grep backticked paths out of each SKILL.md, then test -e each one
grep -nE "Co-Authored|trailer|git push|--no-verify|git add" .claude/skills/*/SKILL.md
grep -nE "the [0-9]+ (checks|items|...)|Git Safety|system prompt" .claude/skills/*/SKILL.md
```

## Findings

1. **Frozen paths (cat 1):** every "missing" path was a generic alternate (`CONTRIBUTING.md` in "CLAUDE.md, AGENTS.md, CONTRIBUTING.md…"), a placeholder (`old/path`), or the generic `SKILL.md`. No broken references. Verdict: clean.
2. **commit-messages — no push rule (cat 3/4):** CLAUDE.md Git says pushing needs a separate, explicit ask, but the skill never mentioned push. That is a missing step, and it runs against the doc. **Fixed.**
3. **commit-messages — dead reference (cat 7):** it cited "the main system prompt's Git Safety Protocol", and no such section exists in this harness's prompt. **Fixed:** now points at the conventions doc's Git section.
4. **commit-messages — no post-commit verify (cat 3):** the skill never checked the tree after committing. **Fixed:** check `git status` shows only deliberate exclusions, report via `git log --oneline`, and never `--no-verify`.
5. **Trigger overlap (cat 2/8):** every "distinct from" clause still names live skills and still describes them accurately. Verdict: clean.
6. **Count/dated claims (cat 10):** the only hit is skill-audit's own quoted counter-example. Verdict: clean.
7. **Carried 09-02 follow-up:** CLAUDE.md's `comment-audit` row described only the removal half of the skill. **Fixed:** the row now also says it adds a missing "why".

## Fixes Applied

- `.claude/skills/commit-messages/SKILL.md` (Mode section and Phase 4) covers findings 2–4. The skill was re-read top to bottom, and the frontmatter re-parsed: `ok`.
- The `CLAUDE.md` table row covers finding 7.
- These edits take effect from the next invocation, not this run.

## Follow-ups

- The `/verify` collision guard and the soft `double-check`/`code-review` overlap are carried unchanged from 09-02. There is still no observed misfire.
