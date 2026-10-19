import {
  AccountStatus,
  type AccountDetailResponse,
  type AccountResponse,
  type CreateAccountRequest,
  type UpdateAccountRequest,
} from '@sora/contracts';

import { accountsApi as accountsHttp, type AccountListQuery } from '@/services/api';
import { guestAccountsApi } from '@/services/guest';
import { buildOptimisticAccount, cacheKeyOf, sendOrQueue, fitsListFilters, forEachCachedQueryArgs, isStillQueued, newLocalId } from '@/services/sync';
import type { RootState } from '../index.ts';
import { selectIsGuest } from '../authSlice.ts';
import { apiSlice, toQueryFnResult } from './apiSlice.ts';
import { readGuestOrApi } from './guestFallback.ts';
import { patchTotalsForNewAccount } from './pendingTotalsPatch.ts';

export type { AccountListQuery } from '@/services/api';

const ACCOUNT_TAGS = ['Account', 'Wallet', 'Dashboard'] as const;

export const accountsApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    listAccounts: builder.query<AccountResponse[], AccountListQuery>({
      queryFn: (query, { getState, endpoint }) => {
        const isGuest = selectIsGuest(getState() as RootState);
        return toQueryFnResult(() =>
          readGuestOrApi(
            cacheKeyOf(endpoint, query),
            isGuest,
            () => accountsHttp.list(query),
            () => guestAccountsApi.list(query),
          ),
        );
      },
      providesTags: ['Account'],
    }),
    getAccount: builder.query<AccountDetailResponse, string>({
      queryFn: (accountId, { getState, endpoint }) => {
        const isGuest = selectIsGuest(getState() as RootState);
        return toQueryFnResult(() =>
          readGuestOrApi(
            cacheKeyOf(endpoint, accountId),
            isGuest,
            () => accountsHttp.detail(accountId),
            () => guestAccountsApi.detail(accountId),
          ),
        );
      },
      providesTags: ['Account'],
    }),
    createAccount: builder.mutation<AccountResponse, CreateAccountRequest>({
      queryFn: (body, { getState }) => {
        const isGuest = selectIsGuest(getState() as RootState);
        if (isGuest) return toQueryFnResult(() => guestAccountsApi.create(body));
        return toQueryFnResult(async () => {
          const localId = newLocalId();
          return sendOrQueue(
            { entity: 'account', op: 'create', localId, serverId: null, payload: body },
            (idempotencyKey) => accountsHttp.create(body, idempotencyKey),
            () => buildOptimisticAccount(body, localId),
          );
        });
      },
      onQueryStarted: async (_body, { dispatch, queryFulfilled, getState }) => {
        try {
          const { data } = await queryFulfilled;
          if (!isStillQueued(data.id)) return;

          const rootState = getState();
          forEachCachedQueryArgs(rootState, 'listAccounts', (args) => {
            if (!fitsListFilters(data, args)) return;
            dispatch(
              accountsApiSlice.util.updateQueryData('listAccounts', args as AccountListQuery, (draft) => {
                draft.unshift(data);
              }),
            );
          });
          patchTotalsForNewAccount(dispatch, rootState, data);
        } catch {
          // Nothing was applied to the cache yet — nothing to undo.
        }
      },
      invalidatesTags: (result) => (result && isStillQueued(result.id) ? [] : ACCOUNT_TAGS),
    }),
    updateAccount: builder.mutation<AccountResponse, { accountId: string; body: UpdateAccountRequest }>({
      queryFn: ({ accountId, body }, { getState }) => {
        if (selectIsGuest(getState() as RootState)) return toQueryFnResult(() => guestAccountsApi.update(accountId, body));
        return toQueryFnResult(() =>
          sendOrQueue(
            { entity: 'account', op: 'update', localId: accountId, serverId: accountId, payload: body },
            (idempotencyKey) => accountsHttp.update(accountId, body, idempotencyKey),
            () => ({ ...body }) as unknown as AccountResponse, // Reconciled by onQueryStarted's cache patch below.
          ),
        );
      },
      onQueryStarted: async ({ accountId, body }, { dispatch, queryFulfilled, getState }) => {
        try {
          await queryFulfilled;
          if (!isStillQueued(accountId)) return;

          dispatch(accountsApiSlice.util.updateQueryData('getAccount', accountId, (draft) => Object.assign(draft, body)));
          forEachCachedQueryArgs(getState(), 'listAccounts', (args) => {
            dispatch(
              accountsApiSlice.util.updateQueryData('listAccounts', args as AccountListQuery, (draft) => {
                const item = draft.find((candidate) => candidate.id === accountId);
                if (item) Object.assign(item, body);
              }),
            );
          });
        } catch {
          // Nothing was applied to the cache yet — nothing to undo.
        }
      },
      invalidatesTags: (_result, _error, { accountId }) => (isStillQueued(accountId) ? [] : ACCOUNT_TAGS),
    }),
    archiveAccount: builder.mutation<void, string>({
      queryFn: (accountId, { getState }) => {
        const isGuest = selectIsGuest(getState() as RootState);
        if (isGuest) return toQueryFnResult(() => guestAccountsApi.archive(accountId));
        return toQueryFnResult(() =>
          sendOrQueue(
            { entity: 'account', op: 'archive', localId: accountId, serverId: accountId, payload: {} },
            (idempotencyKey) => accountsHttp.archive(accountId, idempotencyKey),
            () => undefined,
          ),
        );
      },
      onQueryStarted: async (accountId, { dispatch, queryFulfilled, getState }) => {
        try {
          await queryFulfilled;
          if (!isStillQueued(accountId)) return;

          const rootState = getState();
          dispatch(accountsApiSlice.util.updateQueryData('getAccount', accountId, (draft) => {
            draft.status = AccountStatus.ARCHIVED;
          }));
          forEachCachedQueryArgs(rootState, 'listAccounts', (args) => {
            const query = args as AccountListQuery;
            dispatch(
              accountsApiSlice.util.updateQueryData('listAccounts', query, (draft) => {
                const index = draft.findIndex((candidate) => candidate.id === accountId);
                if (index === -1) return;
                // Pickers list ACTIVE accounts only, and an archived one must leave them (§9.5).
                if (query.status === AccountStatus.ACTIVE) draft.splice(index, 1);
                else draft[index]!.status = AccountStatus.ARCHIVED;
              }),
            );
          });
        } catch {
          // Nothing was applied to the cache yet — nothing to undo.
        }
      },
      invalidatesTags: (_result, _error, accountId) => (isStillQueued(accountId) ? [] : ACCOUNT_TAGS),
    }),
  }),
  overrideExisting: __DEV__,
});

export const {
  useListAccountsQuery,
  useGetAccountQuery,
  useCreateAccountMutation,
  useUpdateAccountMutation,
  useArchiveAccountMutation,
} = accountsApiSlice;
