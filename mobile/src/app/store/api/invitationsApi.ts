import type {
  AcceptInvitationRequest,
  InvitationPreviewResponse,
  InviteMemberRequest,
  WalletInvitationCreatedResponse,
  WalletInvitationResponse,
  WalletResponse,
} from '@sora/contracts';

import { invitationsApi as invitationsHttp, type InvitationState } from '../../../services/api/invitations.ts';
import { apiSlice, toQueryFnResult } from './apiSlice.ts';

export type { InvitationState } from '../../../services/api/invitations.ts';

/** No guest implementation — invitations always involve a real other user. */
export const invitationsApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    listInvitations: builder.query<WalletInvitationResponse[], { walletId: string; state?: InvitationState }>({
      queryFn: ({ walletId, state }) => toQueryFnResult(() => invitationsHttp.list(walletId, state)),
      providesTags: ['WalletInvitation'],
    }),
    createInvitation: builder.mutation<
      WalletInvitationCreatedResponse,
      { walletId: string; body: InviteMemberRequest }
    >({
      queryFn: ({ walletId, body }) => toQueryFnResult(() => invitationsHttp.create(walletId, body)),
      invalidatesTags: ['WalletInvitation'],
    }),
    revokeInvitation: builder.mutation<void, { walletId: string; invitationId: string }>({
      queryFn: ({ walletId, invitationId }) => toQueryFnResult(() => invitationsHttp.revoke(walletId, invitationId)),
      invalidatesTags: ['WalletInvitation'],
    }),
    previewInvitation: builder.query<InvitationPreviewResponse, string>({
      queryFn: (token) => toQueryFnResult(() => invitationsHttp.preview(token)),
    }),
    acceptInvitation: builder.mutation<WalletResponse, AcceptInvitationRequest>({
      queryFn: (body) => toQueryFnResult(() => invitationsHttp.accept(body)),
      invalidatesTags: ['Wallet'],
    }),
  }),
  overrideExisting: __DEV__,
});

export const {
  useListInvitationsQuery,
  useCreateInvitationMutation,
  useRevokeInvitationMutation,
  usePreviewInvitationQuery,
  useAcceptInvitationMutation,
} = invitationsApiSlice;
