import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InviteMemberRequest, UpdateMemberRequest } from '@finance/contracts';

import { MEMBERSHIP_INVALIDATION_KEYS, queryKeys } from '../../../app/config/queryKeys.ts';
import { invitationsApi } from '../../../services/api/invitations.ts';
import { membersApi, type TransferOwnershipRequest } from '../../../services/api/members.ts';

export function useWalletMembers(walletId: string) {
  return useQuery({
    queryKey: queryKeys.wallets.members(walletId),
    queryFn: () => membersApi.list(walletId),
  });
}

export function useWalletInvitations(walletId: string) {
  return useQuery({
    queryKey: queryKeys.wallets.invitations(walletId),
    queryFn: () => invitationsApi.list(walletId, 'open'),
  });
}

export function useInviteMember(walletId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: InviteMemberRequest) => invitationsApi.create(walletId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.wallets.invitations(walletId) });
    },
  });
}

export function useRevokeInvitation(walletId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invitationId: string) => invitationsApi.revoke(walletId, invitationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.wallets.invitations(walletId) });
    },
  });
}

export function useUpdateMemberRole(walletId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ memberId, body }: { memberId: string; body: UpdateMemberRequest }) =>
      membersApi.updateRole(walletId, memberId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.wallets.members(walletId) });
    },
  });
}

export function useRemoveMember(walletId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (memberId: string) => membersApi.remove(walletId, memberId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.wallets.members(walletId) });
    },
  });
}

export function useTransferOwnership(walletId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: TransferOwnershipRequest) => membersApi.transferOwnership(walletId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.wallets.members(walletId) });
      // Ownership moving changes who this wallet resolves as for the acting
      // user too (their own role drops to EDITOR), which the wallet list caches.
      for (const key of MEMBERSHIP_INVALIDATION_KEYS) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
}

export function useLeaveWallet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (walletId: string) => membersApi.leave(walletId),
    onSuccess: () => {
      for (const key of MEMBERSHIP_INVALIDATION_KEYS) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
}
