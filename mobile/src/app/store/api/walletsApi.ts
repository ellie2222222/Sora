import type { CreateWalletRequest, WalletResponse } from '@sora/contracts';

import { walletsApi as walletsHttp, type WalletListQuery } from '@/services/api';
import { ensureSeeded, guestWalletsApi } from '@/services/guest';
import { isCurrentlyOnline, setCurrentlyOnline } from '@/services/sync';
import { isNetworkError } from '../../../utils/errors.ts';
import type { RootState } from '../index.ts';
import { selectIsGuest } from '../authSlice.ts';
import { apiSlice, toQueryFnResult } from './apiSlice.ts';

export type { WalletListQuery } from '@/services/api';

/**
 * Create and archive stay on the real API with no guest branch: guest mode is
 * single-wallet by scope decision, so the screens that reach them are hidden
 * when `isGuest` rather than given a local implementation.
 */
export const walletsApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    listWallets: builder.query<WalletResponse[], WalletListQuery | void>({
      queryFn: (query, { getState }) => {
        const isGuest = selectIsGuest(getState() as RootState);
        return toQueryFnResult(async () => {
          if (isGuest || !isCurrentlyOnline()) {
            await ensureSeeded();
            return guestWalletsApi.list(query ?? {});
          }
          try {
            return await walletsHttp.list(query ?? {});
          } catch (err) {
            if (isNetworkError(err)) {
              setCurrentlyOnline(false);
              await ensureSeeded();
              return guestWalletsApi.list(query ?? {});
            }
            throw err;
          }
        });
      },
      providesTags: ['Wallet'],
    }),
    getWallet: builder.query<WalletResponse, string>({
      queryFn: (walletId, { getState }) => {
        const isGuest = selectIsGuest(getState() as RootState);
        return toQueryFnResult(async () => {
          if (isGuest || !isCurrentlyOnline()) {
            await ensureSeeded();
            return guestWalletsApi.detail(walletId);
          }
          try {
            return await walletsHttp.detail(walletId);
          } catch (err) {
            if (isNetworkError(err)) {
              setCurrentlyOnline(false);
              await ensureSeeded();
              return guestWalletsApi.detail(walletId);
            }
            throw err;
          }
        });
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
