/**
 * Page bookkeeping for RTK Query infinite queries over API-05's 1-based
 * `?page&pageSize` lists (`ListResult`/`TransactionPage` shapes).
 */

import type { PaginationMeta } from '@sora/contracts';

export interface PagedItems<T> {
  items: T[];
  pagination: PaginationMeta | undefined;
}

export const FIRST_PAGE = 1;

/** A page with no pagination meta is treated as the last one rather than asked for a next page. */
export function nextPageParam(lastPage: PagedItems<unknown>): number | undefined {
  const pagination = lastPage.pagination;
  if (pagination === undefined || !pagination.hasMore) return undefined;
  return pagination.page + 1;
}

/**
 * Offset paging can hand back a row a second time when rows are inserted
 * between page fetches; the first occurrence wins so each id renders once.
 */
export function flattenPages<T extends { id: string }>(pages: readonly PagedItems<T>[] | undefined): T[] {
  if (pages === undefined) return [];
  const seen = new Set<string>();
  const items: T[] = [];
  for (const page of pages) {
    for (const item of page.items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      items.push(item);
    }
  }
  return items;
}

/** Wraps an unpaged source (the guest store returns everything) as one complete page. */
export function completePage<T>(items: T[]): PagedItems<T> {
  return {
    items,
    pagination: { page: FIRST_PAGE, pageSize: items.length, total: items.length, hasMore: false },
  };
}

/** The server's count of the whole filtered set, as of the most recently fetched page. */
export function totalOf(pages: readonly PagedItems<unknown>[] | undefined): number | undefined {
  return pages?.[pages.length - 1]?.pagination?.total;
}

export interface LoadMoreState {
  hasNextPage: boolean;
  isFetching: boolean;
  isError: boolean;
}

/**
 * `onEndReached` fires repeatedly while the list sits at its end, so a fetch
 * already in flight or a failed one (retried explicitly from the footer) must
 * not trigger another.
 */
export function canLoadMore({ hasNextPage, isFetching, isError }: LoadMoreState): boolean {
  return hasNextPage && !isFetching && !isError;
}
