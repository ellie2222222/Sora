import type {
  AccountDetailResponse,
  AccountResponse,
  CreateAccountRequest,
} from '@sora/contracts';

import { accountsApi as accountsHttp, type AccountListQuery } from '../../../services/api/accounts.ts';
import { guestAccountsApi } from '../../../services/guest/guestAccounts.ts';
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
        return toQueryFnResult(() => (isGuest ? guestAccountsApi.create(body) : accountsHttp.create(body)));
      },
      invalidatesTags: ACCOUNT_TAGS,
    }),
    archiveAccount: builder.mutation<void, string>({
      queryFn: (accountId, { getState }) => {
        const isGuest = selectIsGuest(getState() as RootState);
        return toQueryFnResult(() => (isGuest ? guestAccountsApi.archive(accountId) : accountsHttp.archive(accountId)));
      },
      invalidatesTags: ACCOUNT_TAGS,
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
