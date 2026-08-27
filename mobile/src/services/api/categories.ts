import {
  ROUTES,
  apiUrl,
  type CategoryResponse,
  type CategoryStatus,
  type CategoryType,
  type CreateCategoryRequest,
  type UpdateCategoryRequest,
} from '@sora/contracts';

import { deleteVoid, getList, patchOne, postOne } from './client.ts';

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
  create(body: CreateCategoryRequest): Promise<CategoryResponse> {
    return postOne<CategoryResponse>(apiUrl(ROUTES.categories.create()), body);
  },
  update(categoryId: string, body: UpdateCategoryRequest): Promise<CategoryResponse> {
    return patchOne<CategoryResponse>(apiUrl(ROUTES.categories.update(categoryId)), body);
  },
  archive(categoryId: string): Promise<void> {
    return deleteVoid(apiUrl(ROUTES.categories.archive(categoryId)), { mode: 'archive' });
  },
  deletePermanently(categoryId: string): Promise<void> {
    return deleteVoid(apiUrl(ROUTES.categories.archive(categoryId)), { mode: 'permanent' });
  },
};
