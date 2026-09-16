# Comment audit: this session's design-polish + NativeWind migration files

**Date:** 2026-09-15T00:00:00Z
**Method:** comment-audit skill (invoked via `/double-check /comment-audit`)
**Verdict:** PASS
**Scope:** The ~90 files touched earlier this session — the FAB/Money/CategoryAvatar/Settings
design-polish pass, plus the NativeWind infra + 73-file migration — not the larger pre-existing
uncommitted diff already in the working tree, and not the whole repo. Comment-only edits; no logic
changed.
**Files touched:** mobile/src/components/ConfirmDialog.tsx, mobile/src/components/Fab.tsx,
mobile/src/components/TransactionListSection.tsx,
mobile/src/features/accounts/components/AccountPicker.tsx,
mobile/src/features/categories/components/CategoryPicker.tsx
**Related reports:** [2026-09-15-fab-money-avatar-settings-polish.md](2026-09-15-fab-money-avatar-settings-polish.md),
[2026-09-15-nativewind-migration.md](2026-09-15-nativewind-migration.md) — this pass covers the
same file set those two produced/touched.

## Method

Read `CLAUDE.md` Part 7 rule 11 (comments explain *why* never *what*; no debug-journal narration;
untracked TODO/FIXME worse than none) as the governing policy. Delegated the search to a read-only
Explore agent scoped to exactly the file list above (not the rest of the repo's pre-existing
uncommitted changes). Verified every reported finding against the live file myself before fixing
(per the skill's Phase 1 requirement) — one flagged finding (`HomeScreen.tsx`) turned out to be
outside the declared scope and was left unfixed on that basis alone, not because the finding was
wrong.

## Findings

- `mobile/src/components/ConfirmDialog.tsx:35` — doc comment claimed `matchTextIgnoreCase` defaults
  to `true` (case-insensitive); the actual default (line 66) is `false`, and the matching logic
  (lines 99-100) only lowercases when the flag is explicitly `true` — confirmed stale/wrong.
- `mobile/src/components/TransactionListSection.tsx:18` — `showDayTotals` doc claimed a
  "per-currency income/expense total"; `DayTotals` (confirmed at line ~89) calls
  `sumByType(transactions, 'EXPENSE')` only — income is never computed or shown. Confirmed
  stale/inaccurate.
- `mobile/src/features/accounts/components/AccountPicker.tsx:27-29` — `/** Account picker
  component. */` (plus two more lines restating "opens a bottom sheet" and "defaults to first
  item", both already obvious from the code) — restates-the-code, pattern 1.
- `mobile/src/features/categories/components/CategoryPicker.tsx:20-22` — identical shape, same
  violation.
- `mobile/src/components/Fab.tsx:12` — "The floating add-transaction button with smooth tactile
  micro-animations." — editorializes about how the animation feels rather than stating any why;
  visual-narration prose, pattern 8. Checked `AnimatedPressable.tsx` for a genuine why worth
  keeping (e.g. why this component over a plain `Pressable`) — found none non-obvious enough to
  justify a replacement comment, so deleted outright rather than rewritten.
- `mobile/src/features/accounts/components/AccountPicker.tsx:37-39` /
  `mobile/src/features/categories/components/CategoryPicker.tsx:29-31` — near-verbatim duplicated
  "why" comment (the default-to-first-item UX shortcut) copied across both pickers. Both are
  individually correct and worth keeping (not deleted — they lost their redundant docblock context
  above them in this pass, so each now carries its own justification standalone). Flagged per the
  skill's "verbatim-duplicated why prose" pattern: nothing mechanically keeps the two in sync if
  one picker's behavior changes — a real fix (extracting the shared reasoning) is a code change,
  out of scope for a comment-only pass.
- `mobile/src/components/StateView.tsx:66-70` — a genuine, worth-keeping 5-line comment justifying
  a fragile English-substring offline-detection fallback. Longer than CLAUDE.md's "one or two
  lines, else extract" preference; the actual fix (extracting the substring check into a named
  helper so the comment collapses to one line) is a code change — flagged, not applied.
- `mobile/src/features/dashboard/screens/HomeScreen.tsx:12-14` — trailing clause "(unlike the old
  global FAB this replaced)" narrates removed prior-implementation history inside a live comment —
  debug-journal/before-after narration, the kind Part 7 rule 11 calls out by name. **Confirmed live,
  but this file was not touched by either of this session's two prior passes and falls outside the
  scope declared for this sweep — left unfixed on that basis.** Worth a follow-up pass.

## Fixes Applied

- `ConfirmDialog.tsx:35` — corrected to `Default: false (case-sensitive).`, re-verified against the
  actual default (`matchTextIgnoreCase = false`) and matching logic.
- `TransactionListSection.tsx:18` — corrected to `Shows a per-currency expense total...`, matching
  what `DayTotals` actually renders.
- `AccountPicker.tsx:27-29` — deleted the restates-the-code docblock entirely.
- `CategoryPicker.tsx:20-22` — deleted the restates-the-code docblock entirely.
- `Fab.tsx:12` — deleted the visual-narration comment; nothing else in the file needed a why.

All five diffed as comment-only (`git diff` on each file, confirmed only comment lines/blocks
added or removed — the surrounding NativeWind-migration `className` changes from the earlier pass
were already present and untouched by this pass). Re-ran `npm run typecheck -w @sora/mobile`
(clean) and `npm test -w @sora/mobile` (139/139) after.

## Follow-ups

- `mobile/src/features/dashboard/screens/HomeScreen.tsx:12-14` — confirmed violation, not fixed
  (out of this pass's declared scope). A future comment-audit pass over `features/dashboard` (or a
  whole-repo sweep) should pick this up.
- `AccountPicker.tsx`/`CategoryPicker.tsx`'s duplicated default-to-first-item comment — flagged per
  the skill's "flag, don't auto-fix" rule; a real fix means extracting the shared reasoning (and
  possibly the `useEffect` itself) into one place both pickers use, which is a code change outside
  this skill's remit.
- `StateView.tsx:66-70` — flagged as a candidate for a same-file refactor (extract the substring
  check to a named helper) so the comment can collapse to one line; not applied here since it's a
  code change.
