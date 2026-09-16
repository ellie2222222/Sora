# Comment audit: this session's Pressable-style-fix files

**Date:** 2026-09-16T00:00:00Z
**Method:** comment-audit skill
**Verdict:** PASS
**Scope:** Files touched this session (the Pressable function-style bug fix and the smaller preceding
fixes) — not the whole repo. Comment-only edits; no logic changed.
**Files touched:** mobile/src/components/Button.tsx, MonthSelector.tsx, DatePickerModal.tsx,
mobile/src/features/settings/components/LanguageSection.tsx, CollapsibleSection.tsx,
AppearanceSection.tsx
**Related reports:** [2026-09-15-comment-audit.md](2026-09-15-comment-audit.md) — carries forward its
one open follow-up (see below); [2026-09-16-double-check-pressable-style-fix.md](2026-09-16-double-check-pressable-style-fix.md)
covers the same file set for logic/behavior.

## Method

Read `CLAUDE.md` Part 7 rule 11 (comments explain *why* never *what*) fresh, plus the newly-added rule
15 (the subject of this session's fix). Read all six touched files directly (small enough set not to
need a delegated search agent this pass) and grepped for the specific pattern already suspected —
verbatim-duplicated explanatory comments — across the file set.

## Findings

- **Verbatim-duplicated "why" prose across 5 files, near-duplicated in a 6th** (pattern: "flag, don't
  auto-fix" #2 in the skill, but the real fix here turned out to be comment-only) — `MonthSelector.tsx`,
  `DatePickerModal.tsx`, `LanguageSection.tsx`, `CollapsibleSection.tsx`, and `AppearanceSection.tsx` each
  carried an identical 3-line comment explaining the `react-native-css-interop` function-`style` bug;
  `Button.tsx` carried a 4-line variant of the same explanation. Since `CLAUDE.md` rule 15 (added this
  session) now documents the full mechanism with source-level detail, repeating it six times means six
  places to keep in sync if the explanation ever needs correcting — and unlike the `AccountPicker`/
  `CategoryPicker` case in the prior audit, the real fix here didn't require a code change: it only
  required pointing each site at the canonical explanation instead of repeating it.
- Checked `ThemeProvider.tsx`'s `AnimatedThemeRoot` docstring (rewritten in an earlier session's
  corruption fix) against the current code — still accurate, no drift.
- Checked `colors.ts`'s file-level doc comment against the `SEMANTIC_BASE` value change (softened
  income/expense/success/danger hex values) — the comment doesn't reference specific hex values, so no
  staleness introduced.
- Checked the new comments in `DateStrip.tsx`, `TransactionListSection.tsx` (`RECENTLY_CREATED_MS`), and
  `TransactionListScreen.tsx` (`slideDirectionRef`) — all genuine, concise "why" comments (a non-obvious
  timing/ordering constraint in each case), none restating the code. Left as-is.
- `AppNavigator.tsx` — no comments in the file at all; nothing to check.

## Fixes Applied

- `Button.tsx`, `MonthSelector.tsx`, `DatePickerModal.tsx`, `LanguageSection.tsx`,
  `CollapsibleSection.tsx`, `AppearanceSection.tsx` — condensed each duplicated explanation down to one
  line pointing at the canonical source: `// \`style\` can never be a function here — see CLAUDE.md Part
  7 rule 15.` Re-verified comment-only via `git diff` per file (only comment lines changed), then
  `npm run typecheck -w @sora/mobile` (clean) and `npm test -w @sora/mobile` (139/139).

## Follow-ups

- Carried forward from [2026-09-15-comment-audit.md](2026-09-15-comment-audit.md): `mobile/src/features/dashboard/screens/HomeScreen.tsx:12-14` still has a debug-journal-style
  "(unlike the old global FAB this replaced)" clause — still outside this pass's scope (not touched this
  session either). A future whole-repo or `features/dashboard`-scoped sweep should pick this up.
- Also carried forward: `AccountPicker.tsx`/`CategoryPicker.tsx`'s duplicated default-to-first-item
  comment, and `StateView.tsx:66-70`'s long fallback-justification comment — both still flagged as
  code-change-required, not touched.
