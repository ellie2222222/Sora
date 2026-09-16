# Double-check: whole-codebase sweep after theme/calculator/modal work

**Date:** 2026-09-16T00:00:00Z
**Method:** double-check skill
**Verdict:** PASS
**Scope:** Whole codebase — a large uncommitted session spanning the theme-toggle latency fix, the
calculator/money-keyboard rework, the transaction date-strip/spacing pass, and the modal/form
consistency review. Also covers 4 i18n keys added this pass for `en`/`vi` parity.
**Files touched:** see Fixes Applied below
**Related reports:** `2026-09-16-theme-toggle-latency.md`, `2026-09-16-modal-form-consistency-review.md`,
`2026-09-16-double-check-money-keyboard-rework.md`, `2026-09-16-double-check-calculator-and-button-fix.md`
(all still-valid, not re-verified in full — this pass covers what's new since them plus a repo-wide rule sweep)

## Method

- Read `CLAUDE.md` fresh (Part 7 rules, MB-conventions).
- Delegated Phase 1 (dead code, duplication, drift, rule violations) to a general-purpose agent scoped
  to the session's actually-changed files, with explicit checks for: Pressable function-`style` (rule 15),
  barrel-import convention (rule 14/MB-10), money-as-JS-number (rule 1), en/vi key parity (rule 13),
  lucide-only icons (MB-05), dangling references to the deleted `mobile-development-plan.md`, `DateField`
  caller-safety after its `string | null` widening, and staleness of `MODAL_UI_STATE.md` /
  `plans/mobile/modal-ui-form-plan.md` given the fixes just applied.
- Ran directly: `npm run typecheck` (all 3 packages), `npm test` (all 3 packages),
  `node scripts/check-contract-parity.mjs`.
- Manually inspected the untracked `mobile/.eas/` directory and the unstaged `HANDOFF.md` deletion for
  anything sensitive or accidental.

## Findings

1. **Rule 15 (Pressable function-`style`)** — `grep -n "style={("` across `mobile/src`: zero matches. Clean.
2. **Rule 1 (money as JS number)** — `AddContributionModal.tsx` was checked and had already been fixed
   this session to use `parseMoney`/`isPositive` from `@sora/contracts` instead of `parseFloat`. No other
   touched file coerces money through `Number()`. Clean.
3. **Rule 13 (en/vi parity)** — structural key-path diff across the full `en.ts`/`vi.ts` tree (452 keys
   each side): empty both directions. `mobile/src/app/i18n/index.ts` also enforces this mechanically
   (`vi: TranslationResource`, not `DeepPartial`, plus a dev-time `warnOnKeyMismatch`). Clean — the 4 keys
   added this pass (`budgets.startDate`/`endDate`/`endBeforeStartError`, `goals.noTargetDate`) are
   included.
4. **MB-05 (lucide-only icons)** — no non-lucide icon import anywhere in `mobile/src`. Clean.
5. **Dangling references to `mobile-development-plan.md`** — only 2 repo-wide hits, both prose describing
   its deletion (`plans/README.md`, a verification report). No live link/import. Clean.
6. **`DateField` caller safety after `value: string | null`** — all 5 callers pass either a plain `string`
   or a state already typed `string | null`. No mismatch. Clean.
7. **`AddTransactionModal` testID dedup** — the old `transaction-from-account`/`transaction-to-account`
   testIDs only appear in the (correctly still-separate) `TRANSFER` branch of the same file; no test or
   other file references them for the collapsed non-transfer case. Clean.
8. **`mobile/MODAL_UI_STATE.md` was stale** — 4 of its flagged findings (AddBudgetModal Weekly/Custom
   window, AddContributionModal hardcoded date, AddGoalModal raw text date, AddTransactionModal duplicate
   picker) were fixed earlier this session but the doc still described them as open, with a header dated
   today — a live contradiction, not aging gracefully. **Fixed** (see below).
9. **`plans/README.md` index gap** — its directory tree and Mobile Client table didn't list the new
   `plans/mobile/modal-ui-form-plan.md`, added this session. The doc calls itself "This index." **Fixed**.
10. **`Button.tsx` dead prop** — `loadingLabel?: string`, added this session, fully wired into the render
    but with zero call sites anywhere in `mobile/src`. Speculative, unused API surface. **Fixed** (removed).
11. **`ThemeToggle.tsx:47-50`** — `useEffect(() => animateTo(...), [value])` omits `animateTo` from deps.
    Harmless (the function only closes over refs/shared values, no stale-closure risk), flagged only as a
    style nit. Left as-is — adding it would just be dependency-array noise for a function recreated every
    render.
12. **`mobile/.eas/workflows/create-production-builds.yml`** (untracked) — plain EAS build-workflow
    config, no platform/credentials/secrets. Not a leak.
13. **`HANDOFF.md` deletion (unstaged, pre-existing from earlier in the session)** — its content (the
    Pressable-function-style bug and FAB regression) is already captured permanently in `CLAUDE.md`
    rule 15. Confirmed safe to leave deleted; no action needed.
14. **Rule 14 (barrel imports / MB-10)** — `AddTransactionModal.tsx`, `AddBudgetModal.tsx`,
    `AddContributionModal.tsx` import `AccountPicker`/`CategoryPicker`/`utils/*` via deep relative paths
    rather than their `@/...` barrels. Confirmed via `git diff` these import lines were **not** touched
    this session — pre-existing drift, not a regression. Not fixed in this pass (out of scope: fixing it
    would touch import lines across files this pass didn't otherwise change, for a cosmetic/consistency
    gain unrelated to the session's actual work). Flagged as a follow-up.

## Fixes Applied

- [mobile/src/components/Button.tsx](mobile/src/components/Button.tsx) — removed the unused
  `loadingLabel` prop and its render branch entirely (prop declaration, destructure, JSX). Re-verified:
  typecheck clean, 153/153 tests still pass.
- [mobile/MODAL_UI_STATE.md](mobile/MODAL_UI_STATE.md) — added a dated update banner at the top pointing
  to the fixes and the verification report, rather than rewriting the whole historical audit body.
- [plans/README.md](plans/README.md) — added `modal-ui-form-plan.md` to the directory-tree diagram and
  the Mobile Client table, marked **Executed**.

## Follow-ups

- `AddTransactionModal.tsx`/`AddBudgetModal.tsx`/`AddContributionModal.tsx` importing `AccountPicker`/
  `CategoryPicker`/shared utils via deep relative paths instead of their `@/...` barrels (MB-10) —
  pre-existing, not introduced this session. Worth a dedicated pass, not bundled into this one.
- The 4 new i18n keys' translations are functional-quality machine review, not native-speaker reviewed —
  same bar as the rest of `vi.ts` in this repo, not a new gap.
