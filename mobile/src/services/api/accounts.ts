import {
  ROUTES,
  apiUrl,
  type AccountDetailResponse,
  type AccountResponse,
  type AccountStatus,
  type AccountType,
  type CreateAccountRequest,
  type UpdateAccountRequest,
} from '@finance/contracts';

import { deleteVoid, getList, getOne, patchOne, postOne } from './client.ts';

export interface AccountListQuery {
  walletId?: string | undefined;
  status?: AccountStatus | undefined;
  type?: AccountType | undefined;
}

export const accountsApi = {
  async list(query: AccountListQuery = {}): Promise<AccountResponse[]> {
    const { items } = await getList<AccountResponse>(apiUrl(ROUTES.accounts.list()), query);
    return items;
  },
  detail(accountId: string): Promise<AccountDetailResponse> {
    return getOne<AccountDetailResponse>(apiUrl(ROUTES.accounts.detail(accountId)));
  },
  create(body: CreateAccountRequest): Promise<AccountResponse> {
    return postOne<AccountResponse>(apiUrl(ROUTES.accounts.create()), body);
  },
  update(accountId: string, body: UpdateAccountRequest): Promise<AccountResponse> {
    return patchOne<AccountResponse>(apiUrl(ROUTES.accounts.update(accountId)), body);
  },
  archive(accountId: string): Promise<void> {
    return deleteVoid(apiUrl(ROUTES.accounts.archive(accountId)));
  },
};
