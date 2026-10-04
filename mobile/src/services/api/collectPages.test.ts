import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { collectPages, type Page } from './collectPages.ts';

function pagesOf(all: string[], pageSize: number) {
  const requested: number[] = [];
  const fetchPage = async (page: number): Promise<Page<string>> => {
    requested.push(page);
    const items = all.slice((page - 1) * pageSize, page * pageSize);
    return { items, pagination: { page, pageSize, total: all.length, hasMore: page * pageSize < all.length } };
  };
  return { fetchPage, requested };
}

describe('collectPages', () => {
  it('follows hasMore until the last page, in order', async () => {
    const all = ['a', 'b', 'c', 'd', 'e'];
    const { fetchPage, requested } = pagesOf(all, 2);

    assert.deepEqual(await collectPages(fetchPage), all);
    assert.deepEqual(requested, [1, 2, 3]);
  });

  it('stops after one request when everything fits on the first page', async () => {
    const { fetchPage, requested } = pagesOf(['a'], 200);

    assert.deepEqual(await collectPages(fetchPage), ['a']);
    assert.deepEqual(requested, [1]);
  });

  it('treats a response without pagination as the whole list', async () => {
    let calls = 0;
    const items = await collectPages(async () => {
      calls += 1;
      return { items: ['a', 'b'], pagination: undefined };
    });

    assert.deepEqual(items, ['a', 'b']);
    assert.equal(calls, 1);
  });

  it('stops at an empty page even if the server still says there is more', async () => {
    const requested: number[] = [];
    const items = await collectPages(async (page) => {
      requested.push(page);
      return { items: page === 1 ? ['a'] : [], pagination: { page, pageSize: 1, total: 5, hasMore: true } };
    });

    assert.deepEqual(items, ['a']);
    assert.deepEqual(requested, [1, 2]);
  });
});
