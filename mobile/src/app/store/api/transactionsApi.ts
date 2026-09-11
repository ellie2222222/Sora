import type { CreateTransactionRequest, TransactionQuery, TransactionResponse, UpdateTransactionRequest } from '@sora/contracts';

import { transactionsApi as transactionsHttp, type TransactionPage } from '../../../services/api/transactions.ts';
import { guestTransactionsApi } from '../../../services/guest/guestTransactions.ts';
import type { RootState } from '../index.ts';
import { selectIsGuest } from '../authSlice.ts';
import { apiSlice, toQueryFnResult } from './apiSlice.ts';

export type { TransactionPage } from '../../../services/api/transactions.ts';

/** A transaction moves money and, when it is a transfer, sometimes across a wallet — all six can change. */
const TRANSACTION_TAGS = ['Transaction', 'Account', 'Dashboard', 'Budget', 'Wallet', 'Goal'] as const;

export const transactionsApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    listTransactions: builder.query<TransactionPage, Partial<TransactionQuery>>({
      queryFn: (query, { getState }) => {
        const isGuest = selectIsGuest(getState() as RootState);
        return toQueryFnResult(() => (isGuest ? guestTransactionsApi.list(query) : transactionsHttp.list(query)));
      },
      providesTags: ['Transaction'],
    }),
    getTransaction: builder.query<TransactionResponse, string>({
      queryFn: (transactionId, { getState }) => {
        const isGuest = selectIsGuest(getState() as RootState);
        return toQueryFnResult(() =>
          isGuest ? guestTransactionsApi.detail(transactionId) : transactionsHttp.detail(transactionId),
        );
      },
      providesTags: ['Transaction'],
    }),
    createTransaction: builder.mutation<TransactionResponse, CreateTransactionRequest>({
      queryFn: (body, { getState }) => {
        const isGuest = selectIsGuest(getState() as RootState);
        return toQueryFnResult(() => (isGuest ? guestTransactionsApi.create(body) : transactionsHttp.create(body)));
      },
      invalidatesTags: TRANSACTION_TAGS,
    }),
    /** Only the four mutable fields (BR-03) — amount, type and accounts are immutable server-side. */
    updateTransaction: builder.mutation<TransactionResponse, { transactionId: string; body: UpdateTransactionRequest }>({
      queryFn: ({ transactionId, body }, { getState }) => {
        const isGuest = selectIsGuest(getState() as RootState);
        return toQueryFnResult(() =>
          isGuest ? guestTransactionsApi.update(transactionId, body) : transactionsHttp.update(transactionId, body),
        );
      },
      invalidatesTags: TRANSACTION_TAGS,
    }),
    cancelTransaction: builder.mutation<TransactionResponse, { transactionId: string; reason?: string }>({
      queryFn: ({ transactionId, reason }, { getState }) => {
        const isGuest = selectIsGuest(getState() as RootState);
        return toQueryFnResult(() =>
          isGuest ? guestTransactionsApi.cancel(transactionId) : transactionsHttp.cancel(transactionId, reason),
        );
      },
      invalidatesTags: TRANSACTION_TAGS,
    }),
  }),
  overrideExisting: __DEV__,
});

export const {
  useListTransactionsQuery,
  useGetTransactionQuery,
  useCreateTransactionMutation,
  useUpdateTransactionMutation,
  useCancelTransactionMutation,
} = transactionsApiSlice;
