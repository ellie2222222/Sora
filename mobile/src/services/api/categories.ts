import {
  ROUTES,
  apiUrl,
  type CategoryResponse,
  type CategoryStatus,
  type CategoryType,
  type CreateCategoryRequest,
  type UpdateCategoryRequest,
} from '@sora/contracts';

import { deleteVoid, getList, idempotencyHeaders, patchOne, postOne } from './client.ts';

export interface CategoryListQuery {
  walletId: string;
  type?: CategoryType | undefined;
  status?: CategoryStatus | undefined;
  tree?: boolean | undefined;
}

export const categoriesApi = {
  async list(query: CategoryListQuery): Promise<CategoryResponse[]> {
    const { items } = await getList<CategoryResponse>(apiUrl(ROUTES.categories.list()), query);
    return items;
  },
  create(body: CreateCategoryRequest, idempotencyKey?: string): Promise<CategoryResponse> {
    return postOne<CategoryResponse>(apiUrl(ROUTES.categories.create()), body, idempotencyHeaders(idempotencyKey));
  },
  update(categoryId: string, body: UpdateCategoryRequest, idempotencyKey?: string): Promise<CategoryResponse> {
    return patchOne<CategoryResponse>(
      apiUrl(ROUTES.categories.update(categoryId)),
      body,
      idempotencyHeaders(idempotencyKey),
    );
  },
  archive(categoryId: string, idempotencyKey?: string): Promise<void> {
    return deleteVoid(
      apiUrl(ROUTES.categories.archive(categoryId)),
      { mode: 'archive' },
      idempotencyHeaders(idempotencyKey),
    );
  },
  deletePermanently(categoryId: string, idempotencyKey?: string): Promise<void> {
    return deleteVoid(
      apiUrl(ROUTES.categories.archive(categoryId)),
      { mode: 'permanent' },
      idempotencyHeaders(idempotencyKey),
    );
  },
};
