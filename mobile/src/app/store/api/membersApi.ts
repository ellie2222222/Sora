import type { MemberStatus, UpdateMemberRequest, WalletMemberResponse } from '@sora/contracts';

import { membersApi as membersHttp, type TransferOwnershipRequest } from '@/services/api';
import { isCurrentlyOnline, setCurrentlyOnline } from '@/services/sync';
import { isNetworkError } from '../../../utils/errors.ts';
import { apiSlice, toQueryFnResult } from './apiSlice.ts';

export type { TransferOwnershipRequest } from '@/services/api';

// Membership has no guest implementation by scope decision — it needs real
// other users — so every endpoint here calls the real API unconditionally.

/** Ownership moving changes who this wallet resolves as for the acting user too. */
const MEMBERSHIP_TAGS = ['Wallet', 'Account', 'Transaction', 'Dashboard'] as const;

export const membersApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    listMembers: builder.query<WalletMemberResponse[], { walletId: string; status?: MemberStatus }>({
      queryFn: ({ walletId, status }) =>
        toQueryFnResult(async () => {
          if (!isCurrentlyOnline()) return [];
          try {
            return await membersHttp.list(walletId, status);
          } catch (err) {
            if (isNetworkError(err)) {
              setCurrentlyOnline(false);
              return [];
            }
            throw err;
          }
        }),
      providesTags: ['WalletMember'],
    }),
    updateMemberRole: builder.mutation<
      WalletMemberResponse,
      { walletId: string; memberId: string; body: UpdateMemberRequest }
    >({
      queryFn: ({ walletId, memberId, body }) =>
        toQueryFnResult(() => membersHttp.updateRole(walletId, memberId, body)),
      invalidatesTags: ['WalletMember'],
    }),
    removeMember: builder.mutation<void, { walletId: string; memberId: string }>({
      queryFn: ({ walletId, memberId }) => toQueryFnResult(() => membersHttp.remove(walletId, memberId)),
      invalidatesTags: ['WalletMember'],
    }),
    transferOwnership: builder.mutation<
      WalletMemberResponse[],
      { walletId: string; body: TransferOwnershipRequest }
    >({
      queryFn: ({ walletId, body }) => toQueryFnResult(() => membersHttp.transferOwnership(walletId, body)),
      invalidatesTags: ['WalletMember', ...MEMBERSHIP_TAGS],
    }),
    leaveWallet: builder.mutation<void, string>({
      queryFn: (walletId) => toQueryFnResult(() => membersHttp.leave(walletId)),
      invalidatesTags: MEMBERSHIP_TAGS,
    }),
  }),
  overrideExisting: __DEV__,
});

export const {
  useListMembersQuery,
  useUpdateMemberRoleMutation,
  useRemoveMemberMutation,
  useTransferOwnershipMutation,
  useLeaveWalletMutation,
} = membersApiSlice;
