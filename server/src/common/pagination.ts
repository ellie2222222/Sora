import { z } from 'zod';

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, type PaginationMeta } from '@sora/contracts';

/** API-05's `?page&pageSize`, spread into a list endpoint's own query schema. */
export const pageQuery = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
};

export interface PageQuery {
  page: number;
  pageSize: number;
}

export function offsetOf(query: PageQuery): number {
  return (query.page - 1) * query.pageSize;
}

export function paginationMeta(page: number, pageSize: number, total: number): PaginationMeta {
  return { page, pageSize, total, hasMore: page * pageSize < total };
}

export interface SortKey {
  column: string;
  direction: 'asc' | 'desc';
}

/**
 * Parse `?sortBy=-transactionDate,amount` against an allowlist.
 *
 * The allowlist maps a request-facing key to a real column: interpolating a
 * client string into ORDER BY would be an injection, and an unknown key is
 * dropped rather than rejected so a client shipping a newer sort key degrades
 * to the default instead of failing every list request.
 */
export function parseSort(
  sortBy: string,
  allowed: Record<string, string>,
  fallback: SortKey,
): SortKey[] {
  const keys: SortKey[] = [];

  for (const raw of sortBy.split(',')) {
    const trimmed = raw.trim();
    if (trimmed.length === 0) continue;

    const descending = trimmed.startsWith('-');
    const name = descending ? trimmed.slice(1) : trimmed;
    const column = allowed[name];
    if (!column) continue;

    keys.push({ column, direction: descending ? 'desc' : 'asc' });
  }

  return keys.length > 0 ? keys : [fallback];
}
