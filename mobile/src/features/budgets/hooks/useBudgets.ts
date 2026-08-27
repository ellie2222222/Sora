import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateBudgetRequest, UpdateBudgetRequest } from '@sora/contracts';

import { queryKeys, type BudgetListParams } from '../../../app/config/queryKeys.ts';
import { budgetsApi } from '../../../services/api/budgets.ts';

export function useBudgets(params: BudgetListParams) {
  return useQuery({
    queryKey: queryKeys.budgets.list(params),
    queryFn: () => budgetsApi.list(params),
    enabled: params.walletId !== '',
  });
}

export function useCreateBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateBudgetRequest) => budgetsApi.create(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.budgets.root() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.root() });
    },
  });
}

export function useArchiveBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (budgetId: string) => budgetsApi.archive(budgetId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.budgets.root() });
    },
  });
}

export function useUpdateBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ budgetId, body }: { budgetId: string; body: UpdateBudgetRequest }) =>
      budgetsApi.update(budgetId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.budgets.root() });
    },
  });
}
