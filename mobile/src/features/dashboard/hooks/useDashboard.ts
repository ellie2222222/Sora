import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '../../../app/config/queryKeys.ts';
import { dashboardApi } from '../../../services/api/dashboard.ts';
import { startOfMonth, endOfMonth, today } from '../../../utils/date.ts';

export function useDashboard(walletId: string | null) {
  const dateFrom = startOfMonth(today());
  const dateTo = endOfMonth(today());

  return useQuery({
    queryKey: queryKeys.dashboard.summary({ walletId: walletId ?? '', dateFrom, dateTo }),
    queryFn: () => dashboardApi.summary({ walletId: walletId as string, dateFrom, dateTo }),
    enabled: walletId !== null,
  });
}
