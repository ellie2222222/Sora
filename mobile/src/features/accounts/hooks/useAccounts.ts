import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateAccountRequest } from '@sora/contracts';

import { ACCOUNT_INVALIDATION_KEYS, queryKeys, type AccountListParams } from '../../../app/config/queryKeys.ts';
import { accountsApi } from '../../../services/api/accounts.ts';

export function useAccounts(params: AccountListParams = {}) {
  return useQuery({
    queryKey: queryKeys.accounts.list(params),
    queryFn: () => accountsApi.list(params),
  });
}

export function useAccount(accountId: string | null) {
  return useQuery({
    queryKey: queryKeys.accounts.detail(accountId ?? ''),
    queryFn: () => accountsApi.detail(accountId as string),
    enabled: accountId !== null,
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateAccountRequest) => accountsApi.create(body),
    onSuccess: () => {
      for (const key of ACCOUNT_INVALIDATION_KEYS) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
}

export function useArchiveAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (accountId: string) => accountsApi.archive(accountId),
    onSuccess: () => {
      for (const key of ACCOUNT_INVALIDATION_KEYS) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
}
