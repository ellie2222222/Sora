import { useQuery } from '@tanstack/react-query';

import { queryKeys, type AuditLogListParams } from '../../../app/config/queryKeys.ts';
import { auditApi } from '../../../services/api/audit.ts';

/** WAL-US-13 — read the append-only audit trail. OWNER-only; the API rejects anyone else with a 403. */
export function useWalletActivity(walletId: string, params: AuditLogListParams = {}) {
  return useQuery({
    queryKey: queryKeys.wallets.auditLogs(walletId, params),
    queryFn: () => auditApi.list(walletId, params),
  });
}
