import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateTransactionRequest,
  TransactionQuery,
  UpdateTransactionRequest,
} from '@sora/contracts';

import { queryKeys, TRANSACTION_INVALIDATION_KEYS } from '../../../app/config/queryKeys.ts';
import { transactionsApi } from '../../../services/api/transactions.ts';

export function useTransactions(filters: Partial<TransactionQuery>) {
  return useQuery({
    queryKey: queryKeys.transactions.list(filters),
    queryFn: () => transactionsApi.list(filters),
    enabled: filters.walletId !== undefined || filters.accountId !== undefined,
  });
}

export function useTransaction(transactionId: string | null) {
  return useQuery({
    queryKey: queryKeys.transactions.detail(transactionId ?? ''),
    queryFn: () => transactionsApi.detail(transactionId as string),
    enabled: transactionId !== null,
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateTransactionRequest) => transactionsApi.create(body),
    onSuccess: () => {
      // A transaction moves money and, when it is a transfer, sometimes across
      // a wallet the invalidation keys already cover generically — see the
      // TRANSACTION_INVALIDATION_KEYS doc comment for why all six lists are here.
      for (const key of TRANSACTION_INVALIDATION_KEYS) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
}

/**
 * Only the four mutable fields go through here; amount, type and the accounts
 * are immutable server-side (BR-03), so the edit form never offers them.
 */
export function useUpdateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      transactionId,
      body,
    }: {
      transactionId: string;
      body: UpdateTransactionRequest;
    }) => transactionsApi.update(transactionId, body),
    onSuccess: () => {
      // A re-categorised transaction moves between budget figures, so the same
      // six lists a create invalidates are all affected here too.
      for (const key of TRANSACTION_INVALIDATION_KEYS) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
}

export function useCancelTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ transactionId, reason }: { transactionId: string; reason?: string }) =>
      transactionsApi.cancel(transactionId, reason),
    onSuccess: () => {
      for (const key of TRANSACTION_INVALIDATION_KEYS) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
}
