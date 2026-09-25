# Root `dev:mobile:clear` script and its doc entries

**Date:** 2026-09-24T08:15:51Z
**Method:** double-check skill
**Verdict:** PASS
**Scope:** the new root script plus its doc lines. It's a small change, so Phase 1 (the broad code sweep) was skipped.
**Files touched:** `AGENTS.md` (the gap found below)
**Related reports:** `2026-09-24-i18n-audit.md`. The script exists for the stale-bundle i18n warnings seen after that audit.

## Method

- `git diff -- package.json CLAUDE.md README.md`
- `npm pkg get scripts.dev:mobile:clear` and `npm pkg get scripts.clear -w @sora/mobile`
- `node -e "JSON.parse(...package.json...)"`
- A search for `dev:mobile` in `*.md`, `*.json` and `*.yml`, excluding `node_modules` and `verifications/`.

## Findings

1. **Script:** `dev:mobile:clear` → `npm run clear --workspace @sora/mobile`.
   - That resolves to `expo start --go --tunnel --clear`: the same flags as `dev:mobile` (`start` = `expo start --go --tunnel`) plus `--clear`.
   - `package.json` parses. PASS.
2. **Diff:** `package.json` gains 1 script. The only other change is the comma added to the line before it. PASS.
3. **Docs:** CLAUDE.md:369 and README.md:152 list the script. AGENTS.md:111 lists `dev:mobile` but didn't list the new script. FIXED.
4. **Runtime:** not started. It would open a second Metro plus tunnel next to the user's running dev server on port 8081. The `expo start --clear` target is an existing script, not new code.

## Fixes Applied

- AGENTS.md:112 adds the `dev:mobile:clear` line. Re-checked with the same `dev:mobile` search: it now shows up in all three docs.

## Follow-ups

- The user should confirm that the vi.ts key warnings are gone after running `npm run dev:mobile:clear`.
