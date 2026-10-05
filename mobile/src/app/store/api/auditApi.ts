import { ROUTES, apiUrl, type AuditLogResponse } from '@sora/contracts';
import { getList, type ListResult } from '@/services/api';
import { cacheKeyOf } from '@/services/sync';
import { FIRST_PAGE, nextPageParam } from '@/utils';
import { apiSlice, toQueryFnResult } from './apiSlice.ts';
import { readSignedInCached } from './guestFallback.ts';

/** API spec §15.1 — OWNER-only, append-only, no update/delete path anywhere. */
export interface AuditLogQuery {
  event?: string;
  dateFrom?: string;
  dateTo?: string;
}

const AUDIT_LOG_PAGE_SIZE = 50;

export const auditApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    listAuditLogs: builder.infiniteQuery<
      ListResult<AuditLogResponse>,
      { walletId: string; query?: AuditLogQuery },
      number
    >({
      infiniteQueryOptions: {
        initialPageParam: FIRST_PAGE,
        getNextPageParam: (lastPage) => nextPageParam(lastPage),
      },
      queryFn: ({ queryArg, pageParam }, { endpoint }) => {
        const { walletId, query } = queryArg;
        return toQueryFnResult(() =>
          readSignedInCached<ListResult<AuditLogResponse>>(
            cacheKeyOf(endpoint, queryArg, pageParam),
            async () =>
              (await getList(apiUrl(ROUTES.audit.list(walletId)), {
                ...query,
                page: pageParam,
                pageSize: AUDIT_LOG_PAGE_SIZE,
              })) as ListResult<AuditLogResponse>,
          ),
        );
      },
      providesTags: ['AuditLog'],
    }),
  }),
  overrideExisting: __DEV__,
});

export const { useListAuditLogsInfiniteQuery } = auditApi;
