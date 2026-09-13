/**
 * Goals CRUD (§13.1-13.5 of the API specification).
 *
 * `currentAmount`/`remaining`/`progressPercentage` are never stored — they are
 * recomputed from goal_contributions via @sora/contracts' calc.ts, the same
 * functions the mobile app uses for optimistic values.
 */

import { Injectable } from '@nestjs/common';

import {
  ZERO,
  calculateGoalCurrent,
  calculateGoalProgress,
  calculateGoalRemaining,
  formatMoney,
  parseMoney,
  GoalStatus,
  type CreateGoalRequest,
  type GoalResponse,
  type Scaled,
  type UpdateGoalRequest,
} from '@sora/contracts';

import { AUDIT_EVENTS, ENTITY_TYPES } from '../audit/audit-events.ts';
import { AuditService } from '../audit/audit.service.ts';
import { AppError } from '../common/app-error.ts';
import type { AuthenticatedUser } from '../common/decorators.ts';
import { DatabaseService } from '../database/database.service.ts';
import { WalletAccessService } from '../wallets/wallet-access.service.ts';
import { requireGoalAccess, type GoalRow } from './goal-access.ts';

export interface GoalListQuery {
  walletId: string;
  status?: GoalStatus;
}

@Injectable()
export class GoalsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly access: WalletAccessService,
    private readonly audit: AuditService,
  ) {}

  async list(user: AuthenticatedUser, query: GoalListQuery): Promise<GoalResponse[]> {
    await this.access.require(user.id, query.walletId, 'VIEWER');

    let builder = this.database.db
      .selectFrom('goals')
      .selectAll()
      .where('wallet_id', '=', query.walletId);
    if (query.status) builder = builder.where('status', '=', query.status);

    const rows = await builder.orderBy('created_at', 'desc').execute();
    return this.toResponses(rows);
  }

  async create(
    user: AuthenticatedUser,
    request: CreateGoalRequest,
    ip: string | null,
  ): Promise<GoalResponse> {
    await this.access.requireWritable(user.id, request.walletId, 'EDITOR');

    const row = await this.database.db
      .insertInto('goals')
      .values({
        wallet_id: request.walletId,
        name: request.name,
        description: request.description ?? null,
        target_amount: request.targetAmount,
        currency: request.currency,
        target_date: request.targetDate ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await this.audit.record({
      event: AUDIT_EVENTS.GOAL_CREATED,
      entityType: ENTITY_TYPES.GOAL,
      entityId: row.id,
      actorId: user.id,
      walletId: request.walletId,
      ip,
    });

    const [response] = await this.toResponses([row]);
    return response!;
  }

  async detail(user: AuthenticatedUser, goalId: string): Promise<GoalResponse> {
    const { goal } = await requireGoalAccess(this.database.db, user.id, goalId, 'VIEWER');
    const [response] = await this.toResponses([goal]);
    return response!;
  }

  /** `currency` is immutable (§13.4) — contributions are already recorded in it. */
  async update(
    user: AuthenticatedUser,
    goalId: string,
    request: UpdateGoalRequest,
    ip: string | null,
  ): Promise<GoalResponse> {
    const { goal } = await requireGoalAccess(this.database.db, user.id, goalId, 'EDITOR');

    const row = await this.database.db
      .updateTable('goals')
      .set({
        ...(request.name !== undefined ? { name: request.name } : {}),
        ...(request.description !== undefined ? { description: request.description } : {}),
        ...(request.targetAmount !== undefined ? { target_amount: request.targetAmount } : {}),
        ...(request.targetDate !== undefined ? { target_date: request.targetDate } : {}),
        ...(request.status !== undefined ? { status: request.status } : {}),
        updated_at: new Date(),
      })
      .where('id', '=', goalId)
      .returningAll()
      .executeTakeFirst();
    if (!row) throw new AppError('GOAL_NOT_FOUND');

    await this.audit.record({
      event: AUDIT_EVENTS.GOAL_UPDATED,
      entityType: ENTITY_TYPES.GOAL,
      entityId: goalId,
      actorId: user.id,
      walletId: goal.wallet_id,
      ip,
    });

    const [response] = await this.toResponses([row]);
    return response!;
  }

  /** Sets status = CANCELLED. Contributions are retained (§13.5) — they record money that really was set aside. */
  async archive(user: AuthenticatedUser, goalId: string, ip: string | null): Promise<void> {
    const { goal } = await requireGoalAccess(this.database.db, user.id, goalId, 'EDITOR');
    if (goal.status === GoalStatus.CANCELLED) return;

    await this.database.db
      .updateTable('goals')
      .set({ status: GoalStatus.CANCELLED, updated_at: new Date() })
      .where('id', '=', goalId)
      .execute();

    await this.audit.record({
      event: AUDIT_EVENTS.GOAL_CANCELLED,
      entityType: ENTITY_TYPES.GOAL,
      entityId: goalId,
      actorId: user.id,
      walletId: goal.wallet_id,
      ip,
    });
  }

  private async toResponses(rows: readonly GoalRow[]): Promise<GoalResponse[]> {
    if (rows.length === 0) return [];

    const totals = await this.contributionTotals(rows.map((row) => row.id));

    return rows.map((row) => {
      const targetAmount = parseMoney(row.target_amount);
      const totalsForGoal = totals.get(row.id) ?? { current: ZERO, count: 0 };
      const remaining = calculateGoalRemaining(targetAmount, totalsForGoal.current);

      return {
        id: row.id,
        walletId: row.wallet_id,
        name: row.name,
        description: row.description,
        targetAmount: row.target_amount,
        currency: row.currency,
        targetDate: row.target_date,
        status: row.status,
        currentAmount: formatMoney(totalsForGoal.current),
        remaining: formatMoney(remaining),
        progressPercentage: calculateGoalProgress(targetAmount, totalsForGoal.current),
        contributionCount: totalsForGoal.count,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
      };
    });
  }

  /** Contributions summed per goal, never a stored running total (calc.ts#calculateGoalCurrent). */
  private async contributionTotals(
    goalIds: readonly string[],
  ): Promise<Map<string, { current: Scaled; count: number }>> {
    const result = new Map<string, { current: Scaled; count: number }>();
    if (goalIds.length === 0) return result;

    const rows = await this.database.db
      .selectFrom('goal_contributions')
      .select(['goal_id', 'amount'])
      .where('goal_id', 'in', goalIds)
      .execute();

    const byGoal = new Map<string, Scaled[]>();
    for (const row of rows) {
      const amounts = byGoal.get(row.goal_id) ?? [];
      amounts.push(parseMoney(row.amount));
      byGoal.set(row.goal_id, amounts);
    }

    for (const goalId of goalIds) {
      const amounts = byGoal.get(goalId) ?? [];
      result.set(goalId, { current: calculateGoalCurrent(amounts), count: amounts.length });
    }

    return result;
  }
}
