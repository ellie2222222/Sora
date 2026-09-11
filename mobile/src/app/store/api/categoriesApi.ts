import type { CategoryResponse, CreateCategoryRequest, UpdateCategoryRequest } from '@sora/contracts';

import { categoriesApi as categoriesHttp, type CategoryListQuery } from '../../../services/api/categories.ts';
import { guestCategoriesApi } from '../../../services/guest/guestCategories.ts';
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
        return toQueryFnResult(() => (isGuest ? guestCategoriesApi.create(body) : categoriesHttp.create(body)));
      },
      invalidatesTags: CATEGORY_TAGS,
    }),
    updateCategory: builder.mutation<CategoryResponse, { categoryId: string; body: UpdateCategoryRequest }>({
      queryFn: ({ categoryId, body }, { getState }) => {
        const isGuest = selectIsGuest(getState() as RootState);
        return toQueryFnResult(() =>
          isGuest ? guestCategoriesApi.update(categoryId, body) : categoriesHttp.update(categoryId, body),
        );
      },
      invalidatesTags: CATEGORY_TAGS,
    }),
    archiveCategory: builder.mutation<void, string>({
      queryFn: (categoryId, { getState }) => {
        const isGuest = selectIsGuest(getState() as RootState);
        return toQueryFnResult(() => (isGuest ? guestCategoriesApi.archive(categoryId) : categoriesHttp.archive(categoryId)));
      },
      invalidatesTags: CATEGORY_TAGS,
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
