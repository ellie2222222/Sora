import {
  movesMoney,
  TransactionStatus,
  type CreateTransactionRequest,
  type TransactionQuery,
  type TransactionResponse,
  type UpdateTransactionRequest,
  type WalletResponse,
} from '@sora/contracts';

import { transactionsApi as transactionsHttp, type TransactionPage } from '@/services/api';
import { guestTransactionsApi } from '@/services/guest';
import {
  buildOptimisticEdit,
  buildOptimisticTransaction,
  cachedItems,
  cacheKeyOf,
  sendOrQueue,
  fitsTransactionList,
  forEachCachedQueryArgs,
  isStillQueued,
  ledgerChangeOf,
  newLocalId,
} from '@/services/sync';
import { deviceTimeZone, FIRST_PAGE, nextPageParam } from '@/utils';
import type { RootState } from '../index.ts';
import { selectIsGuest } from '../authSlice.ts';
import { apiSlice, toQueryFnResult } from './apiSlice.ts';
import { readGuestOrApi } from './guestFallback.ts';
import { currentUserId, findCachedTransaction, patchTotalsForTransaction } from './pendingTotalsPatch.ts';

export type { TransactionPage } from '@/services/api';

/** The list filters; paging is owned by the infinite query. */
export type TransactionListArgs = Omit<Partial<TransactionQuery>, 'page' | 'pageSize'>;

const TRANSACTIONS_PAGE_SIZE = 50;

/** A transaction moves money, sometimes across a wallet, and may back a goal contribution — all seven can change. */
const TRANSACTION_TAGS = ['Transaction', 'Account', 'Dashboard', 'Budget', 'Wallet', 'Goal', 'GoalContribution'] as const;

function findInPages(pages: TransactionPage[], transactionId: string): TransactionResponse | undefined {
  for (const page of pages) {
    const item = page.items.find((candidate) => candidate.id === transactionId);
    if (item) return item;
  }
  return undefined;
}

