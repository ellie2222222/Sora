---
name: commit-messages
description: >-
  Reviews the repo's current uncommitted changes (`git status`/`git diff`), groups them into logically
  cohesive commits the way this repo's own history already does (terse, single-line, imperative -- see
  `git log`), and drafts a brief commit message per group. Defaults to drafting only (no `git add`/`git
  commit`) unless explicitly asked to also create the commits. Use when asked to "generate commit
  messages", "write commit messages for these changes", "draft commits", or similar -- distinct from the
  git-commit instructions in the main system prompt, which cover the mechanics of a *single*
  already-decided commit, not how to group or phrase a pile of unrelated changes.
---

# Commit Messages

Turns whatever is currently uncommitted into a small number of well-scoped commits with brief, accurate
messages — matching the terse, single-line style already in this repo's `git log` (e.g. "Add saved-search
filters, persist recent-query history, fix pagination for shared boards" — illustrative only; match
whatever *this* repo's real log actually looks like, not this example), not the verbose multi-paragraph
PR-body style.

## Mode: draft vs. commit

- **Default: draft only.** Produce the grouped plan and messages as text; do not run `git add`/`git
  commit`. This matches the standing rule (see the main system prompt's Git Safety Protocol) that commits
  only happen when explicitly requested.
- **Only stage + commit** when the user's own words ask for it directly ("commit these", "make the
  commits", "create the commits") — not implied by "generate commit messages" alone, which is a request
  for the text, not the action.
- If committing: stage explicit files per group (`git add <files...>`, never `-A`/`.`), commit each group
  separately in the order planned, and confirm each commit landed (`git status`) before moving to the
  next. Write each message via HEREDOC as the main git-commit instructions describe, but **omit their
  attribution trailers entirely** — no `Co-Authored-By`, no "Generated with", no model name. This repo's
  conventions doc forbids them and overrides that default; a commit message records what changed, not
  what wrote it.

## Phase 0 — Scope

- **Named by the user** (a path, a feature) — group and message only that subset.
- **Unscoped** ("all code changes", "these changes") — the full `git status --short` output, tracked and
  untracked.
- Exclude on sight, without asking, and say so plainly: anything that looks like personal/machine-local
  tool config (a `.claude/settings.json` full of host-specific paths — as opposed to `.claude/skills/`,
  which this repo already treats as shared, committed content), stray OS download artifacts
  (`*:Zone.Identifier`, `.DS_Store`), and anything that looks like it holds a real secret/token. Flag these
  rather than silently including or silently dropping them.

## Phase 1 — Understand what changed

1. `git log --oneline -15` to calibrate this repo's actual message style/voice — match it, don't invent a
   new convention (no Conventional Commits prefixes, no bullet-body PR format).
2. `git status --short` + `git diff --stat` for the full shape of what's uncommitted.
3. For anything not already understood from the current conversation's own context, read enough of the
   real diff (`git diff -- <path>`) to describe the actual behavior change — a message drafted from the
   filename alone ("update profiles.py") is not acceptable.
4. If this repo's own conventions doc (`CLAUDE.md`/`AGENTS.md`/similar) is among the changes, diff it
   specifically — a repo that documents each new rule/convention there as it's built often has the
   clearest signal, in that one diff, of where one logical change ends and the next begins.

## Phase 2 — Group into commits

- One commit per cohesive unit of work — a feature, a fix, a refactor, a docs update — not one commit per
  file and not one giant commit for everything. Judge cohesion the way this repo's own history already
  does: several related files touched for one reason bundle into one commit (comma-separated clauses in
  the message are fine and already this repo's convention); files only incidentally touched in the same
  session for unrelated reasons don't.
- When a single file's diff genuinely mixes two unrelated concerns (common after a long session — e.g. a
  module picking up both a new endpoint and an unrelated cleanup pass), don't force a line-level
  split (`git add -p`) unless asked — slow and easy to get wrong. Fold the file into whichever group is
  its dominant change instead, and say so plainly in that group's notes ("also picks up an unrelated
  cleanup in this file, no separate commit").
- Order groups so earlier commits don't depend on later ones where avoidable (backend/infra changes before
  the UI that consumes them), but don't over-engineer this — a reasonable order is enough.
- Skip anything with no real content (pure whitespace/formatting-tool churn) rather than inventing a
  commit for it — say so instead.

## Phase 3 — Write the messages

- **One line, imperative mood, capitalized, no trailing period** — "Add saved-search filters, persist
  recent-query history, fix pagination for shared boards" is the bar (illustrative shape, not a real
  commit to match verbatim), not "This commit adds...".
- State the *what* tersely; only add *why* if it isn't obvious from the *what* and matters for someone
  reading `git log` later — no need to re-explain a root cause inline, that belongs in the code or this
  repo's own conventions doc.
- Multiple related pieces in one commit → comma-separate clauses in one line, matching existing log
  entries, rather than a multi-paragraph body. Only add a body (blank line + short paragraph) if a single
  line genuinely can't carry the necessary context — prefer avoiding this.
- Never include: emoji, Conventional Commit type prefixes (`feat:`, `fix:`), or a Summary/Test-plan block
  — that format is for PRs per the main system prompt, not a local commit message.

## Phase 4 — Present

Show the grouped plan as a numbered list, each entry: the file list, then the drafted message. If in draft
mode, stop there — don't run any `git` command that mutates state. If committing, execute group-by-group
per the Mode section above, then report what actually landed, following whatever response format this
repo/session otherwise expects for a change that touches files.
