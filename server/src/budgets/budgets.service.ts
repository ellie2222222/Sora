/**
 * Budgets CRUD (§12 of the API specification).
 *
 * `spent`/`remaining`/`usagePercentage`/`isOverBudget` are never stored — they
 * are recomputed from completed EXPENSE transactions via @sora/contracts'
 * calc.ts, the same functions the mobile app uses for optimistic values, so
 * this layer can never round or classify a transaction differently than the
 * app already did.
 */

import { Injectable } from '@nestjs/common';
import type { Transaction } from 'kysely';

import {
  calculateBudgetRemaining,
  calculateBudgetSpent,
  calculateBudgetUsage,
  formatMoney,
  isOverBudget,
  parseMoney,
  roleSatisfies,
  BudgetStatus,
  CategoryStatus,
  CategoryType,
  GoalStatus,
  MemberStatus,
  type BudgetPeriodType,
  type BudgetResponse,
  type CreateBudgetRequest,
  type UpdateBudgetRequest,
  type WalletRole,
} from '@sora/contracts';

import { AUDIT_EVENTS, ENTITY_TYPES } from '../audit/audit-events.ts';
import { AuditService } from '../audit/audit.service.ts';
import { AppError } from '../common/app-error.ts';
import type { AuthenticatedUser } from '../common/decorators.ts';
import { paginated, type Enveloped } from '../common/envelope.ts';
import { paginationMeta } from '../common/pagination.ts';
import { translatingPgErrors } from '../common/pg-error.ts';
import { DatabaseService } from '../database/database.service.ts';
import type { DB } from '../database/types.ts';
import { requireGoalInWallet } from '../goals/goal-access.ts';
import { lockWalletWritable, WalletAccessService } from '../wallets/wallet-access.service.ts';
import { spendableExpenses } from './budget-spend.ts';

export interface BudgetListQuery {
  walletId: string;
  status?: BudgetStatus;
  activeOn?: string;
  page: number;
  pageSize: number;
}

interface BudgetRow {
  id: string;
  wallet_id: string;
  category_id: string | null;
  goal_id: string | null;
  name: string;
  amount: string;
  currency: string;
  period_type: BudgetPeriodType;
  start_date: string;
  end_date: string;
  status: BudgetStatus;
  created_at: Date;
  updated_at: Date;
}

interface CategoryRef {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
}

