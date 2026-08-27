import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateWalletRequest } from '@sora/contracts';

import { queryKeys } from '../../../app/config/queryKeys.ts';
import { walletsApi } from '../../../services/api/wallets.ts';

export function useWalletDetail(walletId: string | null) {
  return useQuery({
    queryKey: queryKeys.wallets.detail(walletId ?? ''),
    queryFn: () => walletsApi.detail(walletId as string),
    enabled: walletId !== null,
  });
}

export function useCreateWallet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateWalletRequest) => walletsApi.create(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.wallets.root() });
    },
  });
}

export function useArchiveWallet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (walletId: string) => walletsApi.archive(walletId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.wallets.root() });
    },
  });
}
