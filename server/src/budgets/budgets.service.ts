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

import {
  calculateBudgetRemaining,
  calculateBudgetSpent,
  calculateBudgetUsage,
  formatMoney,
  isOverBudget,
  parseMoney,
  roleSatisfies,
  BudgetStatus,
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
import { translatingPgErrors } from '../common/pg-error.ts';
import { DatabaseService } from '../database/database.service.ts';
import { requireGoalInWallet } from '../goals/goal-access.ts';
import { WalletAccessService } from '../wallets/wallet-access.service.ts';
import { spendableExpenses } from './budget-spend.ts';

export interface BudgetListQuery {
  walletId: string;
  status?: BudgetStatus;
  activeOn?: string;
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

  async list(user: AuthenticatedUser, query: BudgetListQuery): Promise<BudgetResponse[]> {
    await this.access.require(user.id, query.walletId, 'VIEWER');

    let builder = this.database.db
      .selectFrom('budgets')
      .selectAll()
      .where('wallet_id', '=', query.walletId);
    if (query.status) builder = builder.where('status', '=', query.status);
    if (query.activeOn) {
      builder = builder
        .where('start_date', '<=', query.activeOn)
        .where('end_date', '>=', query.activeOn);
    }

    const rows = await builder.orderBy('start_date', 'desc').execute();
    return this.toResponses(rows);
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

    const row = await translatingPgErrors(() =>
      this.database.db
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

    await this.audit.record({
      event: AUDIT_EVENTS.BUDGET_CREATED,
      entityType: ENTITY_TYPES.BUDGET,
      entityId: row.id,
      actorId: user.id,
      walletId: request.walletId,
      ip,
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
    const { walletId } = await this.requireBudgetAccess(user.id, budgetId, 'EDITOR');

    const row = await translatingPgErrors(() =>
      this.database.db
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
    if (!row) throw new AppError('BUDGET_NOT_FOUND');

    await this.audit.record({
      event: AUDIT_EVENTS.BUDGET_UPDATED,
      entityType: ENTITY_TYPES.BUDGET,
      entityId: budgetId,
      actorId: user.id,
      walletId,
      ip,
    });

    const [response] = await this.toResponses([row]);
    return response!;
  }

  /** Archives, which also releases its slot in the overlap exclusion constraint (§12.5). */
  async archive(user: AuthenticatedUser, budgetId: string, ip: string | null): Promise<void> {
    const { walletId, row } = await this.requireBudgetAccess(user.id, budgetId, 'EDITOR');
    if (row.status === BudgetStatus.ARCHIVED) return;

    await this.database.db
      .updateTable('budgets')
      .set({ status: BudgetStatus.ARCHIVED, updated_at: new Date() })
      .where('id', '=', budgetId)
      .execute();

    await this.audit.record({
      event: AUDIT_EVENTS.BUDGET_ARCHIVED,
      entityType: ENTITY_TYPES.BUDGET,
      entityId: budgetId,
      actorId: user.id,
      walletId,
      ip,
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
