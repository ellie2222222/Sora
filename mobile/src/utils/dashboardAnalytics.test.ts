import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import type { CategorySpendSlice } from '@sora/contracts';

import { changeAgainst, emptyReasonFor, groupByTopLevel, rankCategories } from './dashboardAnalytics.ts';

function slice(overrides: Partial<CategorySpendSlice> & Pick<CategorySpendSlice, 'categoryId' | 'amount'>): CategorySpendSlice {
  return {
    categoryName: overrides.categoryId,
    icon: null,
    color: null,
    percentage: 0,
    parentId: null,
    ...overrides,
  };
}

describe('changeAgainst', () => {
  it('reports growth and decline against the previous period', () => {
    assert.equal(changeAgainst('150.0000', '100.0000'), 50);
    assert.equal(changeAgainst('50.0000', '100.0000'), -50);
    assert.equal(changeAgainst('100.0000', '100.0000'), 0);
  });

  it('returns null rather than inventing a percentage against zero', () => {
    // From nothing to something is an undefined change, not +100%.
    assert.equal(changeAgainst('500000.0000', '0.0000'), null);
  });

  it('handles the largest amounts DECIMAL(19,4) admits', () => {
    // Near the 15-integer-digit ceiling, where the comparison runs on scaled
    // bigints rather than being widened to a JS number.
    assert.equal(changeAgainst('999999999999999.0000', '499999999999999.5000'), 100);
  });
});

describe('rankCategories', () => {
  const current = [
    slice({ categoryId: 'food', amount: '300.0000', percentage: 60 }),
    slice({ categoryId: 'transport', amount: '150.0000', percentage: 30 }),
    slice({ categoryId: 'pets', amount: '50.0000', percentage: 10 }),
  ];

  it('ranks by amount descending regardless of input order', () => {
    const shuffled = [current[2]!, current[0]!, current[1]!];
    assert.deepEqual(
      rankCategories(shuffled).map((entry) => [entry.rank, entry.slice.categoryId]),
      [
        [1, 'food'],
        [2, 'transport'],
        [3, 'pets'],
      ],
    );
  });

  it('carries the change against the comparison period', () => {
    const previous = [
      slice({ categoryId: 'food', amount: '200.0000' }),
      slice({ categoryId: 'transport', amount: '300.0000' }),
    ];
    const ranked = rankCategories(current, previous);
    assert.equal(ranked[0]?.changePercent, 50);
    assert.equal(ranked[1]?.changePercent, -50);
  });

  it('flags a category absent from the comparison period as new, with no percentage', () => {
    const previous = [slice({ categoryId: 'food', amount: '200.0000' })];
    const pets = rankCategories(current, previous).find((entry) => entry.slice.categoryId === 'pets');
    assert.equal(pets?.isNew, true);
    assert.equal(pets?.changePercent, null);
  });

  it('reports no change at all when no comparison period was loaded', () => {
    for (const entry of rankCategories(current)) {
      assert.equal(entry.changePercent, null);
      assert.equal(entry.isNew, true);
    }
  });

  it('honours a top-N limit', () => {
    assert.equal(rankCategories(current, [], 2).length, 2);
  });

  it('handles an empty period without throwing', () => {
    assert.deepEqual(rankCategories([], []), []);
  });
});

