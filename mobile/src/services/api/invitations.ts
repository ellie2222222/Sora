import {
  ROUTES,
  apiUrl,
  type AcceptInvitationRequest,
  type InviteMemberRequest,
  type WalletInvitationCreatedResponse,
  type WalletInvitationResponse,
  type WalletResponse,
  type WalletRole,
} from '@sora/contracts';

import { deleteVoid, getList, postOne } from './client.ts';

export type InvitationState = 'open' | 'accepted' | 'revoked' | 'expired';

/**
 * The preview body (API spec §8.4) has no type in @sora/contracts. `role` is
 * reused from the shared enum; `invitedEmail` arrives masked, because the
 * endpoint is public and the token may have been pasted anywhere.
 */
export interface InvitationPreview {
  walletName: string;
  invitedEmail: string;
  role: WalletRole;
  expiresAt: string;
}

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
  preview(token: string): Promise<InvitationPreview> {
    return postOne<InvitationPreview>(apiUrl(ROUTES.invitations.preview()), { token });
  },
  accept(body: AcceptInvitationRequest): Promise<WalletResponse> {
    return postOne<WalletResponse>(apiUrl(ROUTES.invitations.accept()), body);
  },
};
