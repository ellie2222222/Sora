import {
  ROUTES,
  apiUrl,
  type BudgetResponse,
  type CreateBudgetRequest,
  type UpdateBudgetRequest,
} from '@sora/contracts';

import { deleteVoid, getAll, getOne, idempotencyHeaders, patchOne, postOne } from './client.ts';

export interface BudgetListQuery {
  walletId: string;
  /** Budgets covering this calendar day (YYYY-MM-DD); also the day each repeating budget's period is taken on. */
  activeOn?: string | undefined;
}

export const budgetsApi = {
  list(query: BudgetListQuery): Promise<BudgetResponse[]> {
    return getAll<BudgetResponse>(apiUrl(ROUTES.budgets.list()), query);
  },

  detail(budgetId: string): Promise<BudgetResponse> {
    return getOne<BudgetResponse>(apiUrl(ROUTES.budgets.detail(budgetId)));
  },

  create(body: CreateBudgetRequest, idempotencyKey?: string): Promise<BudgetResponse> {
    return postOne<BudgetResponse>(apiUrl(ROUTES.budgets.create()), body, idempotencyHeaders(idempotencyKey));
  },

  /**
   * Category and period are absent from the update contract on purpose: moving a
   * window changes which transactions the budget ever covered, which makes it a
   * different budget. Delete and create instead.
   */
  update(budgetId: string, body: UpdateBudgetRequest, idempotencyKey?: string): Promise<BudgetResponse> {
    return patchOne<BudgetResponse>(
      apiUrl(ROUTES.budgets.update(budgetId)),
      body,
      idempotencyHeaders(idempotencyKey),
    );
  },

  delete(budgetId: string, idempotencyKey?: string): Promise<void> {
    return deleteVoid(apiUrl(ROUTES.budgets.delete(budgetId)), undefined, idempotencyHeaders(idempotencyKey));
  },
};