describe('groupByTopLevel', () => {
  const groceries = slice({ categoryId: 'groceries', categoryName: 'Groceries', amount: '200.0000', percentage: 40, parentId: 'food' });
  const dining = slice({ categoryId: 'dining', categoryName: 'Dining Out', amount: '100.0000', percentage: 20, parentId: 'food' });
  const transport = slice({ categoryId: 'transport', categoryName: 'Transport', amount: '150.0000', percentage: 30 });

  it('rolls children up under their parent and sums the amounts', () => {
    const groups = groupByTopLevel([groceries, dining, transport], [{ id: 'food', name: 'Food', parentId: null }]);
    const food = groups.find((group) => group.id === 'food');

    assert.equal(food?.name, 'Food');
    assert.equal(food?.amount, '300.0000');
    assert.equal(food?.percentage, 60);
    assert.equal(food?.hasChildren, true);
    assert.deepEqual(food?.slices.map((entry) => entry.categoryId), ['groceries', 'dining']);
  });

  it('leaves a top-level category as its own single-slice group', () => {
    const groups = groupByTopLevel([transport]);
    assert.equal(groups.length, 1);
    assert.equal(groups[0]?.id, 'transport');
    assert.equal(groups[0]?.hasChildren, false);
    assert.equal(groups[0]?.amount, '150.0000');
  });

  it('orders groups by total, not by the largest single child', () => {
    // Transport (150) outranks either child alone but not Food's 300 total.
    const groups = groupByTopLevel([groceries, dining, transport], [{ id: 'food', name: 'Food', parentId: null }]);
    assert.deepEqual(groups.map((group) => group.id), ['food', 'transport']);
  });

  it("names a group from the parent's own slice when the parent also spent directly", () => {
    const foodItself = slice({ categoryId: 'food', categoryName: 'Food', amount: '10.0000', percentage: 2, color: '#F97316' });
    const groups = groupByTopLevel([groceries, foodItself]);
    const food = groups.find((group) => group.id === 'food');

    assert.equal(food?.name, 'Food');
    assert.equal(food?.color, '#F97316');
    assert.equal(food?.amount, '210.0000');
  });

  it("falls back to a child's name for an unresolvable parent rather than rendering an empty header", () => {
    const groups = groupByTopLevel([groceries]);
    assert.equal(groups[0]?.name, 'Groceries');
  });

  it('handles an empty breakdown', () => {
    assert.deepEqual(groupByTopLevel([]), []);
  });

  it('rolls a grandchild up to its top-level category, as a budget on that category counts it', () => {
    const tree = [
      { id: 'food', name: 'Food', parentId: null },
      { id: 'dining', name: 'Dining Out', parentId: 'food' },
      { id: 'coffee', name: 'Coffee', parentId: 'dining' },
    ];
    const coffee = slice({ categoryId: 'coffee', categoryName: 'Coffee', amount: '50.0000', percentage: 10, parentId: 'dining' });
    const groups = groupByTopLevel([coffee, dining, transport], tree);

    assert.deepEqual(groups.map((group) => group.id), ['food', 'transport']);
    assert.equal(groups[0]?.name, 'Food');
    assert.equal(groups[0]?.amount, '150.0000');
  });

  it('stops on a cyclic parent chain instead of hanging', () => {
    const cyclic = [{ id: 'a', name: 'A', parentId: 'b' }, { id: 'b', name: 'B', parentId: 'a' }];
    const groups = groupByTopLevel([slice({ categoryId: 'a', categoryName: 'A', amount: '1.0000', parentId: 'b' })], cyclic);
    assert.equal(groups.length, 1);
  });
});

describe('emptyReasonFor', () => {
  const blank = {
    totalBalance: [],
    income: [],
    expense: [],
    transferredIn: [],
    transferredOut: [],
    recentTransactions: [],
  };
  const total = { currency: 'VND', amount: '0.0000' };

  it('reports nothing when the period recorded income', () => {
    assert.equal(emptyReasonFor({ ...blank, income: [total] }), null);
  });

  it('reports nothing when the period recorded only expense', () => {
    assert.equal(emptyReasonFor({ ...blank, expense: [total] }), null);
  });

  it('treats a transfer-only period as activity, since the flow figures render', () => {
    assert.equal(emptyReasonFor({ ...blank, transferredOut: [total] }), null);
    assert.equal(emptyReasonFor({ ...blank, transferredIn: [total] }), null);
  });

  it('blames the missing accounts first — a wallet with none can record nothing', () => {
    assert.equal(emptyReasonFor({ ...blank, recentTransactions: [{}] }), 'no-accounts');
  });

  it('distinguishes a wallet that has never recorded anything from an empty window', () => {
    assert.equal(emptyReasonFor({ ...blank, totalBalance: [total] }), 'no-transactions');
    assert.equal(
      emptyReasonFor({ ...blank, totalBalance: [total], recentTransactions: [{}] }),
      'empty-period',
    );
  });

  it('counts a zero-balance account as an account, not as a missing one', () => {
    assert.equal(emptyReasonFor({ ...blank, totalBalance: [{ currency: 'VND', amount: '0.0000' }] }), 'no-transactions');
  });
});
