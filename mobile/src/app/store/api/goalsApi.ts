import type { ContributionResponse, CreateContributionRequest, CreateGoalRequest, GoalResponse } from '@sora/contracts';

import { goalsApi as goalsHttp, type GoalListQuery } from '@/services/api';
import { ensureSeeded, guestGoalsApi } from '@/services/guest';
import { buildOptimisticGoal, enqueueOffline, forEachCachedQueryArgs, isCurrentlyOnline, isStillQueued, newLocalId, setCurrentlyOnline } from '@/services/sync';
import { isNetworkError } from '@/utils';
import type { RootState } from '../index.ts';
import { selectIsGuest } from '../authSlice.ts';
import { apiSlice, toQueryFnResult } from './apiSlice.ts';

export type { GoalListQuery } from '@/services/api';

const GOAL_TAGS = ['Goal'] as const;

/** A contribution moves goal progress and, when transaction-backed, real money. */
const CONTRIBUTION_TAGS = ['Goal', 'GoalContribution', 'Transaction', 'Account', 'Dashboard', 'Budget', 'Wallet'] as const;

export const goalsApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    listGoals: builder.query<GoalResponse[], GoalListQuery>({
      queryFn: (query, { getState }) => {
        const isGuest = selectIsGuest(getState() as RootState);
        return toQueryFnResult(async () => {
          if (isGuest || !isCurrentlyOnline()) {
            await ensureSeeded();
            return guestGoalsApi.list(query);
          }
          try {
            return await goalsHttp.list(query);
          } catch (err) {
            if (isNetworkError(err)) {
              setCurrentlyOnline(false);
              await ensureSeeded();
              return guestGoalsApi.list(query);
            }
            throw err;
          }
        });
      },
      providesTags: ['Goal'],
    }),
    getGoal: builder.query<GoalResponse, string>({
      queryFn: (goalId, { getState }) => {
        const isGuest = selectIsGuest(getState() as RootState);
        return toQueryFnResult(async () => {
          if (isGuest || !isCurrentlyOnline()) {
            await ensureSeeded();
            return guestGoalsApi.detail(goalId);
          }
          try {
            return await goalsHttp.detail(goalId);
          } catch (err) {
            if (isNetworkError(err)) {
              setCurrentlyOnline(false);
              await ensureSeeded();
              return guestGoalsApi.detail(goalId);
            }
            throw err;
          }
        });
      },
      providesTags: ['Goal'],
    }),
    listGoalContributions: builder.query<ContributionResponse[], string>({
      queryFn: (goalId, { getState }) => {
        const isGuest = selectIsGuest(getState() as RootState);
        return toQueryFnResult(async () => {
          if (isGuest || !isCurrentlyOnline()) {
            await ensureSeeded();
            return guestGoalsApi.contributions(goalId);
          }
          try {
            return await goalsHttp.contributions(goalId);
          } catch (err) {
            if (isNetworkError(err)) {
              setCurrentlyOnline(false);
              await ensureSeeded();
              return guestGoalsApi.contributions(goalId);
            }
            throw err;
          }
        });
      },
      providesTags: ['GoalContribution'],
    }),
    createGoal: builder.mutation<GoalResponse, CreateGoalRequest>({
      queryFn: (body, { getState }) => {
        const isGuest = selectIsGuest(getState() as RootState);
        if (isGuest) return toQueryFnResult(() => guestGoalsApi.create(body));
        if (!isCurrentlyOnline()) {
          return toQueryFnResult(async () => {
            const localId = newLocalId();
            await enqueueOffline({ entity: 'goal', op: 'create', localId, serverId: null, payload: body });
            return buildOptimisticGoal(body, localId);
          });
        }
        return toQueryFnResult(() => goalsHttp.create(body));
      },
      onQueryStarted: async (_body, { dispatch, queryFulfilled, getState }) => {
        try {
          const { data } = await queryFulfilled;
          if (!isStillQueued(data.id)) return;

          const rootState = getState();
          forEachCachedQueryArgs(rootState, 'listGoals', (args) => {
            dispatch(
              goalsApiSlice.util.updateQueryData('listGoals', args as GoalListQuery, (draft) => {
                draft.unshift(data);
              }),
            );
          });
        } catch {
          // Nothing was applied to the cache yet — nothing to undo.
        }
      },
      invalidatesTags: (result) => (result && isStillQueued(result.id) ? [] : GOAL_TAGS),
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
