# Comment audit: dashboard/reports rename, ModalProvider split, utils-barrel cleanup

**Date:** 2026-09-22T00:00:00Z
**Method:** comment-audit skill — Phase 1 delegated to one Explore agent scoped to this session's
new/changed files; every finding re-verified against the live file (one cycle claim verified
empirically with `madge`, not just re-read) before any edit
**Verdict:** PASS — 3 comment-only fixes applied (1 delete, 2 additions), 2 items flagged and
left as-is per the skill's own "flag, don't auto-fix" rule, 1 carried-forward follow-up
finally resolved
**Scope:** Everything since [2026-09-21-comment-audit-repo-wide.md](2026-09-21-comment-audit-repo-wide.md)
and [2026-09-22-calculator-keypad-followup-double-check.md](2026-09-22-calculator-keypad-followup-double-check.md),
which already leave `server/src`, `packages/contracts`, `db/`, `scripts/`, and most of `mobile/src`
clean — the `features/reports`↔`features/dashboard` rename, the `ModalProvider`/`ModalContext`
split, and the 44-file utils-barrel import cleanup. Not a re-read of the whole repo.
**Files touched (comment-only edits):** [mobile/src/features/home/screens/HomeScreen.tsx](../mobile/src/features/home/screens/HomeScreen.tsx),
[mobile/src/features/budgets/components/AddBudgetModal.tsx](../mobile/src/features/budgets/components/AddBudgetModal.tsx),
[mobile/src/features/goals/components/AddContributionModal.tsx](../mobile/src/features/goals/components/AddContributionModal.tsx)
**Related, non-comment fix made in the same pass (see note at bottom):** 4 files had a
double-quoted deep-relative `utils/` import the prior session's regex-based cleanup missed —
fixed as a completion of that already-authorized task, not a comment-audit finding.
**Related reports:** [2026-09-21-comment-audit-repo-wide.md](2026-09-21-comment-audit-repo-wide.md),
[2026-09-22-calculator-keypad-followup-double-check.md](2026-09-22-calculator-keypad-followup-double-check.md),
[2026-09-22-dashboard-reports-rename-double-check.md](2026-09-22-dashboard-reports-rename-double-check.md)

## Method

Read `CLAUDE.md` Part 7 rule 11 fresh. One Explore agent audited: (A) the rename's 5 changed
files, (B) the `ModalProvider`/`ModalContext` split's 3 files, (C) all 44 utils-barrel-cleanup
files. Findings re-verified by hand. One finding (a cycle-avoidance claim in a comment) couldn't
be settled by re-reading alone, so it was tested empirically: temporarily changed
`AddTransactionModal.tsx`'s relative imports to the barrel form, ran `npx madge --circular`
before/after (12 → 18 cycles), confirmed the claim holds, then reverted the diagnostic edit and
confirmed the revert was byte-for-byte identical to the pre-edit file.

## Findings

1. **Fixed — carried-forward debug-journal narration** (`HomeScreen.tsx`, pattern 3/debug-journal)
   — `(unlike the old global FAB this replaced)` has been flagged as out-of-scope in three prior
   audits (09-15, 09-16, 09-21) because each was narrowly scoped elsewhere. This pass has no
   narrower scope, so it's in bounds. The surrounding "why" (`CustomTabBar` is normal-flow, not an
   overlay, so no extra offset is needed) is a real keep; the parenthetical about removed code
   isn't. **Deleted the clause, kept the rule.**
2. **Group A (rename)** — clean. Zero comment changes in `DashboardScreen.tsx`,
   `MainTabNavigator.tsx`, `types.ts`; only identifiers/testIDs/i18n keys were renamed.
   `MainTabNavigator.tsx:150`'s tab-order doc comment was correctly updated in the same diff as
   the rename itself (not a separate gap).
3. **Group B (`ModalContext.ts` split)** — `ModalContext.ts`'s new docblock is accurate and
   non-redundant against `ModalProvider.tsx`'s unchanged "deep-imported" comment; they explain two
   different facts (why the hook was split out, vs. why the provider itself uses relative
   imports).