export const transactionsApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    listTransactions: builder.infiniteQuery<TransactionPage, TransactionListArgs, number>({
      infiniteQueryOptions: {
        initialPageParam: FIRST_PAGE,
        getNextPageParam: (lastPage) => nextPageParam(lastPage),
      },
      queryFn: ({ queryArg, pageParam }, { getState, endpoint }) => {
        const isGuest = selectIsGuest(getState() as RootState);
        const query = { ...queryArg, page: pageParam, pageSize: TRANSACTIONS_PAGE_SIZE };
        return toQueryFnResult(() =>
          readGuestOrApi(
            cacheKeyOf(endpoint, queryArg, pageParam),
            isGuest,
            () => transactionsHttp.list(query),
            () => guestTransactionsApi.list(query),
          ),
        );
      },
      providesTags: ['Transaction'],
    }),
    getTransaction: builder.query<TransactionResponse, string>({
      queryFn: (transactionId, { getState, endpoint }) => {
        const isGuest = selectIsGuest(getState() as RootState);
        return toQueryFnResult(() =>
          readGuestOrApi(
            cacheKeyOf(endpoint, transactionId),
            isGuest,
            () => transactionsHttp.detail(transactionId),
            () => guestTransactionsApi.detail(transactionId),
          ),
        );
      },
      providesTags: ['Transaction'],
    }),
    createTransaction: builder.mutation<TransactionResponse, CreateTransactionRequest>({
      queryFn: (body, { getState }) => {
        const state = getState() as RootState;
        if (selectIsGuest(state)) return toQueryFnResult(() => guestTransactionsApi.create(body));
        return toQueryFnResult(async () => {
          const localId = newLocalId();
          return sendOrQueue(
            { entity: 'transaction', op: 'create', localId, serverId: null, payload: body },
            (idempotencyKey) => transactionsHttp.create(body, idempotencyKey),
            () => buildOptimisticTransaction(body, localId, (state as unknown as Record<string, unknown>)[apiSlice.reducerPath]),
          );
        });
      },
      onQueryStarted: async (body, { dispatch, queryFulfilled, getState }) => {
        try {
          const { data } = await queryFulfilled;
          if (!isStillQueued(data.id)) return; // Online/guest path — invalidatesTags already covers it.

          const rootState = getState();
          const wallets = cachedItems<WalletResponse>((rootState as unknown as Record<string, unknown>)[apiSlice.reducerPath], 'listWallets');
          const zoneOf = (walletId: string) => wallets.find((wallet) => wallet.id === walletId)?.timeZone ?? deviceTimeZone();
          forEachCachedQueryArgs(rootState, 'listTransactions', (args) => {
            if (!fitsTransactionList(data, args as TransactionListArgs, zoneOf)) return;
            dispatch(
              transactionsApiSlice.util.updateQueryData('listTransactions', args as TransactionListArgs, (draft) => {
                draft.pages[0]?.items.unshift(data);
                for (const page of draft.pages) {
                  if (page.pagination) page.pagination.total += 1;
                }
              }),
            );
          });
          const accountIds = {
            from: 'fromAccountId' in body ? body.fromAccountId : null,
            to: 'toAccountId' in body ? body.toAccountId : null,
          };
          patchTotalsForTransaction(dispatch, rootState, ledgerChangeOf('create', data, { accountIds, actorUserId: currentUserId() }));
        } catch {
          // Nothing was applied to the cache yet — nothing to undo.
        }
      },
      invalidatesTags: (result) => (result && isStillQueued(result.id) ? [] : TRANSACTION_TAGS),
    }),
    /** Only the changed fields; amount, type, currency or an account makes it a money edit (BR-03). */
    updateTransaction: builder.mutation<TransactionResponse, { transactionId: string; body: UpdateTransactionRequest }>({
      queryFn: ({ transactionId, body }, { getState }) => {
        const state = getState() as RootState;
        if (selectIsGuest(state)) return toQueryFnResult(() => guestTransactionsApi.update(transactionId, body));
        return toQueryFnResult(() =>
          sendOrQueue(
            {
              entity: 'transaction',
              op: 'update',
              localId: transactionId,
              serverId: transactionId,
              payload: body,
            },
            (idempotencyKey) => transactionsHttp.update(transactionId, body, idempotencyKey),
            () => {
              const previous = movesMoney(body) ? findCachedTransaction(state, transactionId) : null;
              const edited = previous && buildOptimisticEdit(previous, body, (state as unknown as Record<string, unknown>)[apiSlice.reducerPath]);
              // Reconciled by onQueryStarted's cache patch below.
              return edited ?? ({ ...body } as unknown as TransactionResponse);
            },
          ),
        );
      },
      onQueryStarted: async ({ transactionId, body }, { dispatch, queryFulfilled, getState }) => {
        // Read before the patches below replace it: reversing a money edit needs the old figures.
        const previous = findCachedTransaction(getState(), transactionId);
        try {
          const { data } = await queryFulfilled;
          if (!isStillQueued(transactionId)) return;

          const edited = previous !== null && data.id === transactionId ? data : null;
          const patchOne = (draft: TransactionResponse) => Object.assign(draft, edited ?? body);
          dispatch(transactionsApiSlice.util.updateQueryData('getTransaction', transactionId, patchOne));

          const rootState = getState();
          forEachCachedQueryArgs(rootState, 'listTransactions', (args) => {
            dispatch(
              transactionsApiSlice.util.updateQueryData('listTransactions', args as TransactionListArgs, (draft) => {
                const item = findInPages(draft.pages, transactionId);
                if (item) Object.assign(item, edited ?? body);
              }),
            );
          });
          if (edited !== null && previous !== null) {
            patchTotalsForTransaction(dispatch, getState(), ledgerChangeOf('cancel', previous, { inPlace: true }));
            patchTotalsForTransaction(dispatch, getState(), ledgerChangeOf('create', edited, { inPlace: true, actorUserId: previous.createdBy.id }));
          }
        } catch {
          // Nothing was applied to the cache yet — nothing to undo.
        }
      },
      invalidatesTags: (_result, _error, { transactionId }) => (isStillQueued(transactionId) ? [] : TRANSACTION_TAGS),
    }),
    deleteTransaction: builder.mutation<TransactionResponse, { transactionId: string; reason?: string }>({
      queryFn: ({ transactionId, reason }, { getState }) => {
        const isGuest = selectIsGuest(getState() as RootState);
        if (isGuest) return toQueryFnResult(() => guestTransactionsApi.delete(transactionId));
        return toQueryFnResult(() =>
          sendOrQueue(
            {
              entity: 'transaction',
              op: 'cancel',
              localId: transactionId,
              serverId: transactionId,
              payload: { reason },
            },
            (idempotencyKey) => transactionsHttp.delete(transactionId, reason, idempotencyKey),
            () => ({ id: transactionId, status: TransactionStatus.DELETED }) as unknown as TransactionResponse,
          ),
        );
      },
      onQueryStarted: async ({ transactionId }, { dispatch, queryFulfilled, getState }) => {
        try {
          await queryFulfilled;
          if (!isStillQueued(transactionId)) return;

          // Read before the patches below mark it deleted.
          const original = findCachedTransaction(getState(), transactionId);
          if (original) patchTotalsForTransaction(dispatch, getState(), ledgerChangeOf('cancel', original));

          const markDeleted = (draft: TransactionResponse) => {
            draft.status = TransactionStatus.DELETED;
          };
          dispatch(transactionsApiSlice.util.updateQueryData('getTransaction', transactionId, markDeleted));

          const rootState = getState();
          forEachCachedQueryArgs(rootState, 'listTransactions', (args) => {
            dispatch(
              transactionsApiSlice.util.updateQueryData('listTransactions', args as TransactionListArgs, (draft) => {
                const item = findInPages(draft.pages, transactionId);
                if (item) item.status = TransactionStatus.DELETED;
              }),
            );
          });
        } catch {
          // Nothing was applied to the cache yet — nothing to undo.
        }
      },
      invalidatesTags: (_result, _error, { transactionId }) => (isStillQueued(transactionId) ? [] : TRANSACTION_TAGS),
    }),
  }),
  overrideExisting: __DEV__,
});

export const {
  useListTransactionsInfiniteQuery,
  useGetTransactionQuery,
  useCreateTransactionMutation,
  useUpdateTransactionMutation,
  useDeleteTransactionMutation,
} = transactionsApiSlice;
