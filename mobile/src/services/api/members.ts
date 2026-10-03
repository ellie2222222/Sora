import {
  ROUTES,
  apiUrl,
  type MemberStatus,
  type UpdateMemberRequest,
  type WalletMemberResponse,
} from '@sora/contracts';

import { deleteVoid, getAll, patchOne, postOne } from './client.ts';

/**
 * `POST /wallets/{id}/transfer-ownership` has no schema in @sora/contracts —
 * its body is documented in API spec §7.4 only. Declared here so the call site is
 * still typed; it belongs in the contracts package.
 */
export interface TransferOwnershipRequest {
  toUserId: string;
}

export const membersApi = {
  list(walletId: string, status: MemberStatus = 'ACTIVE'): Promise<WalletMemberResponse[]> {
    return getAll<WalletMemberResponse>(apiUrl(ROUTES.wallets.members(walletId)), { status });
  },
  updateRole(
    walletId: string,
    memberId: string,
    body: UpdateMemberRequest,
  ): Promise<WalletMemberResponse> {
    return patchOne<WalletMemberResponse>(apiUrl(ROUTES.wallets.member(walletId, memberId)), body);
  },
  remove(walletId: string, memberId: string): Promise<void> {
    return deleteVoid(apiUrl(ROUTES.wallets.member(walletId, memberId)));
  },
  transferOwnership(
    walletId: string,
    body: TransferOwnershipRequest,
  ): Promise<WalletMemberResponse[]> {
    return postOne<WalletMemberResponse[]>(
      apiUrl(ROUTES.wallets.transferOwnership(walletId)),
      body,
    );
  },
  leave(walletId: string): Promise<void> {
    return postOne<void>(apiUrl(ROUTES.wallets.leave(walletId)));
  },
};
