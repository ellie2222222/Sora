# Module extraction: segmented control, sync-status view, planning cards, category dialogs, member rows

**Date:** 2026-10-05T03:45:00Z
**Method:** extract-modules skill (one batch by this session, two by a scoped worker agent)
**Verdict:** PASS
**Scope:** the 2026-10-05 infra-audit targets M13, M14, M19 (named by the user)
**Files touched:** new `mobile/src/components/SegmentedControl.tsx`, `mobile/src/hooks/useSyncStatusView.ts`, `mobile/src/features/planning/components/{BudgetCard,GoalCard}.tsx`, `mobile/src/features/categories/components/{AddCategoryModal,CategoryManageDialog}.tsx`, `mobile/src/features/wallets/components/{MemberItem,InvitationRow,MemberItemSkeleton}.tsx`; changed `components/index.ts`, `hooks/index.ts`, `components/ConnectionSyncStatus.tsx`, `features/settings/components/SyncSection.tsx`, `features/planning/screens/PlanningScreen.tsx`, `features/transactions/components/{TransactionListScreen,TransactionListSkeleton}.tsx`, `features/categories/screens/CategoryListScreen.tsx`, `features/wallets/components/WalletMembersPanel.tsx`
**Related reports:** [2026-10-05-infra-audit.md](2026-10-05-infra-audit.md) (M13, M14, M19), [2026-10-01-dashboard-planning-extract-modules.md](2026-10-01-dashboard-planning-extract-modules.md) (its declined `CategoryListScreen` item is reversed here — the screen does hold module-level sub-components)

## Method

```bash
npm run typecheck -w @sora/mobile
npm run test -w @sora/mobile
(cd mobile && npx expo export --platform android --output-dir <scratchpad>/export-android)
grep -rn "function <ExtractedName>" mobile/src           # each defined once
grep -rn "from '@/components'\|from '@/features" mobile/src/hooks   # hooks cannot close a cycle back
npx tsc -p mobile --noEmit --noUnusedLocals | grep -iE "planning|SegmentedControl|TransactionList"
```

## Findings

| Extraction | Source → destination | Callers | Drift |
|---|---|---|---|
| M13 `SegmentedControl` + `SegmentedControlSkeleton` | `PlanningScreen.tsx` (2 hand-written tabs), `TransactionListScreen.tsx` (4 mapped tabs), `TransactionListSkeleton.tsx` (track skeleton) → `components/SegmentedControl.tsx`, barrel-exported | 3 | none — track, segment radius (`concentricRadius`), shadow, weight/tone, `accessibilityRole="tab"` identical; testIDs passed per option unchanged (`planning-segment-*`, `btn-transaction-filter-*`) |
| M14 `useSyncStatusView` | `ConnectionSyncStatus.tsx:34-75`, `SyncSection.tsx:21-35,57-78` → `hooks/useSyncStatusView.ts` | 2 | none; `SyncSection`'s `manualSyncing` removed — it was true over exactly the interval `retrySync` holds `isSyncing` (guarded by the same early return), so no visible change |
| M19 planning | `PlanningScreen.tsx:274-389` → `features/planning/components/BudgetCard.tsx` (+ `BudgetItemSkeleton`), `GoalCard.tsx` (+ `GoalItemSkeleton`) | 1 each | none; screen 435 → 267 lines |
| M19 categories | `CategoryListScreen.tsx:218-300` → `AddCategoryModal.tsx`; `:302-524` → `CategoryManageDialog.tsx` (with `CategoryDialogMode`, private `DeleteOption`) | 1 each | none; screen 524 → 218 lines; moved code only de-indented to column 0 |
| M19 wallets | `WalletMembersPanel.tsx:237-329` → `MemberItem.tsx`, `InvitationRow.tsx`, `MemberItemSkeleton.tsx` (rendered in a loop) | 1 each | none; panel 330 → 238 lines |

- Imports follow MB-10 / rule 14: features import their own new components by sibling-relative path; outside callers use `@/components` / `@/hooks`. `hooks/` imports no `@/components` or `@/features`, so no cycle.
- Typecheck clean; mobile 613/613; Android export 7.5 MB hbc; every extracted name defined once; `manualSyncing` gone.

## Fixes Applied

As tabled. No unit tests added: no pure helper was extracted (all are components or a hook over context/selectors).

## Follow-ups

- **Declined:** `CategoryItem`/`CategoryItemSkeleton` stay in `CategoryListScreen` (single use, the screen is now 218 lines).
- **Not checked on a device:** the three segmented controls and the sync status rows (identical JSX by construction).
