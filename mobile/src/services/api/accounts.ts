import {
  ROUTES,
  apiUrl,
  type AccountDetailResponse,
  type AccountResponse,
  type AccountStatus,
  type AccountType,
  type CreateAccountRequest,
  type UpdateAccountRequest,
} from '@sora/contracts';

import { deleteVoid, getAll, getOne, idempotencyHeaders, patchOne, postOne } from './client.ts';

export interface AccountListQuery {
  walletId?: string | undefined;
  status?: AccountStatus | undefined;
  type?: AccountType | undefined;
}

export const accountsApi = {
  list(query: AccountListQuery = {}): Promise<AccountResponse[]> {
    return getAll<AccountResponse>(apiUrl(ROUTES.accounts.list()), query);
  },
  detail(accountId: string): Promise<AccountDetailResponse> {
    return getOne<AccountDetailResponse>(apiUrl(ROUTES.accounts.detail(accountId)));
  },
  create(body: CreateAccountRequest, idempotencyKey?: string): Promise<AccountResponse> {
    return postOne<AccountResponse>(apiUrl(ROUTES.accounts.create()), body, idempotencyHeaders(idempotencyKey));
  },
  update(accountId: string, body: UpdateAccountRequest, idempotencyKey?: string): Promise<AccountResponse> {
    return patchOne<AccountResponse>(
      apiUrl(ROUTES.accounts.update(accountId)),
      body,
      idempotencyHeaders(idempotencyKey),
    );
  },
  archive(accountId: string, idempotencyKey?: string): Promise<void> {
    return deleteVoid(apiUrl(ROUTES.accounts.archive(accountId)), undefined, idempotencyHeaders(idempotencyKey));
  },
};
