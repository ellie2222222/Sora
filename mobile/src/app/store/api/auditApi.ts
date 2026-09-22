import { ROUTES, apiUrl, type AuditLogResponse } from '@sora/contracts';
import { getList, type ListResult } from '@/services/api';
import { isCurrentlyOnline, setCurrentlyOnline } from '@/services/sync';
import { isNetworkError } from '@/utils';
import { apiSlice, toQueryFnResult } from './apiSlice.ts';

/** API spec §15.1 — OWNER-only, append-only, no update/delete path anywhere. */
export interface AuditLogQuery {
  event?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

const EMPTY_AUDIT_LOGS: ListResult<AuditLogResponse> = {
  items: [],
  pagination: undefined,
};

export const auditApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    listAuditLogs: builder.query<ListResult<AuditLogResponse>, { walletId: string; query?: AuditLogQuery }>({
      queryFn: ({ walletId, query }) =>
        toQueryFnResult(async () => {
          if (!isCurrentlyOnline()) return EMPTY_AUDIT_LOGS;
          try {
            return (await getList(apiUrl(ROUTES.audit.list(walletId)), query)) as ListResult<AuditLogResponse>;
          } catch (err) {
            if (isNetworkError(err)) {
              setCurrentlyOnline(false);
              return EMPTY_AUDIT_LOGS;
            }
            throw err;
          }
        }),
      providesTags: ['AuditLog'],
    }),
  }),
  overrideExisting: __DEV__,
});

export const { useListAuditLogsQuery } = auditApi;
