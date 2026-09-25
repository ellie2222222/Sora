import type { DashboardQuery, DashboardResponse } from '@sora/contracts';

import { dashboardApi as dashboardHttp } from '@/services/api';
import { guestDashboardApi } from '@/services/guest';
import type { RootState } from '../index.ts';
import { selectIsGuest } from '../authSlice.ts';
import { apiSlice, toQueryFnResult } from './apiSlice.ts';
import { cacheKeyOf } from '@/services/sync';
import { readGuestOrApi } from './guestFallback.ts';

export const dashboardApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getDashboardSummary: builder.query<DashboardResponse, DashboardQuery>({
      queryFn: (query, { getState, endpoint }) => {
        const isGuest = selectIsGuest(getState() as RootState);
        return toQueryFnResult(() =>
          readGuestOrApi(
            cacheKeyOf(endpoint, query),
            isGuest,
            () => dashboardHttp.summary(query),
            () => guestDashboardApi.summary(query),
          ),
        );
      },
      providesTags: ['Dashboard'],
    }),
  }),
  overrideExisting: __DEV__,
});

export const { useGetDashboardSummaryQuery } = dashboardApiSlice;
