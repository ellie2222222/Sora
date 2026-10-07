/**
 * Categories CRUD (§10 of the API specification).
 *
 * `transactionCount` drives the delete flow the mobile app presents (§10.4):
 * the client reads it from GET before offering rename/archive/permanent-delete,
 * and the server enforces the same rule independently rather than trusting
 * that client-side gate.
 */

import { Injectable } from '@nestjs/common';
import { sql, type Kysely, type Transaction } from 'kysely';

import {
  CategoryStatus,
  type CategoryResponse,
  type CategoryType,
  type CreateCategoryRequest,
  type UpdateCategoryRequest,
} from '@sora/contracts';

import { AUDIT_EVENTS, ENTITY_TYPES } from '../audit/audit-events.ts';
import { AuditService } from '../audit/audit.service.ts';
import { AppError } from '../common/app-error.ts';
import type { AuthenticatedUser } from '../common/decorators.ts';
import { paginated, type Enveloped } from '../common/envelope.ts';
import { offsetOf, paginationMeta, type PageQuery } from '../common/pagination.ts';
import { translatingPgErrors } from '../common/pg-error.ts';
import { DatabaseService } from '../database/database.service.ts';
import type { DB } from '../database/types.ts';
import { lockWalletWritable, WalletAccessService, type WalletAccess } from '../wallets/wallet-access.service.ts';
import { localizedCategoryName } from './category-name.ts';

export type CategoryDeleteMode = 'archive' | 'permanent';

export interface CategoryListQuery extends PageQuery {
  walletId: string;
  type?: CategoryType;
  status?: CategoryStatus;
  tree?: boolean;
}

interface CategoryRow {
  id: string;
  wallet_id: string;
  parent_id: string | null;
  system_key: string | null;
  name: string;
  /** `name` as the caller reads it: translated for a starter category (`localizedCategoryName`). */
  display_name: string;
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

  /** The flat list is paged; `tree` returns the whole tree, since a page of one would cut children from their parents. */
  async list(user: AuthenticatedUser, query: CategoryListQuery): Promise<CategoryResponse[] | Enveloped<CategoryResponse[]>> {
    await this.access.require(user.id, query.walletId, 'VIEWER');

    let builder = this.database.db.selectFrom('categories').where('wallet_id', '=', query.walletId);
    if (query.type) builder = builder.where('type', '=', query.type);
    if (query.status) builder = builder.where('status', '=', query.status);
    // Sorted by the name the caller reads; an id tie-break, so offset paging never repeats or skips a row between pages.
    const ordered = builder
      .selectAll()
      .select(localizedCategoryName('categories').as('display_name'))
      .orderBy(localizedCategoryName('categories'), 'asc')
      .orderBy('id', 'asc');

    if (query.tree) return buildTree(await this.withCounts(await ordered.execute()));

    const [rows, totalRow] = await Promise.all([
      ordered.limit(query.pageSize).offset(offsetOf(query)).execute(),
      builder.select((eb) => eb.fn.countAll<string>().as('count')).executeTakeFirstOrThrow(),
    ]);
    return paginated(await this.withCounts(rows), paginationMeta(query.page, query.pageSize, Number(totalRow.count)));
  }

  private async withCounts(rows: readonly CategoryRow[]): Promise<CategoryResponse[]> {
    const counts = await this.transactionCounts(rows.map((row) => row.id));
    return rows.map((row) => toCategoryResponse(row, counts.get(row.id) ?? 0));
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
      if (parent.wallet_id !== request.walletId) {
        // AC-01: a parent in a wallet the caller can't see reads as missing, not as someone else's.
        if ((await this.access.roleOn(user.id, parent.wallet_id)) === null) throw new AppError('CATEGORY_NOT_FOUND');
        throw new AppError('CATEGORY_WRONG_WALLET');
      }
      if (parent.type !== request.type) throw new AppError('CATEGORY_WRONG_TYPE');
      await this.assertNoCycle(parent.id);
    }
    await this.assertNameFree(request.walletId, request.parentId ?? null, request.name);

