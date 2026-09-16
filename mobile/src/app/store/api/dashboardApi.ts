import type { DashboardQuery, DashboardResponse } from '@sora/contracts';

import { dashboardApi as dashboardHttp } from '@/services/api';
import { ensureSeeded, guestDashboardApi } from '@/services/guest';
import { isCurrentlyOnline, setCurrentlyOnline } from '@/services/sync';
import { isNetworkError } from '../../../utils/errors.ts';
import type { RootState } from '../index.ts';
import { selectIsGuest } from '../authSlice.ts';
import { apiSlice, toQueryFnResult } from './apiSlice.ts';

export const dashboardApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getDashboardSummary: builder.query<DashboardResponse, DashboardQuery>({
      queryFn: (query, { getState }) => {
        const isGuest = selectIsGuest(getState() as RootState);
        return toQueryFnResult(async () => {
          if (isGuest || !isCurrentlyOnline()) {
            await ensureSeeded();
            return guestDashboardApi.summary(query);
          }
          try {
            return await dashboardHttp.summary(query);
          } catch (err) {
            if (isNetworkError(err)) {
              setCurrentlyOnline(false);
              await ensureSeeded();
              return guestDashboardApi.summary(query);
            }
            throw err;
          }
        });
      },
      providesTags: ['Dashboard'],
    }),
  }),
  overrideExisting: __DEV__,
});

export const { useGetDashboardSummaryQuery } = dashboardApiSlice;
