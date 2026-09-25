import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { canLoadMore, completePage, flattenPages, nextPageParam, totalOf, type PagedItems } from './pagination.ts';

function page(ids: string[], pageNumber: number, total: number, hasMore: boolean): PagedItems<{ id: string }> {
  return { items: ids.map((id) => ({ id })), pagination: { page: pageNumber, pageSize: ids.length, total, hasMore } };
}

describe('nextPageParam', () => {
  it('advances while the server reports more', () => {
    assert.equal(nextPageParam(page(['a'], 1, 3, true)), 2);
    assert.equal(nextPageParam(page(['b'], 2, 3, true)), 3);
  });

  it('stops on the last page', () => {
    assert.equal(nextPageParam(page(['c'], 3, 3, false)), undefined);
  });

  it('stops when a page carries no pagination meta', () => {
    assert.equal(nextPageParam({ items: [], pagination: undefined }), undefined);
  });
});

describe('flattenPages', () => {
  it('concatenates pages in order', () => {
    const ids = flattenPages([page(['a', 'b'], 1, 4, true), page(['c', 'd'], 2, 4, false)]).map((item) => item.id);
    assert.deepEqual(ids, ['a', 'b', 'c', 'd']);
  });

  it('keeps only the first occurrence of a row repeated by a shifted offset', () => {
    const ids = flattenPages([page(['a', 'b'], 1, 5, true), page(['b', 'c'], 2, 5, true)]).map((item) => item.id);
    assert.deepEqual(ids, ['a', 'b', 'c']);
  });

  it('returns an empty list before any page has loaded', () => {
    assert.deepEqual(flattenPages(undefined), []);
  });
});

describe('completePage', () => {
  it('wraps an unpaged source as a single last page', () => {
    const wrapped = completePage([{ id: 'a' }, { id: 'b' }]);
    assert.deepEqual(wrapped.pagination, { page: 1, pageSize: 2, total: 2, hasMore: false });
    assert.equal(nextPageParam(wrapped), undefined);
  });
});

describe('totalOf', () => {
  it("reads the most recent page's total", () => {
    assert.equal(totalOf([page(['a'], 1, 3, true), page(['b'], 2, 4, true)]), 4);
  });

  it('is undefined with no pages or no meta', () => {
    assert.equal(totalOf(undefined), undefined);
    assert.equal(totalOf([{ items: [], pagination: undefined }]), undefined);
  });
});

describe('canLoadMore', () => {
  it('only when more pages exist and nothing is in flight or failed', () => {
    assert.equal(canLoadMore({ hasNextPage: true, isFetching: false, isError: false }), true);
    assert.equal(canLoadMore({ hasNextPage: false, isFetching: false, isError: false }), false);
    assert.equal(canLoadMore({ hasNextPage: true, isFetching: true, isError: false }), false);
    assert.equal(canLoadMore({ hasNextPage: true, isFetching: false, isError: true }), false);
  });
});