4. **Flag, don't auto-fix — duplicated "why" across `app/providers/index.ts` and
   `ModalContext.ts`** — both independently explain the same underlying reasoning (why
   `ModalContext.ts` is barrel-exported while `ModalProvider.tsx` isn't). Each reads clearly on
   its own without requiring the reader to open the other file, so left as-is per the skill's
   rule — extraction to one canonical location would be a code change. Nothing mechanically keeps
   the two in sync if the exclusion rationale ever changes.
5. **Verified, not fixed — `AddTransactionModal.tsx:9-11`'s cycle-avoidance comment** — flagged by
   the agent as an unverifiable fragile cross-reference (claims that barrel-importing
   `@/features/accounts`/`@/features/categories` here would reintroduce a require cycle). Tested
   empirically rather than left as a guess: temporarily switched both imports to the barrel form
   and ran `npx madge --circular --extensions ts,tsx` before/after. Before: 12 pre-existing,
   unrelated cycles (all in `app/store`/`services/sync`). After: 18 — 6 new ones, all through
   `features/accounts/index.ts → AccountDetailScreen.tsx → app/navigation/index.ts →
   MainTabNavigator.tsx`. **The comment's claim is correct** — confirmed, not just "still
   resolves." Reverted the diagnostic edit (byte-identical to original, confirmed via `diff -q`).
6. **Fixed — missing-comment gap, now that the underlying claim is verified**: `AddBudgetModal.tsx`
   and `AddContributionModal.tsx` deep-import `CategoryPicker`/`AccountPicker` from a sibling
   feature exactly like `AddTransactionModal.tsx` does, and are also mounted directly by
   `ModalProvider.tsx`, but carried no explanation. Checked the other two `ModalProvider`-mounted
   modals (`EditTransactionModal.tsx`, `AddGoalModal.tsx`, `AddAccountModal.tsx`) for the same gap
   — none of them reach into a sibling feature via a relative import, so no comment is owed there.
   **Added the same verified rationale to both files**, cross-referencing `AddTransactionModal.tsx`
   rather than restating the full explanation three times.
7. **Group C (utils-barrel cleanup, 44 files)** — clean; pure import-line swaps, zero comment
   changes, except the 3 new `node --test`-constraint comments (`guestErrors.ts`, `guestUpload.ts`,
   `syncEngine.ts`) already added this session. Each is individually accurate; near-duplicate
   across 3 files but short enough and locally necessary in each — same "flag, don't auto-fix,
   leave as-is" call as finding 4, agent's recommendation confirmed.

## Fixes Applied

- `mobile/src/features/home/screens/HomeScreen.tsx` — deleted the debug-journal clause (finding 1).
- `mobile/src/features/budgets/components/AddBudgetModal.tsx`,
  `mobile/src/features/goals/components/AddContributionModal.tsx` — added the verified
  cycle-avoidance rationale above their relative cross-feature imports (finding 6).
- Diffed all 3 files against the working tree before this pass: every changed line is a comment
  line or a comment's continuation. No code line touched.
- `npx tsc --noEmit -p mobile/tsconfig.json` — clean. `npm run test -w mobile` — 165/165.

## Not a comment-audit finding, fixed anyway (completion of already-authorized work)

While tracing the cycle claim (finding 5), noticed 4 files still had a deep-relative `utils/`
import using **double** quotes (`"../../../utils/errors"`), which the prior session's
utils-barrel-cleanup regex only matched for single quotes and missed:
`CategoryListScreen.tsx`, `EditTransactionModal.tsx`, `WalletDetailScreen.tsx`,
`WalletMembersScreen.tsx` (7 import lines total). This is a non-comment code change, out of this
skill's charter on its own — but it's the tail end of a task the user already explicitly
authorized ("Fix it now") earlier this session, not new invented work, so it was completed rather
than left half-done or filed as a new follow-up. Re-verified: `tsc --noEmit` clean, tests 165/165
(re-run after this fix, same numbers as after the comment-only fixes).

## Follow-ups

- Carried forward, still open (comment-only fix would require a code change, out of this skill's
  charter): `AccountPicker.tsx`/`CategoryPicker.tsx`/`CategoryGrid.tsx`'s 3-way duplicated
  default-to-first-item comment/logic; `StateView.tsx:66-70`'s error-fallback comment (real fix is
  extracting the substring check to a named helper); `AnimatedScreen.tsx`/`BottomSheetModal.tsx`/
  `Skeleton.tsx`'s verbatim-identical "native animated module doesn't exist on web" comment.
- `calc.test.ts`'s `it('excludes cancelled rows...')` test description — still says "cancelled"
  post-rename; fixing it touches a string-literal (code) line, not a comment.
- New from this pass: `app/providers/index.ts` / `ModalContext.ts`'s duplicated "why" (finding 4)
  and the 3 near-duplicate `node --test` comments (finding 7) — both legitimate "flag, don't
  auto-fix" cases, not filed as fixes-needed.
