/**
 * Day-grouped lists (plan §13).
 *
 * Groups consecutive same-day rows rather than bucketing into a map, so the
 * server's `sortBy` ordering is preserved exactly — re-sorting on the client
 * would silently override a user who asked for oldest-first or largest-first.
 */

import type { TransactionResponse } from '@sora/contracts';
import { dayOfInstant, type CalendarDay, type Instant } from './date.ts';

export interface DayBucket<T> {
  day: CalendarDay;
  items: T[];
}

export function groupConsecutiveByDay<T>(items: readonly T[], instantOf: (item: T) => Instant): DayBucket<T>[] {
  const groups: DayBucket<T>[] = [];

  for (const item of items) {
    const day = dayOfInstant(instantOf(item));
    const current = groups[groups.length - 1];
    if (current !== undefined && current.day === day) {
      current.items.push(item);
    } else {
      groups.push({ day, items: [item] });
    }
  }

  return groups;
}

export interface DayGroup {
  day: CalendarDay;
  transactions: TransactionResponse[];
}

export function groupTransactionsByDay(
  transactions: readonly TransactionResponse[],
): DayGroup[] {
  return groupConsecutiveByDay(transactions, (transaction) => transaction.transactionDate).map(({ day, items }) => ({
    day,
    transactions: items,
  }));
}
