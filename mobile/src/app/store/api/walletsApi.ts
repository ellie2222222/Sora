import type { CreateWalletRequest, WalletResponse } from '@sora/contracts';

import { walletsApi as walletsHttp, type WalletListQuery } from '@/services/api';
import { guestWalletsApi } from '@/services/guest';
import type { RootState } from '../index.ts';
import { selectIsGuest } from '../authSlice.ts';
import { apiSlice, toQueryFnResult } from './apiSlice.ts';
import { cacheKeyOf } from '@/services/sync';
import { readGuestOrApi } from './guestFallback.ts';

export type { WalletListQuery } from '@/services/api';

/**
 * Create and archive stay on the real API with no guest branch: guest mode is
 * single-wallet by scope decision, so the screens that reach them are hidden
 * when `isGuest` rather than given a local implementation.
 */
export const walletsApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    listWallets: builder.query<WalletResponse[], WalletListQuery | void>({
      queryFn: (query, { getState, endpoint }) => {
        const isGuest = selectIsGuest(getState() as RootState);
        return toQueryFnResult(() =>
          readGuestOrApi(
            cacheKeyOf(endpoint, query),
            isGuest,
            () => walletsHttp.list(query ?? {}),
            () => guestWalletsApi.list(query ?? {}),
          ),
        );
      },
      providesTags: ['Wallet'],
    }),
    getWallet: builder.query<WalletResponse, string>({
      queryFn: (walletId, { getState, endpoint }) => {
        const isGuest = selectIsGuest(getState() as RootState);
        return toQueryFnResult(() =>
          readGuestOrApi(
            cacheKeyOf(endpoint, walletId),
            isGuest,
            () => walletsHttp.detail(walletId),
            () => guestWalletsApi.detail(walletId),
          ),
        );
      },
      providesTags: ['Wallet'],
    }),
    createWallet: builder.mutation<WalletResponse, CreateWalletRequest>({
      queryFn: (body) => toQueryFnResult(() => walletsHttp.create(body)),
      invalidatesTags: ['Wallet'],
    }),
    archiveWallet: builder.mutation<void, string>({
      queryFn: (walletId) => toQueryFnResult(() => walletsHttp.archive(walletId)),
      invalidatesTags: ['Wallet'],
    }),
  }),
  overrideExisting: __DEV__,
});

export const {
  useListWalletsQuery,
  useGetWalletQuery,
  useCreateWalletMutation,
  useArchiveWalletMutation,
} = walletsApiSlice;
