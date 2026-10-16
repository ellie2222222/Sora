# Comment audit of the uncommitted working tree

**Date:** 2026-10-16T11:19:51Z
**Method:** comment-audit skill (governed by CLAUDE.md Part 7 rule 11: why-only, 1–2 lines, no debug journal)
**Verdict:** PASS
**Scope:** Comments added or changed by the uncommitted diff (`git diff -U0` on mobile/src, server/src, packages, metro.config.js), plus every comment in the new, untracked code files.
**Files touched:** `mobile/src/features/auth/hooks/useGoogleSignIn.ts`, `mobile/src/app/navigation/MainTabNavigator.tsx`, `mobile/metro.config.js`
**Related reports:** `2026-10-16-double-check-working-tree-before-commit.md`

## Method

- `git diff -U0 -- mobile/src server/src packages mobile/metro.config.js | grep '^+\s*(//|/\*|\*|{/\*)'`
- `grep -nE '^\s*(//|/\*|\*|{/\*)'` over each untracked `.ts/.tsx/.mjs/.js` file (tests excluded)
- `rtk grep -r "rule 15" mobile/src` for the sibling convention

## Findings

- `useGoogleSignIn.ts:1-8`: a 7-line module docblock explaining the per-platform flow. It exceeds rule 11's 1–2 lines (pattern 6). **Condensed** to 2 lines that keep the two non-obvious facts: only the ID token goes to the server, and why Expo Go can't finish.
- `MainTabNavigator.tsx:86`: repeated "the xs label reads only at full strength", which the label's own note (line 137) already states. **Rewritten** to the one fact unique to this line: icon and label share one colour.
- `metro.config.js:8-9`: named the symptom string ("unexpected end of stream"), which is symptom history. **Rewritten** to the cause only. The symptom is in RUNBOOK's "When it goes wrong" table.
- Kept, each states a why:
  - `signedInRead.ts` background save
  - `apiSlice.ts` `keepUnusedDataFor`
  - `SegmentedControl.tsx` border carries state
  - `brand.ts` / `GoogleLogo.tsx` branding rule
  - `deviceConnectivity.ts`
  - `chatExchange.ts`, `aiMessages.ts`
  - `YearlyTrend.tsx` (BR-07, bigint)
  - `netWorth.ts` direct-path note
  - `set-test-passwords.mjs` header (usage plus why it writes the hash directly) and its empty-catch note
- No commented-out code, no untracked `TODO`/`FIXME`, no rotting counts.
- Missing-comment gaps: none found in the new code.

## Flag, don't auto-fix (not fixed by design)

- `// \`style\` can never be a function here — see CLAUDE.md Part 7 rule 15.`:
  - It appears verbatim in 8 files (`AuthPreferences.tsx`, `LanguageOptions.tsx`, `DatePickerModal.tsx`, `DatePresetSheet.tsx`, `PeriodBar.tsx`, `AppearanceSection.tsx`, `CollapsibleSection.tsx`, plus a shorter variant in `Button.tsx`).
  - It points at a numbered rule; renumbering Part 7 would orphan every copy.
  - `tokens-usage.test.ts` enforces the rule itself, so the comment is the only fragile part. Resolves today.

## Fixes Applied

- The three edits above, made by exact replacement of strings consisting only of comment lines (line endings preserved).
- Re-verified:
  - `npm run typecheck -w @sora/mobile`: exit 0
  - `npm run test -w @sora/mobile`: 754 pass, 0 fail
  - `node -e "require('./metro.config.js')"` from `mobile/`: loads

## Follow-ups

- The rule-15 cross-reference above.
