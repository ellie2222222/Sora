# Comment audit: empty states, the slide transition, and transaction-list period modes

**Date:** 2026-09-22T19:13:52Z
**Method:** comment-audit skill — scoped by `git diff`, every added/changed comment in the
uncommitted tree read against CLAUDE.md Part 7 rule 11 (read fresh this run)
**Verdict:** PASS — 4 comment-only fixes applied, 2 items flagged and left as-is per the skill's
own "flag, don't auto-fix" rule
**Scope:** The comments added or changed by this session's uncommitted work only — the dashboard
Tier-A pass, the empty states, `SlideSwap`, `PeriodBar`, and the transaction-list period modes.
Not a re-read of the repo; [2026-09-22-comment-audit-dashboard-rename-and-utils-barrel.md](2026-09-22-comment-audit-dashboard-rename-and-utils-barrel.md)
and the two repo-wide passes before it leave the rest clean.
**Files touched (comment-only edits):** [packages/contracts/src/calc.ts](../packages/contracts/src/calc.ts),
[mobile/src/components/SlideSwap.tsx](../mobile/src/components/SlideSwap.tsx),
[mobile/src/features/transactions/components/TransactionListScreen.tsx](../mobile/src/features/transactions/components/TransactionListScreen.tsx),
[mobile/src/features/planning/screens/PlanningScreen.tsx](../mobile/src/features/planning/screens/PlanningScreen.tsx)
**Related reports:** [2026-09-22-empty-states-slide-and-period-modes-double-check.md](2026-09-22-empty-states-slide-and-period-modes-double-check.md)
(the pass that produced this code), [2026-09-22-comment-audit-dashboard-rename-and-utils-barrel.md](2026-09-22-comment-audit-dashboard-rename-and-utils-barrel.md)

## Method

`git diff -U0` filtered to added comment lines across `mobile/`, `packages/` and `server/`, then
each candidate re-read in place with its surrounding function. Rule 11 governed every call: why
not what, one or two lines, never a debug journal.

## Findings

1. **Fixed — history narration** (`TransactionListScreen.tsx:55`, pattern 3/debug-journal). Read
   "so the day strip and the query can never disagree *the way a fixed month window and a day
   picker did*". The trailing clause narrates the bug the change fixed, which belongs in the
   commit message. Now: "One source for the window, so the day strip and the query cannot
   disagree."
2. **Fixed — history narration** (`PlanningScreen.tsx:51`, pattern 3). Read "Folding 'no wallet'
   into the loading branch left this tab on a skeleton that never resolves" — the previous
   implementation's failure, written in the past tense. Rewritten forward-looking as the
   constraint a future editor must not break: the query is skipped without a wallet, so this
   branch must resolve before the loading one.
3. **Fixed — four lines carrying two facts** (`TransactionListScreen.tsx:97`, pattern 6). Condensed
   to three, keeping both non-obvious points (a total summed from one page is *wrong* rather than
   partial; the comparison uses the fetched count because DELETED rows are filtered afterwards)
   and dropping the prose around them.
4. **Fixed — three lines restating a symptom** (`SlideSwap.tsx:41`, pattern 6). The `useLayoutEffect`
   rationale is now two lines: the offset must be committed before the frame is drawn, and what
   goes wrong if it is not. The *why* is load-bearing here — switching back to `useEffect` would
   silently reintroduce the wrong-direction artefact — so it was condensed, not deleted.
5. **Fixed — a redundant second paragraph** (`calc.ts:196`, pattern 6). `transferDirection`'s doc
   closed with "Reported separately from income/expense and never folded into them", which its own
   first paragraph and `countsAsPeriodActivity`'s doc directly above already say. Removed; the
   internal-transfer rule, the genuinely surprising part, stays.
6. **Checked, deliberately kept.** The BR-06/BR-07 rationale blocks in `calc.ts`, `responses.ts`,
   `dashboard.service.ts` and `guestDashboard.ts` are multi-paragraph but each paragraph carries a
   distinct business rule that is not inferable from the code, which is exactly rule 11's stated
   exception; they also match the house style of `currency-totals.ts` next to them. Likewise the
   `uq_category_name_per_parent` note in `starter-categories.ts` (a database constraint), the
   `flexGrow` note on the dashboard's scroll container (a non-obvious style value), and the
   "three '—' rows read as a broken screen" note in `AccountsScreen.tsx` (a design constraint).
7. **Checked, no violations of patterns 1, 2, 5, 7.** No restates-the-code, no commented-out code,
   no `TODO`/`FIXME` added anywhere in this session's diff, and no magic-count claims.

## Fixes Applied

Per finding above; all four edits are provably comment-only — each replaced comment text with
comment text and touched no statement. Re-verified after the pass: `npm run typecheck` reports
zero errors across three workspaces, and `npm test` passes 73/73 + 11/11 + 218/218.

## Follow-ups

- **Flagged, not fixed — fragile cross-file reference** (`MainTabNavigator.tsx:42`). The indicator
  comment justifies its easing as "the same horizontal-motion treatment as `SlideSwap`". Verified:
  `SlideSwap` exists and the claim holds today. Nothing keeps the two in sync, so retuning one
  will silently orphan the other's comment. Same shape in `PlanningScreen.tsx`'s `NoWalletState`
  doc, which points at the Accounts and Dashboard tabs' wording.
- **Flagged, not fixed — duplicated "why" prose.** The internal-transfer rule (counting a
  self-transfer both ways inflates both figures) is now stated in `calc.ts`, in
  `dashboard.service.ts`, in `guestDashboard.ts`, in `responses.ts` and in API spec §14.1. Every
  copy is correct and each reader needs it, but a real fix is a single canonical location the
  others reference — a code/doc change, out of this skill's comment-only scope.
- Carried forward, unresolved from the double-check that preceded this pass: `date.ts`'s
  `startOfWeek` comment cites `WEEKDAY_NAMES`, a constant that is itself dead code. The comment is
  accurate about the layout but points at something no longer referenced; fixing it properly means
  deleting the constant, which is a code change.