@Injectable()
export class BudgetsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly access: WalletAccessService,
    private readonly audit: AuditService,
  ) {}

  async list(user: AuthenticatedUser, query: BudgetListQuery): Promise<Enveloped<BudgetResponse[]>> {
    await this.access.require(user.id, query.walletId, 'VIEWER');

    let builder = this.database.db.selectFrom('budgets').where('wallet_id', '=', query.walletId);
    if (query.status) builder = builder.where('status', '=', query.status);
    if (query.activeOn) {
      builder = builder
        .where('start_date', '<=', query.activeOn)
        .where('end_date', '>=', query.activeOn);
    }

    const [rows, totalRow] = await Promise.all([
      builder
        .selectAll()
        .orderBy('start_date', 'desc')
        // A tie would otherwise let offset paging repeat or skip a row between pages.
        .orderBy('id', 'desc')
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize)
        .execute(),
      builder.select((eb) => eb.fn.countAll<string>().as('count')).executeTakeFirstOrThrow(),
    ]);
    return paginated(await this.toResponses(rows), paginationMeta(query.page, query.pageSize, Number(totalRow.count)));
  }

  /**
   * `spent` is computed over existing transactions before returning — creating
   * a budget mid-month must immediately show what has already been spent, not
   * zero (§12.2).
   */
  async create(
    user: AuthenticatedUser,
    request: CreateBudgetRequest,
    ip: string | null,
  ): Promise<BudgetResponse> {
    await this.access.requireWritable(user.id, request.walletId, 'EDITOR');
    if (request.categoryId != null) {
      await this.assertBudgetableCategory(user.id, request.walletId, request.categoryId);
    }
    if (request.goalId != null) {
      const status = await requireGoalInWallet(this.database.db, request.walletId, request.goalId);
      if (status !== GoalStatus.ACTIVE) throw new AppError('GOAL_NOT_ACTIVE');
    }

    const row = await this.database.db.transaction().execute(async (trx) => {
      await lockWalletWritable(trx, request.walletId);
      await lockBudgetTarget(trx, request.categoryId ?? null, request.goalId ?? null);
      const inserted = await translatingPgErrors(() =>
        trx
          .insertInto('budgets')
          .values({
            wallet_id: request.walletId,
            category_id: request.categoryId ?? null,
            goal_id: request.goalId ?? null,
            name: request.name,
            amount: request.amount,
            currency: request.currency,
            period_type: request.periodType,
            start_date: request.startDate,
            end_date: request.endDate,
          })
          .returningAll()
          .executeTakeFirstOrThrow(),
      );

      await this.audit.record(
        {
          event: AUDIT_EVENTS.BUDGET_CREATED,
          entityType: ENTITY_TYPES.BUDGET,
          entityId: inserted.id,
          actorId: user.id,
          walletId: request.walletId,
          ip,
        },
        trx,
      );
      return inserted;
    });

    const [response] = await this.toResponses([row]);
    return response!;
  }

  async detail(user: AuthenticatedUser, budgetId: string): Promise<BudgetResponse> {
    const { row } = await this.requireBudgetAccess(user.id, budgetId, 'VIEWER');
    const [response] = await this.toResponses([row]);
    return response!;
  }

  /**
   * `categoryId`, `periodType`, `startDate` and `endDate` are immutable
   * (§12.4) — moving a window changes which transactions the budget ever
   * covered, which is a different budget. Only `name`/`amount`/`status` are
   * writable, so the update never has to re-derive the overlap window.
   */
  async update(
    user: AuthenticatedUser,
    budgetId: string,
    request: UpdateBudgetRequest,
    ip: string | null,
  ): Promise<BudgetResponse> {
    const { walletId, row: current } = await this.requireBudgetAccess(user.id, budgetId, 'EDITOR');

    const row = await this.database.db.transaction().execute(async (trx) => {
      // Reactivating must meet create's rule: its category or goal may have been archived since.
      if (request.status === BudgetStatus.ACTIVE) await lockBudgetTarget(trx, current.category_id, current.goal_id);

      const updated = await translatingPgErrors(() =>
        trx
          .updateTable('budgets')
          .set({
            ...(request.name !== undefined ? { name: request.name } : {}),
            ...(request.amount !== undefined ? { amount: request.amount } : {}),
            ...(request.status !== undefined ? { status: request.status } : {}),
            updated_at: new Date(),
          })
          .where('id', '=', budgetId)
          .returningAll()
          .executeTakeFirst(),
      );
      if (!updated) throw new AppError('BUDGET_NOT_FOUND');

      await this.audit.record(
        {
          event: AUDIT_EVENTS.BUDGET_UPDATED,
          entityType: ENTITY_TYPES.BUDGET,
          entityId: budgetId,
          actorId: user.id,
          walletId,
          ip,
        },
        trx,
      );
      return updated;
    });

    const [response] = await this.toResponses([row]);
    return response!;
  }

  /** Archives, which also releases its slot in the overlap exclusion constraint (§12.5). */
  async archive(user: AuthenticatedUser, budgetId: string, ip: string | null): Promise<void> {
    const { walletId, row } = await this.requireBudgetAccess(user.id, budgetId, 'EDITOR');
    if (row.status === BudgetStatus.ARCHIVED) return;

    await this.database.db.transaction().execute(async (trx) => {
      // Conditional, so of two concurrent archives only the one that changed the row is audited.
      const archived = await trx
        .updateTable('budgets')
        .set({ status: BudgetStatus.ARCHIVED, updated_at: new Date() })
        .where('id', '=', budgetId)
        .where('status', '!=', BudgetStatus.ARCHIVED)
        .returning('id')
        .executeTakeFirst();
      if (!archived) return;

      await this.audit.record(
        {
          event: AUDIT_EVENTS.BUDGET_ARCHIVED,
          entityType: ENTITY_TYPES.BUDGET,
          entityId: budgetId,
          actorId: user.id,
          walletId,
          ip,
        },
        trx,
      );
    });
  }

  /**
   * Resolves the budget and the caller's role on its wallet in one query, so a
   * budget that does not exist and one the caller cannot see produce the
   * identical 404 — mirroring WalletAccessService.requireAccount, since a
   * budget is keyed by its own id rather than by the wallet id on the request.
   */
  private async requireBudgetAccess(
    userId: string,
    budgetId: string,
    required: WalletRole,
  ): Promise<{ row: BudgetRow; walletId: string; role: WalletRole }> {
    const found = await this.database.db
      .selectFrom('budgets')
      .leftJoin('wallet_members', (join) =>
        join
          .onRef('wallet_members.wallet_id', '=', 'budgets.wallet_id')
          .on('wallet_members.user_id', '=', userId)
          .on('wallet_members.status', '=', MemberStatus.ACTIVE),
      )
      .select([
        'budgets.id as id',
        'budgets.wallet_id as wallet_id',
        'budgets.category_id as category_id',
        'budgets.goal_id as goal_id',
        'budgets.name as name',
        'budgets.amount as amount',
        'budgets.currency as currency',
        'budgets.period_type as period_type',
        'budgets.start_date as start_date',
        'budgets.end_date as end_date',
        'budgets.status as status',
        'budgets.created_at as created_at',
        'budgets.updated_at as updated_at',
        'wallet_members.role as member_role',
      ])
      .where('budgets.id', '=', budgetId)
      .executeTakeFirst();

    if (!found || found.member_role === null) throw new AppError('BUDGET_NOT_FOUND');
    if (!roleSatisfies(found.member_role, required)) throw AppError.forbidden(found.member_role, found.wallet_id);

    const { member_role, ...row } = found;
    return { row, walletId: row.wallet_id, role: member_role };
  }

  private async assertBudgetableCategory(userId: string, walletId: string, categoryId: string): Promise<void> {
    const category = await this.database.db
      .selectFrom('categories')
      .select(['id', 'wallet_id', 'type'])
      .where('id', '=', categoryId)
      .executeTakeFirst();

    // AC-01: another wallet's category reads as missing unless the caller can see that wallet.
    if (!category) throw new AppError('CATEGORY_NOT_FOUND');
    if (category.wallet_id !== walletId) {
      if ((await this.access.roleOn(userId, category.wallet_id)) === null) throw new AppError('CATEGORY_NOT_FOUND');
      throw new AppError('CATEGORY_WRONG_WALLET');
    }
    if (category.type !== CategoryType.EXPENSE) throw new AppError('CATEGORY_WRONG_TYPE');
  }

  /** Batched per category, so a wallet's budgets sharing one category cost a single query. */
  private async toResponses(rows: readonly BudgetRow[]): Promise<BudgetResponse[]> {
    if (rows.length === 0) return [];

    const categoryIds = [...new Set(rows.map((row) => row.category_id).filter((id): id is string => id !== null))];
    const [categories, spendable] = await Promise.all([
      this.categoriesByIds(categoryIds),
      spendableExpenses(this.database.db, rows),
    ]);

    return rows.map((row) => {
      const category = row.category_id !== null ? categories.get(row.category_id) : undefined;
      const amount = parseMoney(row.amount);
      const spent = calculateBudgetSpent(
        { walletId: row.wallet_id, categoryId: row.category_id, goalId: row.goal_id, currency: row.currency, startDate: row.start_date, endDate: row.end_date },
        spendable,
      );
      const remaining = calculateBudgetRemaining(amount, spent);

      return {
        id: row.id,
        walletId: row.wallet_id,
        categoryId: row.category_id,
        goalId: row.goal_id,
        name: row.name,
        amount: row.amount,
        currency: row.currency,
        periodType: row.period_type,
        startDate: row.start_date,
        endDate: row.end_date,
        status: row.status,
        category: category ?? (row.category_id !== null ? { id: row.category_id, name: '', icon: null, color: null } : null),
        spent: formatMoney(spent),
        remaining: formatMoney(remaining),
        usagePercentage: calculateBudgetUsage(amount, spent),
        isOverBudget: isOverBudget(amount, spent),
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
      };
    });
  }

  private async categoriesByIds(categoryIds: readonly string[]): Promise<Map<string, CategoryRef>> {
    // Wallet-wide and goal budgets name no category, and Postgres rejects an empty IN ().
    if (categoryIds.length === 0) return new Map();
    const rows = await this.database.db
      .selectFrom('categories')
      .select(['id', 'name', 'icon', 'color'])
      .where('id', 'in', categoryIds)
      .execute();
    return new Map(rows.map((row) => [row.id, row]));
  }
}

/**
 * Re-reads a budget's category or goal under a share lock: a category archive (which locks the
 * wallet's categories FOR UPDATE) or a goal cancel (an UPDATE) committed after the pre-checks would
 * otherwise leave an active budget on a target that can no longer carry one.
 */
async function lockBudgetTarget(trx: Transaction<DB>, categoryId: string | null, goalId: string | null): Promise<void> {
  if (categoryId !== null) {
    const category = await trx.selectFrom('categories').select('status').where('id', '=', categoryId).forShare().executeTakeFirst();
    if (category?.status === CategoryStatus.ARCHIVED) throw new AppError('CATEGORY_ARCHIVED');
  }
  if (goalId !== null) {
    const goal = await trx.selectFrom('goals').select('status').where('id', '=', goalId).forShare().executeTakeFirst();
    if (goal?.status !== GoalStatus.ACTIVE) throw new AppError('GOAL_NOT_ACTIVE');
  }
}
