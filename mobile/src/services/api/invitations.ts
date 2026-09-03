import {
  ROUTES,
  apiUrl,
  type AcceptInvitationRequest,
  type InvitationPreviewResponse,
  type InviteMemberRequest,
  type WalletInvitationCreatedResponse,
  type WalletInvitationResponse,
  type WalletResponse,
} from '@sora/contracts';

import { deleteVoid, getList, postOne } from './client.ts';

export type InvitationState = 'open' | 'accepted' | 'revoked' | 'expired';

export const invitationsApi = {
  async list(walletId: string, state: InvitationState = 'open'): Promise<WalletInvitationResponse[]> {
    const { items } = await getList<WalletInvitationResponse>(
      apiUrl(ROUTES.wallets.invitations(walletId)),
      { state },
    );
    return items;
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
};
