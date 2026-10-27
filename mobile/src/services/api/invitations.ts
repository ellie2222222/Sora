import {
  ROUTES,
  apiUrl,
  type AcceptInvitationRequest,
  type InvitationPreviewResponse,
  type InviteMemberRequest,
  type ReceivedInvitationResponse,
  type WalletInvitationCreatedResponse,
  type WalletInvitationResponse,
  type WalletResponse,
} from '@sora/contracts';

import { deleteVoid, getAll, postOne, postVoid } from './client.ts';

export type InvitationState = 'open' | 'accepted' | 'revoked' | 'expired';

export const invitationsApi = {
  list(walletId: string, state: InvitationState = 'open'): Promise<WalletInvitationResponse[]> {
    return getAll<WalletInvitationResponse>(apiUrl(ROUTES.wallets.invitations(walletId)), { state });
  },
  create(walletId: string, body: InviteMemberRequest): Promise<WalletInvitationCreatedResponse> {
    return postOne<WalletInvitationCreatedResponse>(
      apiUrl(ROUTES.wallets.invitations(walletId)),
      body,
    );
  },
  revoke(walletId: string, invitationId: string): Promise<void> {
    return deleteVoid(apiUrl(ROUTES.wallets.invitation(walletId, invitationId)));
  },
  preview(token: string): Promise<InvitationPreviewResponse> {
    return postOne<InvitationPreviewResponse>(apiUrl(ROUTES.invitations.preview()), { token });
  },
  accept(body: AcceptInvitationRequest): Promise<WalletResponse> {
    return postOne<WalletResponse>(apiUrl(ROUTES.invitations.accept()), body);
  },
  received(): Promise<ReceivedInvitationResponse[]> {
    return getAll<ReceivedInvitationResponse>(apiUrl(ROUTES.invitations.received()), {});
  },
  acceptById(invitationId: string): Promise<WalletResponse> {
    return postOne<WalletResponse>(apiUrl(ROUTES.invitations.acceptById(invitationId)));
  },
  decline(invitationId: string): Promise<void> {
    return postVoid(apiUrl(ROUTES.invitations.decline(invitationId)));
  },
};
