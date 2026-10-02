import { useEffect } from 'react';
import { useGetDashboardSummaryQuery } from '@/app/store';
import { windowFor, type CalendarDay } from '@/utils';
import type { DashboardResponse } from '@sora/contracts';

export function MonthDataPoint({
  walletId,
  accountId,
  month,
  onSettled,
}: {
  walletId: string;
  accountId: string | null;
  month: CalendarDay;
  onSettled: (month: CalendarDay, data: DashboardResponse | undefined) => void;
}) {
  const query = useGetDashboardSummaryQuery({ walletId, accountId: accountId ?? undefined, ...windowFor('monthly', month) });
  // A month whose query errors still settles (as `undefined`, folded into the
  // chart as a zero point) — waiting on `data` alone would spin forever.
  useEffect(() => {
    if (query.isSuccess || query.isError) onSettled(month, query.data);
  }, [month, query.isSuccess, query.isError, query.data, onSettled]);
  return null;
}
