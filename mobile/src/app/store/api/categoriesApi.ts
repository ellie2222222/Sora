import { CategoryStatus, type CategoryResponse, type CreateCategoryRequest, type UpdateCategoryRequest } from '@sora/contracts';

import { categoriesApi as categoriesHttp, type CategoryListQuery } from '../../../services/api/categories.ts';
import { guestCategoriesApi } from '../../../services/guest/guestCategories.ts';
import { forEachCachedQueryArgs } from '../../../services/sync/cacheLookup.ts';
import { enqueueOffline, isStillQueued, newLocalId } from '../../../services/sync/offlineEnqueue.ts';
import { isCurrentlyOnline } from '../../../services/sync/networkState.ts';
import { buildOptimisticCategory } from '../../../services/sync/optimisticRecords.ts';
import type { RootState } from '../index.ts';
import { selectIsGuest } from '../authSlice.ts';
import { apiSlice, toQueryFnResult } from './apiSlice.ts';

export type { CategoryListQuery } from '../../../services/api/categories.ts';

const CATEGORY_TAGS = ['Category', 'Budget', 'Dashboard', 'Transaction'] as const;

export const categoriesApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    listCategories: builder.query<CategoryResponse[], CategoryListQuery>({
      queryFn: (query, { getState }) => {
        const isGuest = selectIsGuest(getState() as RootState);
        return toQueryFnResult(() => (isGuest ? guestCategoriesApi.list(query) : categoriesHttp.list(query)));
      },
      providesTags: ['Category'],
    }),
    createCategory: builder.mutation<CategoryResponse, CreateCategoryRequest>({
      queryFn: (body, { getState }) => {
        const isGuest = selectIsGuest(getState() as RootState);
        if (isGuest) return toQueryFnResult(() => guestCategoriesApi.create(body));
        if (!isCurrentlyOnline()) {
          return toQueryFnResult(async () => {
            const localId = newLocalId();
            await enqueueOffline({ entity: 'category', op: 'create', localId, serverId: null, payload: body });
            return buildOptimisticCategory(body, localId);
          });
        }
        return toQueryFnResult(() => categoriesHttp.create(body));
      },
      onQueryStarted: async (_body, { dispatch, queryFulfilled, getState }) => {
        try {
          const { data } = await queryFulfilled;
          if (!isStillQueued(data.id)) return;

          const rootState = getState();
          forEachCachedQueryArgs(rootState, 'listCategories', (args) => {
            dispatch(
              categoriesApiSlice.util.updateQueryData('listCategories', args as CategoryListQuery, (draft) => {
                draft.unshift(data);
              }),
            );
          });
        } catch {
          // Nothing was applied to the cache yet — nothing to undo.
        }
      },
      invalidatesTags: (result) => (result && isStillQueued(result.id) ? [] : CATEGORY_TAGS),
    }),
    updateCategory: builder.mutation<CategoryResponse, { categoryId: string; body: UpdateCategoryRequest }>({
      queryFn: ({ categoryId, body }, { getState }) => {
        const isGuest = selectIsGuest(getState() as RootState);
        if (isGuest) return toQueryFnResult(() => guestCategoriesApi.update(categoryId, body));
        if (!isCurrentlyOnline()) {
          return toQueryFnResult(async () => {
            await enqueueOffline({ entity: 'category', op: 'update', localId: categoryId, serverId: categoryId, payload: body });
            return { ...body } as unknown as CategoryResponse; // Reconciled by onQueryStarted's cache patch below.
          });
        }
        return toQueryFnResult(() => categoriesHttp.update(categoryId, body));
      },
      onQueryStarted: async ({ categoryId, body }, { dispatch, queryFulfilled, getState }) => {
        try {
          await queryFulfilled;
          if (!isStillQueued(categoryId)) return;

          const rootState = getState();
          forEachCachedQueryArgs(rootState, 'listCategories', (args) => {
            dispatch(
              categoriesApiSlice.util.updateQueryData('listCategories', args as CategoryListQuery, (draft) => {
                const item = draft.find((candidate) => candidate.id === categoryId);
                if (item) Object.assign(item, body);
              }),
            );
          });
        } catch {
          // Nothing was applied to the cache yet — nothing to undo.
        }
      },
      invalidatesTags: (_result, _error, { categoryId }) => (isStillQueued(categoryId) ? [] : CATEGORY_TAGS),
    }),
    archiveCategory: builder.mutation<void, string>({
      queryFn: (categoryId, { getState }) => {
        const isGuest = selectIsGuest(getState() as RootState);
        if (isGuest) return toQueryFnResult(() => guestCategoriesApi.archive(categoryId));
        if (!isCurrentlyOnline()) {
          return toQueryFnResult(async () => {
            await enqueueOffline({ entity: 'category', op: 'archive', localId: categoryId, serverId: categoryId, payload: {} });
          });
        }
        return toQueryFnResult(() => categoriesHttp.archive(categoryId));
      },
      onQueryStarted: async (categoryId, { dispatch, queryFulfilled, getState }) => {
        try {
          await queryFulfilled;
          if (!isStillQueued(categoryId)) return;

          const rootState = getState();
          forEachCachedQueryArgs(rootState, 'listCategories', (args) => {
            dispatch(
              categoriesApiSlice.util.updateQueryData('listCategories', args as CategoryListQuery, (draft) => {
                const item = draft.find((candidate) => candidate.id === categoryId);
                if (item) item.status = CategoryStatus.ARCHIVED;
              }),
            );
          });
        } catch {
          // Nothing was applied to the cache yet — nothing to undo.
        }
      },
      invalidatesTags: (_result, _error, categoryId) => (isStillQueued(categoryId) ? [] : CATEGORY_TAGS),
    }),
    deleteCategoryPermanently: builder.mutation<void, string>({
      queryFn: (categoryId, { getState }) => {
        const isGuest = selectIsGuest(getState() as RootState);
        return toQueryFnResult(() =>
          isGuest ? guestCategoriesApi.deletePermanently(categoryId) : categoriesHttp.deletePermanently(categoryId),
        );
      },
      invalidatesTags: CATEGORY_TAGS,
    }),
  }),
  overrideExisting: __DEV__,
});

export const {
  useListCategoriesQuery,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useArchiveCategoryMutation,
  useDeleteCategoryPermanentlyMutation,
} = categoriesApiSlice;
