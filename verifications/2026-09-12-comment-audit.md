# Comment audit: repo-wide sweep, weighted toward the mobile redesign

**Date:** 2026-09-12T16:51:47Z
**Method:** comment-audit skill (Phase 1 delegated to three parallel scan agents — `mobile/src`,
`server/src`, and `packages/contracts`+`db`+`scripts`+docs — every finding re-verified against the
live file before any edit, per the skill's own instruction)
**Verdict:** PASS (fixes applied; comment-only; no regressions)
**Scope:** Whole repo (`mobile/src`, `server/src`, `packages/contracts/src`+`test`, `db/migrations`,
`db/tests`, `scripts/`, root markdown docs), per the user's explicit "full" request. Weighted toward
`mobile/src` since that's where nearly all current changes live.
**Files touched:** [mobile/src/components/DatePickerModal.tsx](../mobile/src/components/DatePickerModal.tsx),
[mobile/src/components/ThemeToggle.tsx](../mobile/src/components/ThemeToggle.tsx),
[mobile/src/components/AnimatedScreen.tsx](../mobile/src/components/AnimatedScreen.tsx),
[mobile/src/components/AnimatedIcon.tsx](../mobile/src/components/AnimatedIcon.tsx),
[mobile/src/components/AnimatedPressable.tsx](../mobile/src/components/AnimatedPressable.tsx),
[mobile/src/components/StateView.tsx](../mobile/src/components/StateView.tsx),
[mobile/src/components/BottomSheetModal.tsx:174](../mobile/src/components/BottomSheetModal.tsx#L174),
[mobile/src/features/settings/screens/SettingsScreen.tsx](../mobile/src/features/settings/screens/SettingsScreen.tsx),
[mobile/src/app/providers/AuthProvider.tsx:64-66](../mobile/src/app/providers/AuthProvider.tsx#L64-L66),
[server/src/verify-boot.ts:19-21](../server/src/verify-boot.ts#L19-L21)
**Related reports:** [2026-09-03-comment-audit-session-changes.md](2026-09-03-comment-audit-session-changes.md)
(prior pass, scoped to 9 named files — carried forward its two still-open flags rather than
re-discovering them, see Findings below), [2026-09-12-infra-audit.md](2026-09-12-infra-audit.md),
[2026-09-12-double-check-mobile-redesign.md](2026-09-12-double-check-mobile-redesign.md)

## Method

Three Phase-1 scan agents in parallel, each told to cite `file:line`, apply CLAUDE.md Part 7 rule 11
(comments explain *why* never *what*; 1-2 lines; untracked TODO/FIXME worse than none), and calibrate
against padding the report in an already-disciplined codebase. Every candidate finding was then
re-verified against the live file by hand before any edit — reading the surrounding function, not
just the flagged line, per the skill's instruction. `server/src` skipped the 6 files the 2026-09-03
pass already covered (`app.module.ts`, `main.ts`, `all-exceptions.filter.ts`,
`invitations.controller.ts`, `invitations.service.ts`, `wallets.module.ts`) unless further-changed.

## Findings

**Overall calibration:** consistent with the prior comment-audit report, this repo is disciplined —
patterns 2 (dead code), 5 (untracked TODO/FIXME) and 7 (rotting magic counts, mostly) are clean
repo-wide: zero `TODO`/`FIXME`/`HACK`/`XXX` anywhere, zero commented-out code. `server/src`,
`packages/contracts`, `db/`, and `scripts/` yielded **no fixable violations at all** — every
multi-line comment there carries genuine, still-accurate rationale. Nearly all the real signal was in
`mobile/src`'s new animation components and a few JSX-section labels, which is exactly where a fresh
sweep of new UI code would expect to find it.

### Fixed (pattern 4 — stale/wrong)

1. `mobile/src/components/DatePickerModal.tsx:77` — `// Generate range of years (1970 to 2050)` above
   `Array.from({length:90},(_,i)=>currentYear-60+i)`, which spans roughly *(current year − 60)* to
   *(current year + 29)* — a moving window, not the fixed 1970–2050 the comment claims, and today
   already outside that stated range. **Deleted** — the range math has no non-obvious rationale left
   to state once the wrong claim is removed.
2. `server/src/verify-boot.ts:19-22` — claimed `TransactionsModule` was "not-yet-wired" (it has been,
   per the 2026-09-03 infra-audit) and that the file is "Deleted after verification" (it still exists,
   flagged as a standing Tier-1 follow-up in both infra-audit reports). **Rewritten** to state the
   file's real, still-true purpose (a scratch Nest harness for exercising a module against real
   Postgres without booting the full app) and to point at the report explaining why it wasn't deleted,
   rather than repeat a promise the code has already broken. The file itself was **not** deleted —
   that's a code change requiring explicit permission (already an open follow-up in the infra-audit
   reports), out of this comment-only skill's scope.

### Fixed (pattern 1 — restates-the-code)

3. `mobile/src/components/DatePickerModal.tsx:84,92,146,149,158,210,242` — seven `{/* Header */}`/
   `{/* Year & Month Navigation Bar */}`/`{/* Body Content */}`/`{/* Weekday initials header */}`/
   `{/* Month grid */}`/`{/* Year Selector Grid */}`/`{/* Quick Actions Footer */}` JSX section labels,
   each naming a block whose contents (a title + close button, month/year nav controls, a calendar
   grid, a year grid, action buttons) are self-evident on sight. **Deleted**, all seven.
4. `mobile/src/components/ThemeToggle.tsx:153,171` — `{/* Sun Icon */}`/`{/* Moon Icon (Right-Side Up) */}`
   immediately above `<Sun .../>`/`<Moon .../>`. **Deleted**.
5. `mobile/src/components/ThemeToggle.tsx:39` — `// Slide progress starts immediately with ease-in-out
   curve` restating the `withTiming(..., { easing: Easing.inOut(...) })` two lines below. **Deleted**.
6. `mobile/src/components/AnimatedIcon.tsx:21-23` and `AnimatedPressable.tsx:15-17` — doc-comments that
   restate the component's own prop types/switch cases just below them ("Provides micro-animations
   (spin, pulse, bounce, float)" restates `IconAnimationType`; "subtle tactile scale & opacity
   feedback" restates `scaleTo`/`activeOpacity`). **Deleted** both.
7. `mobile/src/features/settings/screens/SettingsScreen.tsx:356,371` — `{/* Dark/Light Mode Switch
   Toggle */}` above a `<ToggleRow>` with a Moon/Sun leading icon, and `{/* Palette Section Header
   Divider */}` above a `<View>` rendering the section's own caption text. **Deleted** both.

### Fixed (pattern 7 — rotting magic-count, bundled with pattern 1)

8. `mobile/src/features/settings/screens/SettingsScreen.tsx:388` — `{/* 5 Accent Palettes (300/600/900
   shade stops) */}` above `THEME_NAMES.map(...)` — cites a specific count (`THEME_NAMES.length`) that
   silently goes stale the moment a theme is added or removed, on top of restating the map below it.
   **Deleted**.

### Fixed (pattern 8 — animation/visual narration, split from a kept "why")

9. `mobile/src/components/ThemeToggle.tsx:26-28` — class docstring "Premium animated theme toggle
   featuring sun & moon icons... Uses ease-in-out slide translation with a delayed color transition
   and upright moon icon" — pure marketing/visual prose with no non-obvious fact not already visible
   in the code below. **Deleted** entirely.
10. `mobile/src/components/ThemeToggle.tsx:102-103` — `// Moon rotates smoothly into position and lands
    perfectly upright (0deg)` restating the rotation math's own end state. **Deleted**.
11. `mobile/src/components/ThemeToggle.tsx:42` — `// Color progress has a subtle delay (60ms) for a
    silky staggered color transition`. This one bundled a genuine why (the `withDelay(60, ...)` magic
    number exists so the color transition trails the slide rather than firing with it — not obvious
    from the code alone) with pure narration ("silky"). **Rewritten**, not deleted: "Delayed 60ms below
    so the color transition trails the slide instead of firing with it." — keeps the constraint, drops
    the marketing language.
12. `mobile/src/components/AnimatedScreen.tsx:12-14` — docstring described the fade+slide-up visually
    ("smooth fade + slide-up animation"), but also carried one genuinely non-obvious fact: `useIsFocused`
    re-fires on every tab switch and stack-navigation return, not just first mount, which is easy to
    miss for a reader unfamiliar with that hook. **Rewritten** to keep only that fact, dropping the
    visual description.
13. `mobile/src/components/StateView.tsx:49` — trailing sentence "Fully localized with smooth
    micro-animations." on an otherwise-fine one-line doc-comment. **Deleted** the trailing sentence
    only; the first line (a plain functional description of what the component renders) was left as-is.
14. `mobile/src/components/BottomSheetModal.tsx:174` — `{/* Centered slideable handle bar indicator */}`
    restating the `<View {...panResponder.panHandlers}>` drag-handle block below it. **Deleted**. Left
    untouched, by contrast: lines 166-167 in the same file (`// Zero-gap bottom extension skirt` /
    `// Pulled offscreen below screen bottom edge`) — these explain *why* two magic numbers (`+ 30`
    padding, `-30` margin) exist, not what the UI looks like, and stay per the skill's own example of
    this exact distinction.

### Fixed (pattern 3/5 — untracked, will-rot reference)

15. `mobile/src/app/providers/AuthProvider.tsx:64-66` — "...Remove once auth itself moves into the
    store (phase 3)." Checked `REDUX_RTK_QUERY_MIGRATION_PLAN.md` (the only doc that could plausibly
    define "phase 3") — it names no such phase. An untracked forward reference is worse than none per
    rule 11. **Fixed**: dropped only the removal instruction, keeping the substantive why above it
    (mirrored into Redux so RTK Query's Redux-only `queryFn`s can branch guest-vs-real the same way
    this context's own consumers do) — that part is accurate and worth keeping.

### Flagged, not fixed (carried forward from 2026-09-03, still true)

- `server/src/**/*.controller.ts` API-specification `§`-section cross-references — every one
  spot-checked still resolves to the section it claims (`§2.5`, `§8.1/8.4/8.5`, `§10.4`, `§16.1`, etc).
  Nothing mechanically guards against a future renumbering silently orphaning them.
- `mobile/src/services/api/members.ts:11-15` and `server/src/wallets/wallets.controller.ts:53,71` —
  both still admit `transferOwnershipSchema` "has no schema in `@sora/contracts`... belongs in the
  contracts package". Still true, still unfixed — a contract change, not a comment edit.
- `all-exceptions.filter.ts:53`'s WARN log comment ("with actor and target") is still accurate to what
  the code does; the code itself still omits `role` per LA-03/spec §16.1. Not a comment issue.
- Four accounts/categories/budgets/goals controllers' one-line "see WalletsController's identical
  note" cross-references (`accounts.controller.ts:30` etc., pointing at `wallets.controller.ts:50-59`)
  — deliberate DRY-by-reference, correct today, but all four break together if that note ever moves.
- `mobile/src/services/guest/guestAccounts.ts`, `guestBudgets.ts`, `guestCategories.ts`,
  `guestGoals.ts` — near-verbatim "mirrors X.service.ts's derivation, never stored per BR-05" prose
  repeated across all four. Each copy is individually correct; a single shared doc-comment would be a
  code-organization change, out of this skill's comment-only scope.
- `packages/contracts/src/schemas.ts:47-50` — this session's new strip-comma comment (added by the
  double-check pass immediately before this one) is why-focused and compliant, 3 lines with one
  cross-file reference (`money.ts`'s `stripCurrencyInput`/`formatCurrencyInput`) — borderline length,
  left as-is; the reference was verified to still resolve.

### Out-of-charter observations (not this skill's scope — markdown content, not code comments)

Two stale markdown facts surfaced while scanning root docs for cross-reference rot; recording them
here since they were found, but not edited — content drift in a `.md` file is a doc-maintenance
question, not a comment-audit fix:
- `finance_tracker_domain_database_design.md:617-628` — the `users` table snippet predates migration
  002 (missing `google_id`/`theme`/`locale` and their CHECK constraints).
- `finance_tracker_react_native_full_plan.md:493-500` — the planned component-directory sketch
  (one-subfolder-per-component) doesn't match the actual flat `mobile/src/components/` layout, and
  still mentions the now-deleted `EmptyState`/`ErrorState`.

### Gaps (missing-comment candidates)

None found with a recoverable, non-guessed *why*. All three scan agents independently checked the
usual candidate shapes (dense control flow, magic numbers, workarounds, caller-must-uphold
assumptions) across their scopes and found each already commented or genuinely self-evident.

## Fixes Applied

15 comment edits across 10 files (enumerated above with file:line, what was removed/rewritten, and
why). All verified comment-only: the 3 tracked files' diffs (`AuthProvider.tsx`, `verify-boot.ts`,
`SettingsScreen.tsx`) were inspected against `HEAD` and every edit-site hunk touches only comment
lines; the 7 untracked new files (`DatePickerModal.tsx`, `ThemeToggle.tsx`, `AnimatedScreen.tsx`,
`AnimatedIcon.tsx`, `AnimatedPressable.tsx`, `StateView.tsx`, `BottomSheetModal.tsx`) were edited via
exact-string replacement where the matched/replaced text was itself comment syntax only, confirmed by
reading each file immediately before editing.

Re-verified: `npm run typecheck -w @sora/mobile` clean, `npm run typecheck -w @sora/server` clean —
no regression from any of the 15 edits.

## Follow-ups

- Everything in "Flagged, not fixed" above, carried forward rather than re-discovered next time this
  skill runs.
- The two markdown drift items under "Out-of-charter observations" are candidates for a
  `restructure`/doc-maintenance pass, not this skill.
- Nothing new to add beyond what [2026-09-12-infra-audit.md](2026-09-12-infra-audit.md) and
  [2026-09-12-double-check-mobile-redesign.md](2026-09-12-double-check-mobile-redesign.md) already
  carry forward from this session.