    const created = await this.database.db.transaction().execute(async (trx) => {
      await lockWalletWritable(trx, request.walletId);
      if (request.parentId) {
        const parent = await trx
          .selectFrom('categories')
          .select('status')
          .where('id', '=', request.parentId)
          .forShare()
          .executeTakeFirst();
        if (parent?.status === CategoryStatus.ARCHIVED) throw new AppError('CATEGORY_PARENT_ARCHIVED');
      }

      const inserted = await translatingPgErrors(() =>
        trx
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

      await this.audit.record(
        {
          event: AUDIT_EVENTS.CATEGORY_CREATED,
          entityType: ENTITY_TYPES.CATEGORY,
          entityId: inserted.id,
          actorId: user.id,
          walletId: request.walletId,
          actorRole: access.role,
          ip,
        },
        trx,
      );
      return inserted;
    });

    return toCategoryResponse(await this.categoryRow(created.id), 0);
  }

  async update(
    user: AuthenticatedUser,
    categoryId: string,
    request: UpdateCategoryRequest,
    ip: string | null,
  ): Promise<CategoryResponse> {
    const { category, access } = await this.requireCategoryAccess(user.id, categoryId, 'EDITOR');
    // Sending back the name the caller already sees is not a rename, so it keeps a starter category translatable.
    const renamed = request.name !== undefined && request.name !== category.display_name;
    if (renamed) await this.assertNameFree(category.wallet_id, category.parent_id, request.name!, category.id);

    const updated = await this.database.db.transaction().execute(async (trx) => {
      let subtree: string[] = [];
      if (request.status !== undefined) {
        const locked = await lockWalletCategories(trx, category.wallet_id);
        const current = locked.find((row) => row.id === category.id);
        if (!current) throw new AppError('CATEGORY_NOT_FOUND');
        // Archiving through PATCH holds the same guard and cascade as DELETE (§10.4).
        if (request.status === CategoryStatus.ARCHIVED && current.status !== CategoryStatus.ARCHIVED) {
          subtree = [category.id, ...descendantLevels(locked, category.id).flat()];
          await assertNotBudgeted(trx, subtree);
        }
        // Restoring a child under an archived parent would leave it selectable inside a hidden subtree.
        const parent = current.parent_id ? locked.find((row) => row.id === current.parent_id) : undefined;
        if (request.status === CategoryStatus.ACTIVE && parent?.status === CategoryStatus.ARCHIVED) {
          throw new AppError('CATEGORY_PARENT_ARCHIVED');
        }
      }

      const row = await translatingPgErrors(() =>
        trx
          .updateTable('categories')
          .set({
            // A renamed starter category becomes the user's own text, shown as typed in every locale.
            ...(renamed ? { name: request.name, system_key: null } : {}),
            ...(request.icon !== undefined ? { icon: request.icon } : {}),
            ...(request.color !== undefined ? { color: request.color } : {}),
            ...(request.status !== undefined ? { status: request.status } : {}),
            updated_at: new Date(),
          })
          .where('id', '=', category.id)
          .returningAll()
          .executeTakeFirst(),
      );
      if (!row) throw new AppError('CATEGORY_NOT_FOUND');
      if (subtree.length > 0) await this.archiveSubtree(trx, user, category, subtree, access, ip);

      await this.audit.record(
        {
          event: AUDIT_EVENTS.CATEGORY_UPDATED,
          entityType: ENTITY_TYPES.CATEGORY,
          entityId: category.id,
          actorId: user.id,
          walletId: access.walletId,
          actorRole: access.role,
          ip,
        },
        trx,
      );
      return row;
    });

    const counts = await this.transactionCounts([updated.id]);
    return toCategoryResponse(await this.categoryRow(updated.id), counts.get(updated.id) ?? 0);
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
    if (category.status === CategoryStatus.ARCHIVED) return;
    await this.database.db.transaction().execute(async (trx) => {
      const locked = await lockWalletCategories(trx, category.wallet_id);
      if (locked.find((row) => row.id === category.id)?.status !== CategoryStatus.ACTIVE) return;
      const subtree = [category.id, ...descendantLevels(locked, category.id).flat()];
      await assertNotBudgeted(trx, subtree);
      await this.archiveSubtree(trx, user, category, subtree, access, ip);
    });
  }

