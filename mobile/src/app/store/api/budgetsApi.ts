import { BudgetStatus, type BudgetResponse, type CreateBudgetRequest, type UpdateBudgetRequest } from '@sora/contracts';

import { budgetsApi as budgetsHttp, type BudgetListQuery } from '@/services/api';
import { ensureSeeded, guestBudgetsApi } from '@/services/guest';
import { buildOptimisticBudget, enqueueOffline, forEachCachedQueryArgs, isCurrentlyOnline, isStillQueued, newLocalId, setCurrentlyOnline } from '@/services/sync';
import { isNetworkError } from '../../../utils/errors.ts';
import type { RootState } from '../index.ts';
import { selectIsGuest } from '../authSlice.ts';
import { apiSlice, toQueryFnResult } from './apiSlice.ts';

export type { BudgetListQuery } from '@/services/api';

/** `DashboardResponse.activeBudgets` embeds full `BudgetResponse`s, so every mutation here invalidates Dashboard too. */
const BUDGET_TAGS = ['Budget', 'Dashboard'] as const;

export const budgetsApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    listBudgets: builder.query<BudgetResponse[], BudgetListQuery>({
      queryFn: (query, { getState }) => {
        const isGuest = selectIsGuest(getState() as RootState);
        return toQueryFnResult(async () => {
          if (isGuest || !isCurrentlyOnline()) {
            await ensureSeeded();
            return guestBudgetsApi.list(query);
          }
          try {
            return await budgetsHttp.list(query);
          } catch (err) {
            if (isNetworkError(err)) {
              setCurrentlyOnline(false);
              await ensureSeeded();
              return guestBudgetsApi.list(query);
            }
            throw err;
          }
        });
      },
      providesTags: ['Budget'],
    }),
    getBudget: builder.query<BudgetResponse, string>({
      queryFn: (budgetId, { getState }) => {
        const isGuest = selectIsGuest(getState() as RootState);
        return toQueryFnResult(async () => {
          if (isGuest || !isCurrentlyOnline()) {
            await ensureSeeded();
            return guestBudgetsApi.detail(budgetId);
          }
          try {
            return await budgetsHttp.detail(budgetId);
          } catch (err) {
            if (isNetworkError(err)) {
              setCurrentlyOnline(false);
              await ensureSeeded();
              return guestBudgetsApi.detail(budgetId);
            }
            throw err;
          }
        });
      },
      providesTags: ['Budget'],
    }),
    createBudget: builder.mutation<BudgetResponse, CreateBudgetRequest>({
      queryFn: (body, { getState }) => {
        const state = getState() as RootState;
        if (selectIsGuest(state)) return toQueryFnResult(() => guestBudgetsApi.create(body));
        if (!isCurrentlyOnline()) {
          return toQueryFnResult(async () => {
            const localId = newLocalId();
            await enqueueOffline({ entity: 'budget', op: 'create', localId, serverId: null, payload: body });
            return buildOptimisticBudget(body, localId, (state as unknown as Record<string, unknown>)[apiSlice.reducerPath]);
          });
        }
        return toQueryFnResult(() => budgetsHttp.create(body));
      },
      onQueryStarted: async (_body, { dispatch, queryFulfilled, getState }) => {
        try {
          const { data } = await queryFulfilled;
          if (!isStillQueued(data.id)) return;

          const rootState = getState();
          forEachCachedQueryArgs(rootState, 'listBudgets', (args) => {
            dispatch(
              budgetsApiSlice.util.updateQueryData('listBudgets', args as BudgetListQuery, (draft) => {
                draft.unshift(data);
              }),
            );
          });
        } catch {
          // Nothing was applied to the cache yet — nothing to undo.
        }
      },
      invalidatesTags: (result) => (result && isStillQueued(result.id) ? [] : BUDGET_TAGS),
    }),
    updateBudget: builder.mutation<BudgetResponse, { budgetId: string; body: UpdateBudgetRequest }>({
      queryFn: ({ budgetId, body }, { getState }) => {
        const isGuest = selectIsGuest(getState() as RootState);
        if (isGuest) return toQueryFnResult(() => guestBudgetsApi.update(budgetId, body));
        if (!isCurrentlyOnline()) {
          return toQueryFnResult(async () => {
            await enqueueOffline({ entity: 'budget', op: 'update', localId: budgetId, serverId: budgetId, payload: body });
            return { ...body } as unknown as BudgetResponse; // Reconciled by onQueryStarted's cache patch below.
          });
        }
        return toQueryFnResult(() => budgetsHttp.update(budgetId, body));
      },
      onQueryStarted: async ({ budgetId, body }, { dispatch, queryFulfilled, getState }) => {
        try {
          await queryFulfilled;
          if (!isStillQueued(budgetId)) return;

          dispatch(budgetsApiSlice.util.updateQueryData('getBudget', budgetId, (draft) => Object.assign(draft, body)));
          const rootState = getState();
          forEachCachedQueryArgs(rootState, 'listBudgets', (args) => {
            dispatch(
              budgetsApiSlice.util.updateQueryData('listBudgets', args as BudgetListQuery, (draft) => {
                const item = draft.find((candidate) => candidate.id === budgetId);
                if (item) Object.assign(item, body);
              }),
            );
          });
        } catch {
          // Nothing was applied to the cache yet — nothing to undo.
        }
      },
      invalidatesTags: (_result, _error, { budgetId }) => (isStillQueued(budgetId) ? [] : BUDGET_TAGS),
    }),
    archiveBudget: builder.mutation<void, string>({
      queryFn: (budgetId, { getState }) => {
        const isGuest = selectIsGuest(getState() as RootState);
        if (isGuest) return toQueryFnResult(() => guestBudgetsApi.archive(budgetId));
        if (!isCurrentlyOnline()) {
          return toQueryFnResult(async () => {
            await enqueueOffline({ entity: 'budget', op: 'archive', localId: budgetId, serverId: budgetId, payload: {} });
          });
        }
        return toQueryFnResult(() => budgetsHttp.archive(budgetId));
      },
      onQueryStarted: async (budgetId, { dispatch, queryFulfilled, getState }) => {
        try {
          await queryFulfilled;
          if (!isStillQueued(budgetId)) return;

          const rootState = getState();
          forEachCachedQueryArgs(rootState, 'listBudgets', (args) => {
            dispatch(
              budgetsApiSlice.util.updateQueryData('listBudgets', args as BudgetListQuery, (draft) => {
                const item = draft.find((candidate) => candidate.id === budgetId);
                if (item) item.status = BudgetStatus.ARCHIVED;
              }),
            );
          });
        } catch {
          // Nothing was applied to the cache yet — nothing to undo.
        }
      },
      invalidatesTags: (_result, _error, budgetId) => (isStillQueued(budgetId) ? [] : BUDGET_TAGS),
    }),
  }),
  overrideExisting: __DEV__,
});

export const {
  useListBudgetsQuery,
  useGetBudgetQuery,
  useCreateBudgetMutation,
  useUpdateBudgetMutation,
  useArchiveBudgetMutation,
} = budgetsApiSlice;
