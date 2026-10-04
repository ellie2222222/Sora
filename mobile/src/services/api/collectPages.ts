import type { PaginationMeta } from '@sora/contracts';

export interface Page<T> {
  items: T[];
  pagination: PaginationMeta | undefined;
}

/**
 * Fetches page 1, 2, … until the server says there is no more; a response without pagination is the whole list.
 * An empty page also ends it, so a server that keeps answering `hasMore` can't loop this forever.
 */
export async function collectPages<T>(fetchPage: (page: number) => Promise<Page<T>>): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; ; page += 1) {
    const result = await fetchPage(page);
    items.push(...result.items);
    if (!result.pagination?.hasMore || result.items.length === 0) return items;
  }
}
