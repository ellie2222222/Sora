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
  // An errored month still settles (as `undefined`, a zero point) or the chart would spin forever;
  // `currentData`, not `data`, so a switched wallet/account never settles with the previous one's figures.
  useEffect(() => {
    if (query.currentData !== undefined || query.isError) onSettled(month, query.currentData);
  }, [month, query.isError, query.currentData, onSettled]);
  return null;
}
