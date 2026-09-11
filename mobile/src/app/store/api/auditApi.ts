import { ROUTES, apiUrl, type AuditLogResponse } from '@sora/contracts';

import type { ListResult } from '../../../services/api/client.ts';
import { apiSlice } from './apiSlice.ts';

/** API spec §15.1 — OWNER-only, append-only, no update/delete path anywhere. */
export interface AuditLogQuery {
  event?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export const auditApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    listAuditLogs: builder.query<ListResult<AuditLogResponse>, { walletId: string; query?: AuditLogQuery }>({
      query: ({ walletId, query }) => ({
        method: 'getList',
        path: apiUrl(ROUTES.audit.list(walletId)),
        params: query,
      }),
      providesTags: ['AuditLog'],
    }),
  }),
  overrideExisting: __DEV__,
});

export const { useListAuditLogsQuery } = auditApi;
