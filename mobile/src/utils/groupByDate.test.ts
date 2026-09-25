import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import type { TransactionResponse } from '@sora/contracts';

import { groupConsecutiveByDay, groupTransactionsByDay } from './groupByDate.ts';
import { flattenPages } from './pagination.ts';

describe('groupConsecutiveByDay', () => {
  it('merges a day split across two loaded pages into one group', () => {
    const pages = [
      { items: [{ id: 'a', at: '2026-09-24T10:00:00.000Z' }, { id: 'b', at: '2026-09-23T18:00:00.000Z' }], pagination: undefined },
      { items: [{ id: 'c', at: '2026-09-23T09:00:00.000Z' }, { id: 'd', at: '2026-09-22T09:00:00.000Z' }], pagination: undefined },
    ];
    const groups = groupConsecutiveByDay(flattenPages(pages), (item) => item.at);
    assert.deepEqual(
      groups.map((group) => [group.day, group.items.map((item) => item.id)]),
      [
        ['2026-09-24', ['a']],
        ['2026-09-23', ['b', 'c']],
        ['2026-09-22', ['d']],
      ],
    );
  });

  it('keeps the incoming order rather than re-sorting', () => {
    const groups = groupConsecutiveByDay(
      [{ at: '2026-09-22T00:00:00.000Z' }, { at: '2026-09-24T00:00:00.000Z' }],
      (item) => item.at,
    );
    assert.deepEqual(groups.map((group) => group.day), ['2026-09-22', '2026-09-24']);
  });

  it('returns no groups for no items', () => {
    assert.deepEqual(groupConsecutiveByDay([], (item: { at: string }) => item.at), []);
  });
});

describe('groupTransactionsByDay', () => {
  it('exposes each group as `transactions`', () => {
    const transaction = { id: 't1', transactionDate: '2026-09-24T12:00:00.000Z' } as TransactionResponse;
    assert.deepEqual(groupTransactionsByDay([transaction]), [{ day: '2026-09-24', transactions: [transaction] }]);
  });
});
