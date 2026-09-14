import { TransactionStatus, type CreateTransactionRequest, type TransactionQuery, type TransactionResponse, type UpdateTransactionRequest } from '@sora/contracts';

import { transactionsApi as transactionsHttp, type TransactionPage } from '../../../services/api/transactions.ts';
import { guestTransactionsApi } from '../../../services/guest/guestTransactions.ts';
import { forEachCachedQueryArgs } from '../../../services/sync/cacheLookup.ts';
import { enqueueOffline, isStillQueued, newLocalId } from '../../../services/sync/offlineEnqueue.ts';
import { isCurrentlyOnline } from '../../../services/sync/networkState.ts';
import { buildOptimisticTransaction } from '../../../services/sync/optimisticRecords.ts';
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
        const state = getState() as RootState;
        if (selectIsGuest(state)) return toQueryFnResult(() => guestTransactionsApi.create(body));
        if (!isCurrentlyOnline()) {
          return toQueryFnResult(async () => {
            const localId = newLocalId();
            await enqueueOffline({ entity: 'transaction', op: 'create', localId, serverId: null, payload: body });
            return buildOptimisticTransaction(body, localId, (state as unknown as Record<string, unknown>)[apiSlice.reducerPath]);
          });
        }
        return toQueryFnResult(() => transactionsHttp.create(body));
      },
      onQueryStarted: async (_body, { dispatch, queryFulfilled, getState }) => {
        try {
          const { data } = await queryFulfilled;
          if (!isStillQueued(data.id)) return; // Online/guest path — invalidatesTags already covers it.

          const rootState = getState();
          forEachCachedQueryArgs(rootState, 'listTransactions', (args) => {
            dispatch(
              transactionsApiSlice.util.updateQueryData('listTransactions', args as Partial<TransactionQuery>, (draft) => {
                draft.items.unshift(data);
                if (draft.pagination) draft.pagination.total += 1;
              }),
            );
          });
        } catch {
          // Nothing was applied to the cache yet — nothing to undo.
        }
      },
      invalidatesTags: (result) => (result && isStillQueued(result.id) ? [] : TRANSACTION_TAGS),
    }),
    /** Only the four mutable fields (BR-03) — amount, type and accounts are immutable server-side. */
    updateTransaction: builder.mutation<TransactionResponse, { transactionId: string; body: UpdateTransactionRequest }>({
      queryFn: ({ transactionId, body }, { getState }) => {
        const isGuest = selectIsGuest(getState() as RootState);
        if (isGuest) return toQueryFnResult(() => guestTransactionsApi.update(transactionId, body));
        if (!isCurrentlyOnline()) {
          return toQueryFnResult(async () => {
            await enqueueOffline({
              entity: 'transaction',
              op: 'update',
              localId: transactionId,
              serverId: transactionId,
              payload: body,
            });
            return { ...body } as unknown as TransactionResponse; // Reconciled by onQueryStarted's cache patch below.
          });
        }
        return toQueryFnResult(() => transactionsHttp.update(transactionId, body));
      },
      onQueryStarted: async ({ transactionId, body }, { dispatch, queryFulfilled, getState }) => {
        try {
          await queryFulfilled;
          if (!isStillQueued(transactionId)) return;

          const patchOne = (draft: TransactionResponse) => Object.assign(draft, body);
          dispatch(transactionsApiSlice.util.updateQueryData('getTransaction', transactionId, patchOne));

          const rootState = getState();
          forEachCachedQueryArgs(rootState, 'listTransactions', (args) => {
            dispatch(
              transactionsApiSlice.util.updateQueryData('listTransactions', args as Partial<TransactionQuery>, (draft) => {
                const item = draft.items.find((candidate) => candidate.id === transactionId);
                if (item) Object.assign(item, body);
              }),
            );
          });
        } catch {
          // Offline `enqueueOffline` cannot itself reject — nothing to undo.
        }
      },
      invalidatesTags: (_result, _error, { transactionId }) => (isStillQueued(transactionId) ? [] : TRANSACTION_TAGS),
    }),
    cancelTransaction: builder.mutation<TransactionResponse, { transactionId: string; reason?: string }>({
      queryFn: ({ transactionId, reason }, { getState }) => {
        const isGuest = selectIsGuest(getState() as RootState);
        if (isGuest) return toQueryFnResult(() => guestTransactionsApi.cancel(transactionId));
        if (!isCurrentlyOnline()) {
          return toQueryFnResult(async () => {
            await enqueueOffline({
              entity: 'transaction',
              op: 'cancel',
              localId: transactionId,
              serverId: transactionId,
              payload: { reason },
            });
            return { id: transactionId, status: TransactionStatus.CANCELLED } as unknown as TransactionResponse;
          });
        }
        return toQueryFnResult(() => transactionsHttp.cancel(transactionId, reason));
      },
      onQueryStarted: async ({ transactionId }, { dispatch, queryFulfilled, getState }) => {
        try {
          await queryFulfilled;
          if (!isStillQueued(transactionId)) return;

          const markCancelled = (draft: TransactionResponse) => {
            draft.status = TransactionStatus.CANCELLED;
          };
          dispatch(transactionsApiSlice.util.updateQueryData('getTransaction', transactionId, markCancelled));

          const rootState = getState();
          forEachCachedQueryArgs(rootState, 'listTransactions', (args) => {
            dispatch(
              transactionsApiSlice.util.updateQueryData('listTransactions', args as Partial<TransactionQuery>, (draft) => {
                const item = draft.items.find((candidate) => candidate.id === transactionId);
                if (item) item.status = TransactionStatus.CANCELLED;
              }),
            );
          });
        } catch {
          // Offline `enqueueOffline` cannot itself reject — nothing to undo.
        }
      },
      invalidatesTags: (_result, _error, { transactionId }) => (isStillQueued(transactionId) ? [] : TRANSACTION_TAGS),
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
