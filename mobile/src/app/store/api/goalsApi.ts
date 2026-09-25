import {
  TransactionStatus,
  TransactionType,
  type ContributionResponse,
  type CreateContributionRequest,
  type CreateGoalRequest,
  type GoalResponse,
} from '@sora/contracts';

import { goalsApi as goalsHttp, type GoalListQuery, type ListResult } from '@/services/api';
import { guestGoalsApi } from '@/services/guest';
import {
  buildOptimisticContribution,
  buildOptimisticGoal,
  buildOptimisticTransaction,
  cacheKeyOf,
  enqueueOffline,
  forEachCachedQueryArgs,
  isCurrentlyOnline,
  isStillQueued,
  ledgerChangeOf,
  newLocalId,
} from '@/services/sync';
import { completePage, FIRST_PAGE, nextPageParam } from '@/utils';
import type { RootState } from '../index.ts';
import { selectIsGuest } from '../authSlice.ts';
import { apiSlice, toQueryFnResult } from './apiSlice.ts';
import { readGuestOrApi } from './guestFallback.ts';
import { currentUserId, patchTotalsForContribution, patchTotalsForTransaction } from './pendingTotalsPatch.ts';

export type { GoalListQuery } from '@/services/api';

const GOAL_TAGS = ['Goal'] as const;

const CONTRIBUTIONS_PAGE_SIZE = 25;

/** A contribution moves goal progress and, when transaction-backed, real money. */
const CONTRIBUTION_TAGS = ['Goal', 'GoalContribution', 'Transaction', 'Account', 'Dashboard', 'Budget', 'Wallet'] as const;

export const goalsApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    listGoals: builder.query<GoalResponse[], GoalListQuery>({
      queryFn: (query, { getState, endpoint }) => {
        const isGuest = selectIsGuest(getState() as RootState);
        return toQueryFnResult(() =>
          readGuestOrApi(
            cacheKeyOf(endpoint, query),
            isGuest,
            () => goalsHttp.list(query),
            () => guestGoalsApi.list(query),
          ),
        );
      },
      providesTags: ['Goal'],
    }),
    getGoal: builder.query<GoalResponse, string>({
      queryFn: (goalId, { getState, endpoint }) => {
        const isGuest = selectIsGuest(getState() as RootState);
        return toQueryFnResult(() =>
          readGuestOrApi(
            cacheKeyOf(endpoint, goalId),
            isGuest,
            () => goalsHttp.detail(goalId),
            () => guestGoalsApi.detail(goalId),
          ),
        );
      },
      providesTags: ['Goal'],
    }),
    listGoalContributions: builder.infiniteQuery<ListResult<ContributionResponse>, string, number>({
      infiniteQueryOptions: {
        initialPageParam: FIRST_PAGE,
        getNextPageParam: (lastPage) => nextPageParam(lastPage),
      },
      queryFn: ({ queryArg: goalId, pageParam }, { getState, endpoint }) => {
        const isGuest = selectIsGuest(getState() as RootState);
        return toQueryFnResult(() =>
          readGuestOrApi(
            cacheKeyOf(endpoint, goalId, pageParam),
            isGuest,
            () => goalsHttp.contributions(goalId, { page: pageParam, pageSize: CONTRIBUTIONS_PAGE_SIZE }),
            async () => completePage(await guestGoalsApi.contributions(goalId)),
          ),
        );
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
        const state = getState() as RootState;
        if (selectIsGuest(state)) return toQueryFnResult(() => guestGoalsApi.addContribution(goalId, body));
        if (!isCurrentlyOnline()) {
          return toQueryFnResult(async () => {
            const localId = newLocalId();
            await enqueueOffline({ entity: 'contribution', op: 'create', localId, serverId: null, payload: { ...body, goalId } });
            return buildOptimisticContribution(goalId, body, localId, (state as unknown as Record<string, unknown>)[apiSlice.reducerPath]);
          });
        }
        return toQueryFnResult(() => goalsHttp.addContribution(goalId, body));
      },
      onQueryStarted: async ({ goalId, body }, { dispatch, queryFulfilled, getState }) => {
        try {
          const { data } = await queryFulfilled;
          if (!isStillQueued(data.id)) return; // Online/guest path — invalidatesTags already covers it.
          dispatch(
            goalsApiSlice.util.updateQueryData('listGoalContributions', goalId, (draft) => {
              draft.pages[0]?.items.unshift(data);
            }),
          );

          const rootState = getState();
          patchTotalsForContribution(dispatch, rootState, goalId, body.amount);
          if (body.recordAsTransaction && body.categoryId) {
            // The server records this as an EXPENSE from the account in the same write.
            const backing = buildOptimisticTransaction(
              {
                type: TransactionType.EXPENSE,
                fromAccountId: body.accountId,
                categoryId: body.categoryId,
                amount: body.amount,
                currency: body.currency,
                transactionDate: body.contributionDate,
                status: TransactionStatus.COMPLETED,
              },
              data.id,
              (rootState as Record<string, unknown>)[apiSlice.reducerPath],
            );
            const accountIds = { from: body.accountId, to: null };
            patchTotalsForTransaction(dispatch, rootState, ledgerChangeOf('create', backing, { accountIds, actorUserId: currentUserId() }));
          }
        } catch {
          // Nothing was applied to the cache yet — nothing to undo.
        }
      },
      invalidatesTags: (result) => (result && isStillQueued(result.id) ? [] : CONTRIBUTION_TAGS),
    }),
  }),
  overrideExisting: __DEV__,
});

export const {
  useListGoalsQuery,
  useGetGoalQuery,
  useListGoalContributionsInfiniteQuery,
  useCreateGoalMutation,
  useAddContributionMutation,
} = goalsApiSlice;
