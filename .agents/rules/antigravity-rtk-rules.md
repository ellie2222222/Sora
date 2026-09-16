# RTK - Rust Token Killer (Google Antigravity)

**Usage**: Token-optimized CLI proxy for shell commands.

## Rule

Always prefix shell commands with `rtk` to minimize token consumption.

Examples:

```bash
rtk git status
rtk cargo test
rtk ls src/
rtk grep "pattern" src/
rtk find "*.rs" .
rtk docker ps
rtk gh pr list
```

## Meta Commands

```bash
rtk gain              # Show token savings
rtk gain --history    # Command history with savings
rtk discover          # Find missed RTK opportunities
rtk proxy <cmd>       # Run raw (no filtering, for debugging)
```

## Why

RTK filters and compresses command output before it reaches the LLM context, cutting up to 90% of the bash output on common operations. Always use `rtk <cmd>` instead of raw commands.

## Repo conventions

This repo's own contributor rules live in `CLAUDE.md` at the repo root — read it fresh at the start of
each session, not from memory, since it gets amended as issues are found. It governs code/spec decisions,
git workflow (no direct `commit`/`push`, no AI-authorship trailers, draft-then-ask for actual commits),
destructive-command handling, and the precedence order of governing documents (the schema, `@sora/contracts`,
the API specification, then `SRS.md`/`SDS.md`). Follow it the same way this repo expects Claude Code to.

Verification/audit passes in this repo are recorded under `verifications/YYYY-MM-DD-short-slug.md` — check
recent ones there before re-auditing ground another pass already covered, and add one after any check you
run here, using the real system date.
