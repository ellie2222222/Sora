import {
  ROUTES,
  apiUrl,
  type CreateWalletRequest,
  type UpdateWalletRequest,
  type WalletResponse,
} from '@sora/contracts';

import { deleteVoid, getAll, getOne, patchOne, postOne } from './client.ts';

export interface WalletListQuery {
  status?: 'ACTIVE' | 'ARCHIVED';
  includeOwn?: boolean;
  includeShared?: boolean;
}

export const walletsApi = {
  list(query: WalletListQuery = {}): Promise<WalletResponse[]> {
    return getAll<WalletResponse>(apiUrl(ROUTES.wallets.list()), query);
  },
  detail(walletId: string): Promise<WalletResponse> {
    return getOne<WalletResponse>(apiUrl(ROUTES.wallets.detail(walletId)));
  },
  create(body: CreateWalletRequest): Promise<WalletResponse> {
    return postOne<WalletResponse>(apiUrl(ROUTES.wallets.create()), body);
  },
  update(walletId: string, body: UpdateWalletRequest): Promise<WalletResponse> {
    return patchOne<WalletResponse>(apiUrl(ROUTES.wallets.update(walletId)), body);
  },
  /** DELETE archives rather than destroying — API spec §6.5. */
  archive(walletId: string): Promise<void> {
    return deleteVoid(apiUrl(ROUTES.wallets.archive(walletId)));
  },
};
