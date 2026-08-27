/**
 * Day-grouped transaction list (plan §13).
 *
 * Groups consecutive same-day rows rather than bucketing into a map, so the
 * server's `sortBy` ordering is preserved exactly — re-sorting on the client
 * would silently override a user who asked for oldest-first or largest-first.
 */

import type { TransactionResponse } from '@sora/contracts';
import { dayOfInstant, type CalendarDay } from './date.ts';

export interface DayGroup {
  day: CalendarDay;
  transactions: TransactionResponse[];
}

export function groupTransactionsByDay(
  transactions: readonly TransactionResponse[],
): DayGroup[] {
  const groups: DayGroup[] = [];

  for (const transaction of transactions) {
    const day = dayOfInstant(transaction.transactionDate);
    const current = groups[groups.length - 1];
    if (current !== undefined && current.day === day) {
      current.transactions.push(transaction);
    } else {
      groups.push({ day, transactions: [transaction] });
    }
  }

  return groups;
}
