import { GoalStatus, type BudgetResponse, type GoalResponse } from '@sora/contracts';

export type BudgetGroup = 'current' | 'upcoming' | 'ended';
export const BUDGET_GROUPS: readonly BudgetGroup[] = ['current', 'upcoming', 'ended'];
export const GOAL_GROUPS: readonly GoalStatus[] = [GoalStatus.ACTIVE, GoalStatus.COMPLETED, GoalStatus.CANCELLED];

/** A repeating budget has no end date, so once started it stays current until it's deleted. */
export function budgetGroupOn(budget: Pick<BudgetResponse, 'startDate' | 'endDate'>, today: string): BudgetGroup {
  if (budget.startDate > today) return 'upcoming';
  if (budget.endDate !== null && budget.endDate < today) return 'ended';
  return 'current';
}

/** The API has no overdue state: an active goal whose target day has passed in the wallet's zone. */
export function isGoalOverdue(goal: Pick<GoalResponse, 'status' | 'targetDate'>, today: string): boolean {
  return goal.status === GoalStatus.ACTIVE && goal.targetDate !== null && goal.targetDate < today;
}

export type SectionRow<T, G extends string> =
  | { kind: 'header'; key: string; group: G }
  | { kind: 'item'; key: string; item: T };

/**
 * Items in the order of `groups`, each group keeping the list's own order. Headers appear only when
 * more than one group has items: a lone "Current" heading over every row says nothing.
 */
export function groupedRows<T extends { id: string }, G extends string>(
  items: readonly T[],
  groups: readonly G[],
  groupOf: (item: T) => G,
): SectionRow<T, G>[] {
  const byGroup = new Map<G, T[]>(groups.map((group) => [group, []]));
  for (const item of items) byGroup.get(groupOf(item))?.push(item);
  const filled = groups.filter((group) => (byGroup.get(group)?.length ?? 0) > 0);
  return filled.flatMap((group) => [
    ...(filled.length > 1 ? [{ kind: 'header' as const, key: `header-${group}`, group }] : []),
    ...byGroup.get(group)!.map((item) => ({ kind: 'item' as const, key: item.id, item })),
  ]);
}
