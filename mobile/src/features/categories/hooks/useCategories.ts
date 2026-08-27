import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { CreateCategoryRequest, UpdateCategoryRequest } from '@sora/contracts';

import { CATEGORY_INVALIDATION_KEYS, queryKeys, type CategoryListParams } from '../../../app/config/queryKeys.ts';
import { categoriesApi } from '../../../services/api/categories.ts';

/** Renaming, archiving, or deleting a category all touch the same cached views. */
function invalidateCategoryCaches(queryClient: QueryClient): void {
  for (const key of CATEGORY_INVALIDATION_KEYS) {
    void queryClient.invalidateQueries({ queryKey: key });
  }
}

export function useCategories(params: CategoryListParams) {
  return useQuery({
    queryKey: queryKeys.categories.list(params),
    queryFn: () => categoriesApi.list(params),
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateCategoryRequest) => categoriesApi.create(body),
    onSuccess: () => invalidateCategoryCaches(queryClient),
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ categoryId, body }: { categoryId: string; body: UpdateCategoryRequest }) =>
      categoriesApi.update(categoryId, body),
    onSuccess: () => invalidateCategoryCaches(queryClient),
  });
}

export function useArchiveCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (categoryId: string) => categoriesApi.archive(categoryId),
    onSuccess: () => invalidateCategoryCaches(queryClient),
  });
}

export function useDeleteCategoryPermanently() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (categoryId: string) => categoriesApi.deletePermanently(categoryId),
    onSuccess: () => invalidateCategoryCaches(queryClient),
  });
}
