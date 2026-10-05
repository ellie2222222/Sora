# Comment audit of the uncommitted tree (after infra-audit, double-check and extract-modules passes)

**Date:** 2026-10-05T04:05:00Z
**Method:** comment-audit skill (sweep and comment-only edits delegated to one agent; diff and suites re-checked)
**Verdict:** PASS
**Scope:** every modified or untracked `.ts/.tsx/.mjs/.js/.sql/.yml` in `git status` — 133 modified files (243 comment lines in or near changed hunks) plus all comments in 14 untracked entries. Governing policy: CLAUDE.md Part 7 rule 11.
**Files touched:** `mobile/src/features/transactions/components/TransactionListScreen.tsx`, `mobile/src/components/TransactionTotals.tsx`, `mobile/src/design-system/sizes.ts`
**Related reports:** [2026-09-30-comment-audit.md](2026-09-30-comment-audit.md), [2026-10-05-double-check-uncommitted.md](2026-10-05-double-check-uncommitted.md), [2026-10-05-extract-modules.md](2026-10-05-extract-modules.md)

## Method

```bash
git status --short; git diff -U5 -- <file>                   # scope and hunks
grep -rnE "TODO|FIXME|HACK" <scoped files>                    # none
grep -rn "TransactionListItem|dayAfter|Executor|QueryProvider|TransactionDayHeader|SectionList|tabBarMetrics|BudgetCard|GoalCard|WalletIdSource" <scoped files>   # stale references
# before/after proof: files copied to <scratchpad>/comment-audit-before/, then
diff <before> <after>; and the same diff with comment and blank lines stripped from both (identical)
npm run typecheck; npm run test -w @sora/mobile; npm test -w @sora/contracts
env -u DATABASE_URL -u CI npm run test -w @sora/server
```

## Findings

- `TransactionListScreen.tsx:58-60` — pattern 4 (misplaced): "The list is always one period's window, so an empty list says nothing about the wallet's other periods." sat on `FILTER_TYPES` after the segmented-control extraction; moved unchanged onto `EMPTY_TITLE_KEY`, which it explains.
- `TransactionTotals.tsx:16` — pattern 4 (wrong): said "income + expense totals"; the component renders one net figure per currency (`netSumByCurrency`). Rewritten to "Per-currency net (income − expense) …" — matters now that `IncomeExpenseTotals` sits beside it.
- `design-system/sizes.ts:24` — pattern 4 risk: copied the formula `fab + spacing.md + spacing.xl` that `fabListPaddingBottom` owns; now points at the helper.
- No restates-the-code, commented-out code, untracked TODO/FIXME or magic-count claims found; every `§` spec reference resolves. No why-comment owed: each non-obvious changed block (path-id guard, pool error handler, update race guard, server-side type filter, `scopeKey`, `monthTransactions`) already has one. No unrecoverable gaps.
- Comment-only proof: plain diff shows only comment lines (plus the unchanged `FILTER_TYPES` line the moved comment passed); stripped-comment comparison identical in all 3 files.
- Typecheck clean; mobile 613/613; contracts 129/129; server unit 58/58 (integration suites run separately on a scratch Postgres in the double-check pass).

## Fixes Applied

The three comment edits above; re-verified by the suites listed.

## Follow-ups (flag-only, not fixed by design)

- Cross-file references that still resolve but nothing keeps in sync: `AddBudgetModal.tsx:22-23` → AddTransactionModal's comment; `AddContributionModal.tsx:21-24` → the same; `ToastProvider.tsx:10` → CLAUDE.md rule 14; `PlanningScreen.tsx:71` "Like the transaction list…".
- Duplicated why-prose: the deep-import/require-cycle explanation in `AddTransactionModal.tsx:21`, `AddContributionModal.tsx:21`, `AddBudgetModal.tsx:22`; "Leaves one line of label text under the bars." in `TrendBarChart.tsx:21` and `WaterfallChart.tsx:48`.
- Borderline kept: skeleton section labels naming the real component (`PeriodReport.tsx:142/161/172`, `DashboardScreen.tsx:77/100`, "Mock" is a misnomer); `typography.ts:14` "multi-line copy" is narrower than `lineHeight`'s actual use.
