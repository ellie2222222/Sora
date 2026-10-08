import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { BUDGET_GROUPS, budgetGroupOn, GOAL_GROUPS, groupedRows, isGoalOverdue } from './planningSections.ts';

const TODAY = '2026-10-06';

describe('budgetGroupOn', () => {
  it('puts a budget that starts after today under upcoming', () => {
    assert.equal(budgetGroupOn({ startDate: '2026-10-07', endDate: '2026-12-31' }, TODAY), 'upcoming');
    assert.equal(budgetGroupOn({ startDate: '2026-11-01', endDate: null }, TODAY), 'upcoming');
  });

  it('puts a fixed window that finished before today under ended, and its last day still current', () => {
    assert.equal(budgetGroupOn({ startDate: '2025-11-01', endDate: '2025-12-15' }, TODAY), 'ended');
    assert.equal(budgetGroupOn({ startDate: '2026-09-01', endDate: TODAY }, TODAY), 'current');
  });

  it('keeps a repeating budget current from its start date on', () => {
    assert.equal(budgetGroupOn({ startDate: '2025-10-01', endDate: null }, TODAY), 'current');
    assert.equal(budgetGroupOn({ startDate: TODAY, endDate: null }, TODAY), 'current');
  });
});

describe('isGoalOverdue', () => {
  it('is an active goal whose target day has passed', () => {
    assert.equal(isGoalOverdue({ status: 'ACTIVE', targetDate: '2026-10-05' }, TODAY), true);
    assert.equal(isGoalOverdue({ status: 'ACTIVE', targetDate: TODAY }, TODAY), false);
    assert.equal(isGoalOverdue({ status: 'ACTIVE', targetDate: null }, TODAY), false);
  });

  it('never marks a completed or cancelled goal', () => {
    assert.equal(isGoalOverdue({ status: 'COMPLETED', targetDate: '2026-01-01' }, TODAY), false);
    assert.equal(isGoalOverdue({ status: 'CANCELLED', targetDate: '2026-01-01' }, TODAY), false);
  });
});

describe('groupedRows', () => {
  const goals = [
    { id: 'g1', status: 'CANCELLED' as const },
    { id: 'g2', status: 'ACTIVE' as const },
    { id: 'g3', status: 'COMPLETED' as const },
    { id: 'g4', status: 'ACTIVE' as const },
  ];

  it('orders by group, keeps the list order inside each group, and heads each group', () => {
    const rows = groupedRows(goals, GOAL_GROUPS, (goal) => goal.status);
    assert.deepEqual(
      rows.map((row) => row.key),
      ['header-ACTIVE', 'g2', 'g4', 'header-COMPLETED', 'g3', 'header-CANCELLED', 'g1'],
    );
  });

  it('drops empty groups, and every header when only one group has items', () => {
    const active = goals.filter((goal) => goal.status === 'ACTIVE');
    assert.deepEqual(groupedRows(active, GOAL_GROUPS, (goal) => goal.status).map((row) => row.key), ['g2', 'g4']);

    const budgets = [{ id: 'b1', group: 'ended' as const }, { id: 'b2', group: 'current' as const }];
    assert.deepEqual(
      groupedRows(budgets, BUDGET_GROUPS, (budget) => budget.group).map((row) => row.key),
      ['header-current', 'b2', 'header-ended', 'b1'],
    );
    assert.deepEqual(groupedRows([], BUDGET_GROUPS, () => 'current'), []);
  });
});
