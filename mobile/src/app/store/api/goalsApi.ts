import type { ContributionResponse, CreateContributionRequest, CreateGoalRequest, GoalResponse } from '@sora/contracts';

import { goalsApi as goalsHttp, type GoalListQuery } from '../../../services/api/goals.ts';
import { guestGoalsApi } from '../../../services/guest/guestGoals.ts';
import type { RootState } from '../index.ts';
import { selectIsGuest } from '../authSlice.ts';
import { apiSlice, toQueryFnResult } from './apiSlice.ts';

export type { GoalListQuery } from '../../../services/api/goals.ts';

/** A contribution moves goal progress and, when transaction-backed, real money. */
const CONTRIBUTION_TAGS = ['Goal', 'GoalContribution', 'Transaction', 'Account', 'Dashboard', 'Budget', 'Wallet'] as const;

export const goalsApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    listGoals: builder.query<GoalResponse[], GoalListQuery>({
      queryFn: (query, { getState }) => {
        const isGuest = selectIsGuest(getState() as RootState);
        return toQueryFnResult(() => (isGuest ? guestGoalsApi.list(query) : goalsHttp.list(query)));
      },
      providesTags: ['Goal'],
    }),
    getGoal: builder.query<GoalResponse, string>({
      queryFn: (goalId, { getState }) => {
        const isGuest = selectIsGuest(getState() as RootState);
        return toQueryFnResult(() => (isGuest ? guestGoalsApi.detail(goalId) : goalsHttp.detail(goalId)));
      },
      providesTags: ['Goal'],
    }),
    listGoalContributions: builder.query<ContributionResponse[], string>({
      queryFn: (goalId, { getState }) => {
        const isGuest = selectIsGuest(getState() as RootState);
        return toQueryFnResult(() => (isGuest ? guestGoalsApi.contributions(goalId) : goalsHttp.contributions(goalId)));
      },
      providesTags: ['GoalContribution'],
    }),
    createGoal: builder.mutation<GoalResponse, CreateGoalRequest>({
      queryFn: (body, { getState }) => {
        const isGuest = selectIsGuest(getState() as RootState);
        return toQueryFnResult(() => (isGuest ? guestGoalsApi.create(body) : goalsHttp.create(body)));
      },
      invalidatesTags: ['Goal'],
    }),
    addContribution: builder.mutation<ContributionResponse, { goalId: string; body: CreateContributionRequest }>({
      queryFn: ({ goalId, body }, { getState }) => {
        const isGuest = selectIsGuest(getState() as RootState);
        return toQueryFnResult(() =>
          isGuest ? guestGoalsApi.addContribution(goalId, body) : goalsHttp.addContribution(goalId, body),
        );
      },
      invalidatesTags: CONTRIBUTION_TAGS,
    }),
  }),
  overrideExisting: __DEV__,
});

export const {
  useListGoalsQuery,
  useGetGoalQuery,
  useListGoalContributionsQuery,
  useCreateGoalMutation,
  useAddContributionMutation,
} = goalsApiSlice;
