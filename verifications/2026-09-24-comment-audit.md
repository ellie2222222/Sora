# Comment audit of the comments added in 61bcf0f..22297af

**Date:** 2026-09-24T06:01:59Z
**Method:** comment-audit skill
**Verdict:** PASS
**Scope:** every comment line added in the session's four commits (318 lines of code, SQL, YAML, Dockerfile and env-example diff), judged against CLAUDE.md Part 7 rule 11
**Files touched:** `packages/contracts/src/starter-categories.ts`, `mobile/src/design-system/colors.ts`
**Related reports:** `2026-09-24-final-tree-double-check.md`

## Method

`git diff 61bcf0f..22297af -U0 -- '*.ts' '*.tsx' '*.mjs' '*.yml' server/Dockerfile '*.sql' .env.example`, then every added comment line was read in context.

## Findings

- `starter-categories.ts:22,46,57` — the `// EXPENSE`, `// INCOME` and `// TRANSFER` section markers repeat the `type` field on every entry below them (restates the code). **Deleted.**
- `colors.ts:2` — "across five themes" is a count that will drift when a theme is added. **Rewritten** to "for every theme in `THEME_NAMES`".
- Everything else is a why-comment: a constraint, a library quirk, a rule reference (LA-01/04, BR-06/07, VL-04), or a caller contract. **Kept.**
- **Flag only:** "Overscroll would drag the content down with the pull; only the indicator may move." appears word for word in `RefreshableScrollView`, `RefreshableFlatList` and `RefreshableSectionList`. Each copy is correct. The real fix is a shared prop spread, which is a code change and out of scope here.
- **Left alone:** the headers of migrations 005 and 006. Applied migrations are immutable, and editing even a comment changes the checksum.

## Fixes Applied

- The diff is 1 line added and 4 removed, all of them comments.
- `npm run typecheck` exits 0; contracts tests 75/75.

## Follow-ups

- Optionally extract the three Refreshable* lists' shared `bounces`/`overScrollMode` props, so the overscroll comment lives in one place.
