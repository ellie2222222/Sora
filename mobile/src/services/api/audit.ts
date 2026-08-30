import { ROUTES, apiUrl, type AuditLogResponse } from '@sora/contracts';

import { getList, type ListResult } from './client.ts';

/** API spec §15.1 — OWNER-only, append-only, no update/delete path anywhere. */
export interface AuditLogQuery {
  event?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export const auditApi = {
  list(walletId: string, query: AuditLogQuery = {}): Promise<ListResult<AuditLogResponse>> {
    return getList<AuditLogResponse>(apiUrl(ROUTES.audit.list(walletId)), query);
  },
};
