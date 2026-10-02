# Module Extraction Report
Date: 2026-10-01

## Scope
Unscoped sweep triggered by `/extract-modules`. Focused on `DashboardScreen.tsx` and `PlanningScreen.tsx` due to significant oversized inline components inside the screen files.

## Batch 1: Dashboard components
**Source**: `mobile/src/features/dashboard/screens/DashboardScreen.tsx`

Extractions (all re-pointed inside `DashboardScreen.tsx`):
- `DashboardEmptyForWallet` -> `mobile/src/features/dashboard/components/DashboardEmptyForWallet.tsx`
- `PeriodReport` -> `mobile/src/features/dashboard/components/PeriodReport.tsx`
- `YearlyReport` -> `mobile/src/features/dashboard/components/YearlyReport.tsx`
- `MonthDataPoint` -> `mobile/src/features/dashboard/components/MonthDataPoint.tsx`
- `PeriodInsights` -> `mobile/src/features/dashboard/components/PeriodInsights.tsx`
- `yearOf`, `monthsOfYear` -> `mobile/src/features/dashboard/utils.ts`

## Batch 2: Planning components
**Source**: `mobile/src/features/planning/screens/PlanningScreen.tsx`

Extractions (all re-pointed inside `PlanningScreen.tsx`):
- `BudgetCard` -> `mobile/src/features/planning/components/BudgetCard.tsx`
- `GoalCard` -> `mobile/src/features/planning/components/GoalCard.tsx`

## Verification
- **Typecheck**: `npm run typecheck -w @sora/mobile` passes completely.
- **Tests**: `npm run test` passes completely (528 tests). Note: Repaired `date.test.ts` failure due to IDE rollback of the Today/Yesterday conditional check in `formatDayHeading`, and resolved a circular dependency bug caused by `previousWindow`.
- **Behavior**: No functional or UI changes made. Pure extractions.

## Declined Candidates
- `CategoryListScreen.tsx`: Swept but declined because it does not contain inline sub-components (it is just one large screen function). Suitable for componentization only if a new shared pattern emerges.
