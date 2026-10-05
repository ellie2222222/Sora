# Workflow, Git, and Reporting Guidelines

## Spec-Driven Development

Confirm behavior is specified before writing code. If a task conflicts with the specification:
- Amend the specification in the same change. Code does not lead; specs do.
- A change that silently diverges from [`docs/API_SPECIFICATION.md`](../../docs/API_SPECIFICATION.md) or [`packages/contracts/`](../../packages/contracts/) is considered a defect.

## Facts vs. Assumptions

Every assertion made about this codebase is either:
- **Fact**: Verified by reading actual code, running a command, or reading live output.
- **Assumption**: An inference or pattern expected from elsewhere.
Explicitly label inferences as assumptions ("assuming X because Y, worth confirming") instead of stating them as established facts. Never invent a business rule, data shape, or API behavior.

## Impact Analysis Before Changes

Before modifying anything beyond a leaf-level, single-consumer function:
- Find every real caller across both `server/` and `mobile/` packages (use grep, never memory).
- Check contract alignment via `node scripts/check-contract-parity.mjs`.

## Git Protocol & Safety

### No Direct Commits or Pushes
- **Never run `git commit` or `git push` directly.**
- All commits must go through the **`commit-messages`** skill, which inspects the working tree, groups changes logically, and drafts terse, single-line imperative messages.
- The skill **drafts only**. Creating commits or pushing requires explicit separate instructions from the user.
- **Do not `git add` in advance.** Leave the working tree clean of staging so the skill can inspect the full unstaged diff accurately.

### Strict Ban on AI-Authorship Lines
- **Zero AI-authorship lines or trailers anywhere.**
- Do not include `Co-Authored-By: Claude...`, `Co-Authored-By: Antigravity...`, `Generated with...`, or any AI model names in commit messages, PR titles, PR bodies, code comments, or documentation.
- Commit messages state what changed and why — nothing about what tool generated it.

### Destructive Commands
- **Never run commands that delete, overwrite, wipe, or discard state without explicit user permission.**
- Prohibited without explicit, immediate prior approval:
  - `rm`, `rm -rf`
  - `git reset --hard`, `git clean`
  - `git push --force`
  - `git checkout` or `git restore` that discards uncommitted work
  - `git branch -D`
  - Overwriting unbacked files or dropping/truncating/resetting databases.
- Prior approval for a destructive action does not carry over to subsequent actions. When in doubt, ask first.

## Communication & Terseness

- Cut unnecessary prose. Lead with results.
- No preamble, no repeating the prompt, and no recap of successful intermediate steps.
- Explain reasoning only when it cannot be inferred from the diff or comments.

## Mandatory Response Summary Format

Any response that modifies, adds, or deletes files **must** conclude with the structured summary format below:

```markdown
## Summary

**Changed**
- [path/to/file.ext:LINE](path/to/file.ext#LLINE) — what changed and why

**Added**
- [path/to/new_file.ext](path/to/new_file.ext) — purpose of the file

**Removed**
- `path/to/deleted_file.ext` — why it was safe to delete

**Verified**
- the actual command run and its result (or "not run — <reason>")

**Follow-ups** (omit section if none)
- items noted but deliberately deferred
```

- Each entry must be one single line.
- Every **Changed** and **Added** file must be a clickable markdown link, path relative to the repo root.
- **Removed** files remain plain backticks.
- Omit **Added**, **Removed**, or **Follow-ups** if empty (do not write "None").
- Never claim verification that did not actually run.

## Verification Reports

Every verification pass, audit, or review must be recorded under `verifications/YYYY-MM-DD-short-slug.md`:
- Check existing reports first (`ls -t verifications/ | head`) to avoid duplicate work.
- Use current real date via system clock.
- Allowed verdicts: `PASS`, `FAIL`, `BLOCKED`, `SKIP`.
- Keep the report evidence-oriented: exact command run, observed output, and explicit verdict.
