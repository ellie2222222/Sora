import {
  AccountStatus,
  type AccountDetailResponse,
  type AccountResponse,
  type CreateAccountRequest,
} from '@sora/contracts';

import { accountsApi as accountsHttp, type AccountListQuery } from '../../../services/api/accounts.ts';
import { guestAccountsApi } from '../../../services/guest/guestAccounts.ts';
import { forEachCachedQueryArgs } from '../../../services/sync/cacheLookup.ts';
import { enqueueOffline, isStillQueued, newLocalId } from '../../../services/sync/offlineEnqueue.ts';
import { isCurrentlyOnline } from '../../../services/sync/networkState.ts';
import { buildOptimisticAccount } from '../../../services/sync/optimisticRecords.ts';
import type { RootState } from '../index.ts';
import { selectIsGuest } from '../authSlice.ts';
import { apiSlice, toQueryFnResult } from './apiSlice.ts';

export type { AccountListQuery } from '../../../services/api/accounts.ts';

const ACCOUNT_TAGS = ['Account', 'Wallet', 'Dashboard'] as const;

export const accountsApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    listAccounts: builder.query<AccountResponse[], AccountListQuery>({
      queryFn: (query, { getState }) => {
        const isGuest = selectIsGuest(getState() as RootState);
        return toQueryFnResult(() => (isGuest ? guestAccountsApi.list(query) : accountsHttp.list(query)));
      },
      providesTags: ['Account'],
    }),
    getAccount: builder.query<AccountDetailResponse, string>({
      queryFn: (accountId, { getState }) => {
        const isGuest = selectIsGuest(getState() as RootState);
        return toQueryFnResult(() => (isGuest ? guestAccountsApi.detail(accountId) : accountsHttp.detail(accountId)));
      },
      providesTags: ['Account'],
    }),
    createAccount: builder.mutation<AccountResponse, CreateAccountRequest>({
      queryFn: (body, { getState }) => {
        const isGuest = selectIsGuest(getState() as RootState);
        if (isGuest) return toQueryFnResult(() => guestAccountsApi.create(body));
        if (!isCurrentlyOnline()) {
          return toQueryFnResult(async () => {
            const localId = newLocalId();
            await enqueueOffline({ entity: 'account', op: 'create', localId, serverId: null, payload: body });
            return buildOptimisticAccount(body, localId);
          });
        }
        return toQueryFnResult(() => accountsHttp.create(body));
      },
      onQueryStarted: async (_body, { dispatch, queryFulfilled, getState }) => {
        try {
          const { data } = await queryFulfilled;
          if (!isStillQueued(data.id)) return;

          const rootState = getState();
          forEachCachedQueryArgs(rootState, 'listAccounts', (args) => {
            dispatch(
              accountsApiSlice.util.updateQueryData('listAccounts', args as AccountListQuery, (draft) => {
                draft.unshift(data);
              }),
            );
          });
        } catch {
          // Nothing was applied to the cache yet — nothing to undo.
        }
      },
      invalidatesTags: (result) => (result && isStillQueued(result.id) ? [] : ACCOUNT_TAGS),
    }),
    archiveAccount: builder.mutation<void, string>({
      queryFn: (accountId, { getState }) => {
        const isGuest = selectIsGuest(getState() as RootState);
        if (isGuest) return toQueryFnResult(() => guestAccountsApi.archive(accountId));
        if (!isCurrentlyOnline()) {
          return toQueryFnResult(async () => {
            await enqueueOffline({ entity: 'account', op: 'archive', localId: accountId, serverId: accountId, payload: {} });
          });
        }
        return toQueryFnResult(() => accountsHttp.archive(accountId));
      },
      onQueryStarted: async (accountId, { dispatch, queryFulfilled, getState }) => {
        try {
          await queryFulfilled;
          if (!isStillQueued(accountId)) return;

          const rootState = getState();
          forEachCachedQueryArgs(rootState, 'listAccounts', (args) => {
            dispatch(
              accountsApiSlice.util.updateQueryData('listAccounts', args as AccountListQuery, (draft) => {
                const item = draft.find((candidate) => candidate.id === accountId);
                if (item) item.status = AccountStatus.ARCHIVED;
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
  useArchiveAccountMutation,
} = accountsApiSlice;
