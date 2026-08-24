/**
 * Categories CRUD (§10 of the API specification).
 *
 * `transactionCount` drives the delete flow the mobile app presents (§10.4):
 * the client reads it from GET before offering rename/archive/permanent-delete,
 * and the server enforces the same rule independently rather than trusting
 * that client-side gate.
 */

import { Injectable } from '@nestjs/common';

import {
  type CategoryResponse,
  type CategoryStatus,
  type CategoryType,
  type CreateCategoryRequest,
  type UpdateCategoryRequest,
} from '@finance/contracts';

import { AUDIT_EVENTS, ENTITY_TYPES } from '../audit/audit-events.ts';
import { AuditService } from '../audit/audit.service.ts';
import { AppError } from '../common/app-error.ts';
import type { AuthenticatedUser } from '../common/decorators.ts';
import { translatingPgErrors } from '../common/pg-error.ts';
import { DatabaseService } from '../database/database.service.ts';
import { WalletAccessService, type WalletAccess } from '../wallets/wallet-access.service.ts';

export type CategoryDeleteMode = 'archive' | 'permanent';

export interface CategoryListQuery {
  walletId: string;
  type?: CategoryType;
  status?: CategoryStatus;
  tree?: boolean;
}

interface CategoryRow {
  id: string;
  wallet_id: string;
  parent_id: string | null;
  name: string;
  type: CategoryType;
  icon: string | null;
  color: string | null;
  status: CategoryStatus;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class CategoriesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly access: WalletAccessService,
    private readonly audit: AuditService,
  ) {}

  async list(user: AuthenticatedUser, query: CategoryListQuery): Promise<CategoryResponse[]> {
    await this.access.require(user.id, query.walletId, 'VIEWER');

    let builder = this.database.db
      .selectFrom('categories')
      .selectAll()
      .where('wallet_id', '=', query.walletId);
    if (query.type) builder = builder.where('type', '=', query.type);
    if (query.status) builder = builder.where('status', '=', query.status);

    const rows = await builder.orderBy('name', 'asc').execute();
    const counts = await this.transactionCounts(rows.map((row) => row.id));
    const responses = rows.map((row) => toCategoryResponse(row, counts.get(row.id) ?? 0));

    return query.tree ? buildTree(responses) : responses;
  }

  /**
   * `parentId`'s wallet/type match and cycle-freedom are checked here rather
   * than left to the DB: `chk_category_not_own_parent` only rejects a category
   * naming itself, and a wrong-wallet/wrong-type parent needs its own error
   * code, not a generic constraint violation.
   */
  async create(
    user: AuthenticatedUser,
    request: CreateCategoryRequest,
    ip: string | null,
  ): Promise<CategoryResponse> {
    const access = await this.access.requireWritable(user.id, request.walletId, 'EDITOR');

    if (request.parentId) {
      const parent = await this.categoryRow(request.parentId);
      if (parent.wallet_id !== request.walletId) throw new AppError('CATEGORY_WRONG_WALLET');
      if (parent.type !== request.type) throw new AppError('CATEGORY_WRONG_TYPE');
      await this.assertNoCycle(parent.id);
    }

    const row = await translatingPgErrors(() =>
      this.database.db
        .insertInto('categories')
        .values({
          wallet_id: request.walletId,
          parent_id: request.parentId ?? null,
          name: request.name,
          type: request.type,
          icon: request.icon ?? null,
          color: request.color ?? null,
        })
        .returningAll()
        .executeTakeFirstOrThrow(),
    );

    await this.audit.record({
      event: AUDIT_EVENTS.CATEGORY_CREATED,
      entityType: ENTITY_TYPES.CATEGORY,
      entityId: row.id,
      actorId: user.id,
      walletId: request.walletId,
      actorRole: access.role,
      ip,
    });

    return toCategoryResponse(row, 0);
  }

  async update(
    user: AuthenticatedUser,
    categoryId: string,
    request: UpdateCategoryRequest,
    ip: string | null,
  ): Promise<CategoryResponse> {
    const { category, access } = await this.requireCategoryAccess(user.id, categoryId, 'EDITOR');

    const updated = await translatingPgErrors(() =>
      this.database.db
        .updateTable('categories')
        .set({
          ...(request.name !== undefined ? { name: request.name } : {}),
          ...(request.icon !== undefined ? { icon: request.icon } : {}),
          ...(request.color !== undefined ? { color: request.color } : {}),
          ...(request.status !== undefined ? { status: request.status } : {}),
          updated_at: new Date(),
        })
        .where('id', '=', category.id)
        .returningAll()
        .executeTakeFirst(),
    );
    if (!updated) throw new AppError('CATEGORY_NOT_FOUND');

    await this.audit.record({
      event: AUDIT_EVENTS.CATEGORY_UPDATED,
      entityType: ENTITY_TYPES.CATEGORY,
      entityId: category.id,
      actorId: user.id,
      walletId: access.walletId,
      actorRole: access.role,
      ip,
    });

    const counts = await this.transactionCounts([updated.id]);
    return toCategoryResponse(updated, counts.get(updated.id) ?? 0);
  }

  /** DELETE /categories/{id} — `mode` picks the archive or permanent path (§10.4). */
  async remove(
    user: AuthenticatedUser,
    categoryId: string,
    mode: CategoryDeleteMode,
    ip: string | null,
  ): Promise<void> {
    const { category, access } = await this.requireCategoryAccess(user.id, categoryId, 'EDITOR');

    if (mode === 'permanent') {
      await this.deletePermanently(user, category, access, ip);
    } else {
      await this.archive(user, category, access, ip);
    }
  }

  /**
   * `status = ARCHIVED`, cascaded onto every descendant so none is left ACTIVE
   * under an archived ancestor — a picker that only excludes the archived root
   * would otherwise still offer an orphaned-looking child.
   */
  private async archive(
    user: AuthenticatedUser,
    category: CategoryRow,
    access: WalletAccess,
    ip: string | null,
  ): Promise<void> {
    if (category.status === 'ARCHIVED') return;

    const activeBudget = await this.database.db
      .selectFrom('budgets')
      .select('id')
      .where('category_id', '=', category.id)
      .where('status', '=', 'ACTIVE')
      .executeTakeFirst();
    if (activeBudget) throw new AppError('CATEGORY_IN_USE');

    const descendantIds = (await this.collectDescendantLevels(category.id)).flat();

    await this.database.db
      .updateTable('categories')
      .set({ status: 'ARCHIVED', updated_at: new Date() })
      .where('id', 'in', [category.id, ...descendantIds])
      .execute();

    await this.audit.record({
      event: AUDIT_EVENTS.CATEGORY_ARCHIVED,
      entityType: ENTITY_TYPES.CATEGORY,
      entityId: category.id,
      actorId: user.id,
      walletId: access.walletId,
      actorRole: access.role,
      ip,
    });
  }

  /**
   * Hard delete — only reachable when nothing, anywhere in the subtree, still
   * points at a transaction. A descendant with zero transactions is deleted
   * alongside the root (deepest level first, so the self-referencing
   * `parent_id` FK never sees a child outlive its parent); one that still has
   * transactions blocks the whole operation, since deleting it would destroy
   * real ledger history no matter its own archived status.
   */
  private async deletePermanently(
    user: AuthenticatedUser,
    category: CategoryRow,
    access: WalletAccess,
    ip: string | null,
  ): Promise<void> {
    const levels = await this.collectDescendantLevels(category.id);
    const descendantIds = levels.flat();
    const counts = await this.transactionCounts([category.id, ...descendantIds]);

    if ((counts.get(category.id) ?? 0) > 0) throw new AppError('CATEGORY_HAS_TRANSACTIONS');
    if (descendantIds.some((id) => (counts.get(id) ?? 0) > 0)) {
      throw new AppError('CATEGORY_HAS_TRANSACTIONS');
    }

    await this.database.db.transaction().execute(async (trx) => {
      await this.audit.record(
        {
          event: AUDIT_EVENTS.CATEGORY_DELETED,
          entityType: ENTITY_TYPES.CATEGORY,
          entityId: category.id,
          actorId: user.id,
          walletId: access.walletId,
          actorRole: access.role,
          ip,
        },
        trx,
      );

      for (const level of [...levels].reverse()) {
        await trx.deleteFrom('categories').where('id', 'in', level).execute();
      }
      await trx.deleteFrom('categories').where('id', '=', category.id).execute();
    });
  }

  /**
   * The category and the caller's role on its wallet, resolved from the
   * category id alone since the route only carries that. A no-membership
   * failure is rethrown as CATEGORY_NOT_FOUND rather than the wallet's own
   * code — from this route's perspective the category is what does not
   * resolve, the same "no access looks like absence" rule
   * `WalletAccessService` applies everywhere else.
   */
  private async requireCategoryAccess(
    userId: string,
    categoryId: string,
    required: 'VIEWER' | 'EDITOR' | 'OWNER',
  ): Promise<{ category: CategoryRow; access: WalletAccess }> {
    const category = await this.categoryRow(categoryId);

    try {
      const access = await this.access.require(userId, category.wallet_id, required);
      return { category, access };
    } catch (error) {
      if (error instanceof AppError && error.code === 'WALLET_NOT_FOUND') {
        throw new AppError('CATEGORY_NOT_FOUND');
      }
      throw error;
    }
  }

  private async categoryRow(categoryId: string): Promise<CategoryRow> {
    const row = await this.database.db
      .selectFrom('categories')
      .selectAll()
      .where('id', '=', categoryId)
      .executeTakeFirst();
    if (!row) throw new AppError('CATEGORY_NOT_FOUND');
    return row;
  }

  /** Walks the parent chain, catching a cycle the DB's own self-parent check cannot see. */
  private async assertNoCycle(startId: string): Promise<void> {
    const visited = new Set<string>();
    let currentId: string | null = startId;

    while (currentId) {
      if (visited.has(currentId)) throw new AppError('CATEGORY_CYCLE');
      visited.add(currentId);

      const row = await this.database.db
        .selectFrom('categories')
        .select('parent_id')
        .where('id', '=', currentId)
        .executeTakeFirst();
      currentId = row?.parent_id ?? null;
    }
  }

  /** Direct-children levels below `rootId`, shallowest first. */
  private async collectDescendantLevels(rootId: string): Promise<string[][]> {
    const levels: string[][] = [];
    let frontier = [rootId];

    while (frontier.length > 0) {
      const rows = await this.database.db
        .selectFrom('categories')
        .select('id')
        .where('parent_id', 'in', frontier)
        .execute();
      if (rows.length === 0) break;

      frontier = rows.map((row) => row.id);
      levels.push(frontier);
    }

    return levels;
  }

  /** How many transactions (any status — a cancelled one still happened) name each id. */
  private async transactionCounts(categoryIds: readonly string[]): Promise<Map<string, number>> {
    if (categoryIds.length === 0) return new Map();

    const rows = await this.database.db
      .selectFrom('transactions')
      .select(({ fn }) => ['category_id', fn.countAll<string>().as('total')])
      .where('category_id', 'in', [...categoryIds])
      .groupBy('category_id')
      .execute();

    return new Map(rows.map((row) => [row.category_id as string, Number(row.total)]));
  }
}

function toCategoryResponse(row: CategoryRow, transactionCount: number): CategoryResponse {
  return {
    id: row.id,
    walletId: row.wallet_id,
    parentId: row.parent_id,
    name: row.name,
    type: row.type,
    icon: row.icon,
    color: row.color,
    status: row.status,
    transactionCount,
  };
}

/** Flat rows -> roots with `children` populated, for `?tree=true` (§10.1). */
function buildTree(responses: readonly CategoryResponse[]): CategoryResponse[] {
  const byId = new Map(responses.map((response) => [response.id, { ...response, children: [] as CategoryResponse[] }]));
  const roots: CategoryResponse[] = [];

  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}
