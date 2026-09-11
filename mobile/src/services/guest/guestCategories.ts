/**
 * Guest-mode categories repository — the local mirror of `categoriesApi`.
 *
 * Cycle prevention mirrors `categories.service.ts`'s `assertNoCycle` (a walk
 * up the parent chain), and the duplicate-name rule mirrors the unique index
 * `uq_category_name_per_parent`: scoped to `(walletId, parentId, LOWER(name))`
 * — the same wallet, the same parent (or both root), case-insensitive —
 * with no `type` in the key (db/migrations/001_initial_wallet_schema.sql:188-189).
 */

import {
  createCategorySchema,
  updateCategorySchema,
  type CategoryResponse,
  type CategoryStatus,
  type CategoryType,
  type CreateCategoryRequest,
  type UpdateCategoryRequest,
} from '@sora/contracts';

import { fromZodError, guestError } from './guestErrors.ts';
import { newLocalId } from './guestIds.ts';
import { guestStore } from './guestStorage.ts';
import { type GuestCategory, type GuestWallet } from './guestStore.ts';

export type CategoryDeleteMode = 'archive' | 'permanent';

export interface CategoryListQuery {
  walletId: string;
  type?: CategoryType | undefined;
  status?: CategoryStatus | undefined;
  tree?: boolean | undefined;
}

function requireWallet(): GuestWallet {
  const wallet = guestStore.current().wallet;
  if (!wallet) throw guestError('WALLET_NOT_FOUND');
  return wallet;
}

function findCategory(categories: readonly GuestCategory[], categoryId: string): GuestCategory {
  const category = categories.find((candidate) => candidate.id === categoryId);
  if (!category) throw guestError('CATEGORY_NOT_FOUND');
  return category;
}

function transactionCount(transactions: readonly { categoryId: string | null }[], categoryId: string): number {
  return transactions.filter((transaction) => transaction.categoryId === categoryId).length;
}

function toCategoryResponse(category: GuestCategory, count: number): CategoryResponse {
  return {
    id: category.id,
    walletId: category.walletId,
    parentId: category.parentId,
    name: category.name,
    type: category.type,
    icon: category.icon,
    color: category.color,
    status: category.status,
    transactionCount: count,
  };
}

/** Flat rows -> roots with `children` populated, for `?tree=true` (§10.1). */
function buildTree(responses: readonly CategoryResponse[]): CategoryResponse[] {
  const byId = new Map(responses.map((response) => [response.id, { ...response, children: [] as CategoryResponse[] }]));
  const roots: CategoryResponse[] = [];

  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  return roots;
}

/** Walks the parent chain, mirroring `categories.service.ts`'s cycle guard. */
function assertNoCycle(categories: readonly GuestCategory[], startId: string): void {
  const visited = new Set<string>();
  let currentId: string | null = startId;

  while (currentId) {
    if (visited.has(currentId)) throw guestError('CATEGORY_CYCLE');
    visited.add(currentId);
    currentId = categories.find((candidate) => candidate.id === currentId)?.parentId ?? null;
  }
}

function assertUniqueName(
  categories: readonly GuestCategory[],
  walletId: string,
  parentId: string | null,
  name: string,
  excludingCategoryId?: string,
): void {
  const collides = categories.some(
    (category) =>
      category.id !== excludingCategoryId &&
      category.walletId === walletId &&
      category.parentId === parentId &&
      category.name.toLowerCase() === name.toLowerCase(),
  );
  if (collides) throw guestError('CATEGORY_DUPLICATE_NAME');
}

/** Direct-children levels below `rootId`, shallowest first. */
function collectDescendantLevels(categories: readonly GuestCategory[], rootId: string): string[][] {
  const levels: string[][] = [];
  let frontier = [rootId];

  while (frontier.length > 0) {
    const children = categories.filter((category) => category.parentId && frontier.includes(category.parentId));
    if (children.length === 0) break;
    frontier = children.map((category) => category.id);
    levels.push(frontier);
  }

  return levels;
}