  private async archiveSubtree(
    trx: Transaction<DB>,
    user: AuthenticatedUser,
    category: CategoryRow,
    subtree: readonly string[],
    access: WalletAccess,
    ip: string | null,
  ): Promise<void> {
    await trx
      .updateTable('categories')
      .set({ status: CategoryStatus.ARCHIVED, updated_at: new Date() })
      .where('id', 'in', [...subtree])
      .execute();

    await this.audit.record(
      {
        event: AUDIT_EVENTS.CATEGORY_ARCHIVED,
        entityType: ENTITY_TYPES.CATEGORY,
        entityId: category.id,
        actorId: user.id,
        walletId: access.walletId,
        actorRole: access.role,
        ip,
      },
      trx,
    );
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
    await this.database.db.transaction().execute(async (trx) => {
      const levels = descendantLevels(await lockWalletCategories(trx, category.wallet_id), category.id);
      const subtree = [category.id, ...levels.flat()];
      const counts = await this.transactionCounts(subtree, trx);
      if (subtree.some((id) => (counts.get(id) ?? 0) > 0)) throw new AppError('CATEGORY_HAS_TRANSACTIONS');
      // A budget still names the category (FK), so it is in use rather than deletable.
      const budget = await trx.selectFrom('budgets').select('id').where('category_id', 'in', subtree).executeTakeFirst();
      if (budget) throw new AppError('CATEGORY_IN_USE');

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
      .select(localizedCategoryName('categories').as('display_name'))
      .where('id', '=', categoryId)
      .executeTakeFirst();
    if (!row) throw new AppError('CATEGORY_NOT_FOUND');
    return row;
  }

  /**
   * Checks both names a sibling has: what the caller reads, so a custom "Ăn uống" can't sit beside the starter
   * Food shown as "Ăn uống", and the stored one `uq_category_name_per_parent` compares, for a clean 409 first.
   */
  private async assertNameFree(walletId: string, parentId: string | null, name: string, exceptId?: string): Promise<void> {
    let siblings = this.database.db
      .selectFrom('categories')
      .select('id')
      .where('wallet_id', '=', walletId)
      .where((eb) =>
        eb.or([
          eb(sql`LOWER(${localizedCategoryName('categories')})`, '=', name.toLowerCase()),
          eb(sql`LOWER(categories.name)`, '=', name.toLowerCase()),
        ]),
      );
    siblings = parentId === null ? siblings.where('parent_id', 'is', null) : siblings.where('parent_id', '=', parentId);
    if (exceptId !== undefined) siblings = siblings.where('id', '!=', exceptId);
    if (await siblings.executeTakeFirst()) throw new AppError('CATEGORY_DUPLICATE_NAME');
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

  /** How many transactions (any status — a deleted one still happened) name each id. */
  private async transactionCounts(
    categoryIds: readonly string[],
    executor: Kysely<DB> | Transaction<DB> = this.database.db,
  ): Promise<Map<string, number>> {
    if (categoryIds.length === 0) return new Map();

    const rows = await executor
      .selectFrom('transactions')
      .select(({ fn }) => ['category_id', fn.countAll<string>().as('total')])
      .where('category_id', 'in', [...categoryIds])
      .groupBy('category_id')
      .execute();

    return new Map(rows.map((row) => [row.category_id as string, Number(row.total)]));
  }
}

interface LockedCategory {
  id: string;
  parent_id: string | null;
  status: CategoryStatus;
}

/**
 * Locks every category of the wallet, in id order, before an archive, restore or permanent delete
 * reads the tree. A create under any of them share-locks its parent and a budget create its
 * category, so neither can land on a category this is about to archive, and the subtree read from
 * the locked rows is complete: no child can be added under it meanwhile.
 */
async function lockWalletCategories(trx: Transaction<DB>, walletId: string): Promise<LockedCategory[]> {
  return trx
    .selectFrom('categories')
    .select(['id', 'parent_id', 'status'])
    .where('wallet_id', '=', walletId)
    .orderBy('id')
    .forUpdate()
    .execute();
}

/** Direct-children levels below `rootId`, shallowest first. */
function descendantLevels(rows: readonly LockedCategory[], rootId: string): string[][] {
  const levels: string[][] = [];
  let frontier = new Set([rootId]);
  while (frontier.size > 0) {
    const level = rows.filter((row) => row.parent_id !== null && frontier.has(row.parent_id)).map((row) => row.id);
    if (level.length === 0) break;
    levels.push(level);
    frontier = new Set(level);
  }
  return levels;
}

/** Refused while a budget plans for any of them: it would lose its category and never compute a period again. */
async function assertNotBudgeted(trx: Transaction<DB>, subtree: readonly string[]): Promise<void> {
  const budget = await trx.selectFrom('budgets').select('id').where('category_id', 'in', [...subtree]).executeTakeFirst();
  if (budget) throw new AppError('CATEGORY_IN_USE');
}

function toCategoryResponse(row: CategoryRow, transactionCount: number): CategoryResponse {
  return {
    id: row.id,
    walletId: row.wallet_id,
    parentId: row.parent_id,
    systemKey: row.system_key,
    name: row.display_name,
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
