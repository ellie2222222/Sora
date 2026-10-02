import type { DashboardResponse } from '@sora/contracts';
import type { CalendarDay } from '@/utils';

export function yearOf(
  months: readonly CalendarDay[],
  byMonth: Record<CalendarDay, DashboardResponse | undefined>,
  reference: DashboardResponse,
) {
  const loaded = months
    .map((month) => byMonth[month])
    .filter((response): response is DashboardResponse => response !== undefined);

  return {
    totalBalance: reference.totalBalance,
    recentTransactions: reference.recentTransactions,
    income: loaded.flatMap((response) => response.income),
    expense: loaded.flatMap((response) => response.expense),
    transferredIn: loaded.flatMap((response) => response.transferredIn),
    transferredOut: loaded.flatMap((response) => response.transferredOut),
  };
}

export function monthsOfYear(year: number): CalendarDay[] {
  return Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, '0')}-01`);
}
