import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateContributionRequest, CreateGoalRequest } from '@finance/contracts';

import { CONTRIBUTION_INVALIDATION_KEYS, queryKeys, type GoalListParams } from '../../../app/config/queryKeys.ts';
import { goalsApi } from '../../../services/api/goals.ts';

export function useGoals(params: GoalListParams) {
  return useQuery({
    queryKey: queryKeys.goals.list(params),
    queryFn: () => goalsApi.list(params),
    enabled: params.walletId !== '',
  });
}

export function useGoal(goalId: string | null) {
  return useQuery({
    queryKey: queryKeys.goals.detail(goalId ?? ''),
    queryFn: () => goalsApi.detail(goalId as string),
    enabled: goalId !== null,
  });
}

export function useGoalContributions(goalId: string | null) {
  return useQuery({
    queryKey: queryKeys.goals.contributions(goalId ?? ''),
    queryFn: () => goalsApi.contributions(goalId as string),
    enabled: goalId !== null,
  });
}

export function useCreateGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateGoalRequest) => goalsApi.create(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.goals.root() });
    },
  });
}

export function useAddContribution() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ goalId, body }: { goalId: string; body: CreateContributionRequest }) =>
      goalsApi.addContribution(goalId, body),
    onSuccess: () => {
      // May have recorded a real transaction (recordAsTransaction), so every
      // key a transaction touches must be invalidated too, not just goals.
      for (const key of CONTRIBUTION_INVALIDATION_KEYS) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
}
