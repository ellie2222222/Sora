import {
  ROUTES,
  apiUrl,
  type CreateTransactionRequest,
  type PaginationMeta,
  type TransactionQuery,
  type TransactionResponse,
  type UpdateTransactionRequest,
} from '@sora/contracts';

import { getList, getOne, idempotencyHeaders, patchOne, postOne } from './client.ts';

export interface TransactionPage {
  items: TransactionResponse[];
  pagination: PaginationMeta | undefined;
}

export const transactionsApi = {
  list(query: Partial<TransactionQuery> = {}): Promise<TransactionPage> {
    return getList<TransactionResponse>(apiUrl(ROUTES.transactions.list()), query);
  },

  detail(transactionId: string): Promise<TransactionResponse> {
    return getOne<TransactionResponse>(apiUrl(ROUTES.transactions.detail(transactionId)));
  },

  /**
   * Sent with an idempotency key: a retry over a flaky mobile connection must not
   * record the same payment twice, and a duplicate transaction is a real
   * financial error rather than a cosmetic one.
   *
   * `idempotencyKey` lets a caller pin its own key (guest-mode upload) instead
   * of a fresh one per call; every other caller omits it.
   */
  create(body: CreateTransactionRequest, idempotencyKey?: string): Promise<TransactionResponse> {
    return postOne<TransactionResponse>(
      apiUrl(ROUTES.transactions.create()),
      body,
      idempotencyHeaders(idempotencyKey),
    );
  },

  /** Only the changed fields; an edit to amount, type or an account is checked as a create (API spec §11.4). */
  update(
    transactionId: string,
    body: UpdateTransactionRequest,
    idempotencyKey?: string,
  ): Promise<TransactionResponse> {
    return patchOne<TransactionResponse>(
      apiUrl(ROUTES.transactions.update(transactionId)),
      body,
      idempotencyHeaders(idempotencyKey),
    );
  },

  delete(transactionId: string, reason?: string, idempotencyKey?: string): Promise<TransactionResponse> {
    return postOne<TransactionResponse>(
      apiUrl(ROUTES.transactions.delete(transactionId)),
      reason === undefined ? {} : { reason },
      idempotencyHeaders(idempotencyKey),
    );
  },
};
