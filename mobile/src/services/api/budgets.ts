import {
  ROUTES,
  apiUrl,
  type BudgetResponse,
  type BudgetStatus,
  type CreateBudgetRequest,
  type UpdateBudgetRequest,
} from '@sora/contracts';

import { deleteVoid, getList, getOne, patchOne, postOne } from './client.ts';

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

  create(body: CreateBudgetRequest): Promise<BudgetResponse> {
    return postOne<BudgetResponse>(apiUrl(ROUTES.budgets.create()), body);
  },

  /**
   * Category and period are absent from the update contract on purpose: moving a
   * window changes which transactions the budget ever covered, which makes it a
   * different budget. Archive and create instead.
   */
  update(budgetId: string, body: UpdateBudgetRequest): Promise<BudgetResponse> {
    return patchOne<BudgetResponse>(apiUrl(ROUTES.budgets.update(budgetId)), body);
  },

  archive(budgetId: string): Promise<void> {
    return deleteVoid(apiUrl(ROUTES.budgets.archive(budgetId)));
  },
};
