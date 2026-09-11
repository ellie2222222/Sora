import type { BudgetResponse, CreateBudgetRequest, UpdateBudgetRequest } from '@sora/contracts';

import { budgetsApi as budgetsHttp, type BudgetListQuery } from '../../../services/api/budgets.ts';
import { guestBudgetsApi } from '../../../services/guest/guestBudgets.ts';
import type { RootState } from '../index.ts';
import { selectIsGuest } from '../authSlice.ts';
import { apiSlice, toQueryFnResult } from './apiSlice.ts';

export type { BudgetListQuery } from '../../../services/api/budgets.ts';

/** `DashboardResponse.activeBudgets` embeds full `BudgetResponse`s, so every mutation here invalidates Dashboard too. */
const BUDGET_TAGS = ['Budget', 'Dashboard'] as const;

export const budgetsApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    listBudgets: builder.query<BudgetResponse[], BudgetListQuery>({
      queryFn: (query, { getState }) => {
        const isGuest = selectIsGuest(getState() as RootState);
        return toQueryFnResult(() => (isGuest ? guestBudgetsApi.list(query) : budgetsHttp.list(query)));
      },
      providesTags: ['Budget'],
    }),
    getBudget: builder.query<BudgetResponse, string>({
      queryFn: (budgetId, { getState }) => {
        const isGuest = selectIsGuest(getState() as RootState);
        return toQueryFnResult(() => (isGuest ? guestBudgetsApi.detail(budgetId) : budgetsHttp.detail(budgetId)));
      },
      providesTags: ['Budget'],
    }),
    createBudget: builder.mutation<BudgetResponse, CreateBudgetRequest>({
      queryFn: (body, { getState }) => {
        const isGuest = selectIsGuest(getState() as RootState);
        return toQueryFnResult(() => (isGuest ? guestBudgetsApi.create(body) : budgetsHttp.create(body)));
      },
      invalidatesTags: BUDGET_TAGS,
    }),
    updateBudget: builder.mutation<BudgetResponse, { budgetId: string; body: UpdateBudgetRequest }>({
      queryFn: ({ budgetId, body }, { getState }) => {
        const isGuest = selectIsGuest(getState() as RootState);
        return toQueryFnResult(() =>
          isGuest ? guestBudgetsApi.update(budgetId, body) : budgetsHttp.update(budgetId, body),
        );
      },
      invalidatesTags: BUDGET_TAGS,
    }),
    archiveBudget: builder.mutation<void, string>({
      queryFn: (budgetId, { getState }) => {
        const isGuest = selectIsGuest(getState() as RootState);
        return toQueryFnResult(() => (isGuest ? guestBudgetsApi.archive(budgetId) : budgetsHttp.archive(budgetId)));
      },
      invalidatesTags: BUDGET_TAGS,
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
