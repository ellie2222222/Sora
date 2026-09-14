import {
  ROUTES,
  apiUrl,
  type BudgetResponse,
  type BudgetStatus,
  type CreateBudgetRequest,
  type UpdateBudgetRequest,
} from '@sora/contracts';

import { deleteVoid, getList, getOne, idempotencyHeaders, patchOne, postOne } from './client.ts';

export interface BudgetListQuery {
  walletId: string;
  status?: BudgetStatus | undefined;
  /** Budgets whose window contains this calendar day (YYYY-MM-DD). */
  activeOn?: string | undefined;
}

export const budgetsApi = {
  async list(query: BudgetListQuery): Promise<BudgetResponse[]> {
    const { items } = await getList<BudgetResponse>(apiUrl(ROUTES.budgets.list()), query);
    return items;
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
   * different budget. Archive and create instead.
   */
  update(budgetId: string, body: UpdateBudgetRequest, idempotencyKey?: string): Promise<BudgetResponse> {
    return patchOne<BudgetResponse>(
      apiUrl(ROUTES.budgets.update(budgetId)),
      body,
      idempotencyHeaders(idempotencyKey),
    );
  },

  archive(budgetId: string, idempotencyKey?: string): Promise<void> {
    return deleteVoid(apiUrl(ROUTES.budgets.archive(budgetId)), undefined, idempotencyHeaders(idempotencyKey));
  },
};