export const guestCategoriesApi = {
  async list(query: CategoryListQuery): Promise<CategoryResponse[]> {
    requireWallet();
    const { categories, transactions } = guestStore.current();

    const responses = categories
      .filter((category) => !query.type || category.type === query.type)
      .filter((category) => !query.status || category.status === query.status)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((category) => toCategoryResponse(category, transactionCount(transactions, category.id)));

    return query.tree ? buildTree(responses) : responses;
  },

  async create(body: CreateCategoryRequest): Promise<CategoryResponse> {
    const wallet = requireWallet();
    const parsed = createCategorySchema.safeParse(body);
    if (!parsed.success) throw fromZodError(parsed.error);
    const request = parsed.data;

    const { categories } = guestStore.current();
    const parentId = request.parentId ?? null;

    if (parentId) {
      const parent = findCategory(categories, parentId);
      if (parent.walletId !== wallet.id) throw guestError('CATEGORY_WRONG_WALLET');
      if (parent.type !== request.type) throw guestError('CATEGORY_WRONG_TYPE');
      assertNoCycle(categories, parent.id);
    }

    assertUniqueName(categories, wallet.id, parentId, request.name);

    const now = new Date().toISOString();
    const category: GuestCategory = {
      id: newLocalId(),
      walletId: wallet.id,
      parentId,
      name: request.name,
      type: request.type,
      icon: request.icon ?? null,
      color: request.color ?? null,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };

    await guestStore.mutate((current) => ({ ...current, categories: [...current.categories, category] }));
    return toCategoryResponse(category, 0);
  },

  async update(categoryId: string, body: UpdateCategoryRequest): Promise<CategoryResponse> {
    const wallet = requireWallet();
    const parsed = updateCategorySchema.safeParse(body);
    if (!parsed.success) throw fromZodError(parsed.error);
    const patch = parsed.data;

    const { categories, transactions } = guestStore.current();
    const existing = findCategory(categories, categoryId);

    if (patch.name !== undefined) {
      assertUniqueName(categories, wallet.id, existing.parentId, patch.name, existing.id);
    }

    const updated: GuestCategory = {
      ...existing,
      name: patch.name ?? existing.name,
      icon: patch.icon !== undefined ? patch.icon : existing.icon,
      color: patch.color !== undefined ? patch.color : existing.color,
      status: patch.status ?? existing.status,
      updatedAt: new Date().toISOString(),
    };

    await guestStore.mutate((current) => ({
      ...current,
      categories: current.categories.map((candidate) => (candidate.id === categoryId ? updated : candidate)),
    }));

    return toCategoryResponse(updated, transactionCount(transactions, updated.id));
  },

  async archive(categoryId: string): Promise<void> {
    const { categories, budgets } = guestStore.current();
    const existing = findCategory(categories, categoryId);
    if (existing.status === 'ARCHIVED') return;

    const activeBudget = budgets.some((budget) => budget.categoryId === categoryId && budget.status === 'ACTIVE');
    if (activeBudget) throw guestError('CATEGORY_IN_USE');

    const descendantIds = collectDescendantLevels(categories, categoryId).flat();
    const now = new Date().toISOString();

    await guestStore.mutate((current) => ({
      ...current,
      categories: current.categories.map((candidate) =>
        candidate.id === categoryId || descendantIds.includes(candidate.id)
          ? { ...candidate, status: 'ARCHIVED' as const, updatedAt: now }
          : candidate,
      ),
    }));
  },

  /**
   * Hard delete — only reachable when nothing in the subtree still points at
   * a transaction. Mirrors `categories.service.ts`'s `deletePermanently`.
   */
  async deletePermanently(categoryId: string): Promise<void> {
    const { categories, transactions } = guestStore.current();
    findCategory(categories, categoryId);

    const levels = collectDescendantLevels(categories, categoryId);
    const descendantIds = levels.flat();
    const removedIds = [categoryId, ...descendantIds];

    if (removedIds.some((id) => transactionCount(transactions, id) > 0)) {
      throw guestError('CATEGORY_HAS_TRANSACTIONS');
    }

    await guestStore.mutate((current) => ({
      ...current,
      categories: current.categories.filter((candidate) => !removedIds.includes(candidate.id)),
    }));
  },
};
