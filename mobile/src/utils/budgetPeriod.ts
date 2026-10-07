import type { BudgetResponse } from '@sora/contracts';

import { endOfMonth, formatDay, formatMonthYear, formatShortDay, parseDay } from './date.ts';

/**
 * The period a budget's figures cover, as a person would name it: "Oct 2026" for a calendar month,
 * "2026" for a calendar year, the day for a single day, otherwise the range.
 */
export function budgetPeriodLabel(budget: Pick<BudgetResponse, 'periodStart' | 'periodEnd'>, locale?: string): string {
  const { periodStart: start, periodEnd: end } = budget;
  if (start === end) return formatDay(start, locale);
  const from = parseDay(start);
  if (from.date === 1 && end === endOfMonth(start)) return formatMonthYear(start, locale);
  if (from.month === 1 && from.date === 1 && end === `${from.year}-12-31`) return String(from.year);
  return `${formatShortDay(start, locale)} – ${formatShortDay(end, locale)}`;
}
