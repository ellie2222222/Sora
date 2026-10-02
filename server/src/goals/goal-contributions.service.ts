/**
 * Goal contributions (§13.6-13.8 of the API specification).
 *
 * A contribution recorded with `recordAsTransaction: true` creates its backing
 * EXPENSE transaction and the contribution row in one DB transaction, so the
 * money leaving the account and the goal advancing can never disagree.
 * `transaction_id` is UNIQUE on goal_contributions, which is what stops one
 * payment being counted toward a goal twice. Left `false`, the contribution is
 * an earmark: the goal advances without asserting money moved.
 */

import { Injectable } from '@nestjs/common';

import {
  AccountStatus,
  CategoryType,
  GoalStatus,
  TransactionStatus,
  TransactionType,
  WalletStatus,
  type ContributionResponse,
  type CreateContributionRequest,
} from '@sora/contracts';

import { lockAccountsInCurrency } from '../accounts/account-currency-lock.ts';
import { AUDIT_EVENTS, ENTITY_TYPES } from '../audit/audit-events.ts';
import { AuditService } from '../audit/audit.service.ts';
import { AppError } from '../common/app-error.ts';
import type { AuthenticatedUser } from '../common/decorators.ts';
import { Enveloped, paginated } from '../common/envelope.ts';
import { DatabaseService } from '../database/database.service.ts';
import { WalletAccessService } from '../wallets/wallet-access.service.ts';
import { requireGoalAccess } from './goal-access.ts';

export interface ContributionListQuery {
  page: number;
  pageSize: number;
}

interface ContributionRow {
  id: string;
  goal_id: string;
  account_id: string;
  transaction_id: string | null;
  amount: string;
  currency: string;
  contribution_date: Date;
  note: string | null;
  created_at: Date;
}

@Injectable()
export class GoalContributionsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly access: WalletAccessService,
    private readonly audit: AuditService,
  ) {}

  async list(
    user: AuthenticatedUser,
    goalId: string,
    query: ContributionListQuery,
  ): Promise<Enveloped<ContributionResponse[]>> {
    await requireGoalAccess(this.database.db, user.id, goalId, 'VIEWER');

    const offset = (query.page - 1) * query.pageSize;
    const [rows, totalRow] = await Promise.all([
      this.database.db
        .selectFrom('goal_contributions')
        .selectAll()
        .where('goal_id', '=', goalId)
        .orderBy('contribution_date', 'desc')
        // A date tie would otherwise let offset paging repeat or skip a row between pages.
        .orderBy('id', 'desc')
        .limit(query.pageSize)
        .offset(offset)
        .execute(),
      this.database.db
        .selectFrom('goal_contributions')
        .select((eb) => eb.fn.countAll<string>().as('count'))
        .where('goal_id', '=', goalId)
        .executeTakeFirstOrThrow(),
    ]);

    const total = Number(totalRow.count);
    const responses = await this.toResponses(rows);

    return paginated(responses, {
      page: query.page,
      pageSize: query.pageSize,
      total,
      hasMore: offset + rows.length < total,
    });
  }

  async create(
    user: AuthenticatedUser,
    goalId: string,
    request: CreateContributionRequest,
    ip: string | null,
  ): Promise<ContributionResponse> {
    const { goal, role } = await requireGoalAccess(this.database.db, user.id, goalId, 'EDITOR');
    if (goal.status !== GoalStatus.ACTIVE) throw new AppError('GOAL_NOT_ACTIVE');

    const account = await this.access.requireAccount(user.id, request.accountId, 'VIEWER');
    if (account.walletId !== goal.wallet_id) throw AppError.forbidden(role, goal.wallet_id);
    if (request.currency !== goal.currency || request.currency !== account.currency) {
      throw new AppError('ACCOUNT_CURRENCY_MISMATCH');
    }

    if (request.recordAsTransaction) {
      // The backing EXPENSE is a transaction like any other, so it meets §11.2's account rules too.
      if (account.status === WalletStatus.ARCHIVED) throw new AppError('WALLET_ARCHIVED');
      if (account.accountStatus === AccountStatus.ARCHIVED) throw new AppError('ACCOUNT_ARCHIVED');
      if (!request.categoryId) {
        throw new AppError('VALIDATION_FAILED', undefined, {
          categoryId: ['Required when recording as a transaction'],
        });
      }
      await this.assertExpenseCategory(goal.wallet_id, request.categoryId);
    }

    const row = await this.database.db.transaction().execute(async (trx) => {
      await lockAccountsInCurrency(trx, [request.accountId], request.currency);
      let transactionId: string | null = null;

      if (request.recordAsTransaction) {
        const transactionRow = await trx
          .insertInto('transactions')
          .values({
            created_by_user_id: user.id,
            from_account_id: request.accountId,
            to_account_id: null,
            category_id: request.categoryId!,
            // Tagged so this goal's budget counts the money that left for it (§12.2).
            goal_id: goalId,
            type: TransactionType.EXPENSE,
            amount: request.amount,
            currency: request.currency,
            description: `Contribution to ${goal.name}`,
            transaction_date: request.contributionDate,
            status: TransactionStatus.COMPLETED,
          })
          .returning(['id'])
          .executeTakeFirstOrThrow();
        transactionId = transactionRow.id;
      }

      const contributionRow = await trx
        .insertInto('goal_contributions')
        .values({
          goal_id: goalId,
          account_id: request.accountId,
          transaction_id: transactionId,
          amount: request.amount,
          currency: request.currency,
          contribution_date: request.contributionDate,
          note: request.note ?? null,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      await this.audit.record(
        {
          event: AUDIT_EVENTS.GOAL_CONTRIBUTION_ADDED,
          entityType: ENTITY_TYPES.GOAL_CONTRIBUTION,
          entityId: contributionRow.id,
          actorId: user.id,
          walletId: goal.wallet_id,
          ip,
        },
        trx,
      );

      return contributionRow;
    });

    const [response] = await this.toResponses([row], account.accountName);
    return response!;
  }

  /** Removes the contribution row outright; a transaction-backed one only flips its backing
   * transaction's status to deleted — the transaction row itself is never removed (§13.8). */
  async remove(
    user: AuthenticatedUser,
    goalId: string,
    contributionId: string,
    ip: string | null,
  ): Promise<void> {
    const { goal } = await requireGoalAccess(this.database.db, user.id, goalId, 'EDITOR');

    const contribution = await this.database.db
      .selectFrom('goal_contributions')
      .selectAll()
      .where('id', '=', contributionId)
      .where('goal_id', '=', goalId)
      .executeTakeFirst();
    if (!contribution) throw new AppError('CONTRIBUTION_NOT_FOUND');

    await this.database.db.transaction().execute(async (trx) => {
      await trx.deleteFrom('goal_contributions').where('id', '=', contributionId).execute();

      if (contribution.transaction_id) {
        await trx
          .updateTable('transactions')
          .set({ status: TransactionStatus.DELETED, updated_at: new Date() })
          .where('id', '=', contribution.transaction_id)
          .execute();
      }

      await this.audit.record(
        {
          event: AUDIT_EVENTS.GOAL_CONTRIBUTION_REMOVED,
          entityType: ENTITY_TYPES.GOAL_CONTRIBUTION,
          entityId: contributionId,
          actorId: user.id,
          walletId: goal.wallet_id,
          ip,
        },
        trx,
      );
    });
  }

  private async toResponses(
    rows: readonly ContributionRow[],
    knownAccountName?: string,
  ): Promise<ContributionResponse[]> {
    if (rows.length === 0) return [];

    const accountIds = [...new Set(rows.map((row) => row.account_id))];
    const names =
      knownAccountName !== undefined && accountIds.length === 1
        ? new Map([[accountIds[0]!, knownAccountName]])
        : await this.accountNames(accountIds);

    return rows.map((row) => ({
      id: row.id,
      goalId: row.goal_id,
      accountId: row.account_id,
      accountName: names.get(row.account_id) ?? '',
      transactionId: row.transaction_id,
      amount: row.amount,
      currency: row.currency,
      contributionDate: row.contribution_date.toISOString(),
      note: row.note,
      createdAt: row.created_at.toISOString(),
    }));
  }

  private async accountNames(accountIds: readonly string[]): Promise<Map<string, string>> {
    const rows = await this.database.db
      .selectFrom('accounts')
      .select(['id', 'name'])
      .where('id', 'in', accountIds)
      .execute();
    return new Map(rows.map((row) => [row.id, row.name]));
  }

  private async assertExpenseCategory(walletId: string, categoryId: string): Promise<void> {
    const category = await this.database.db
      .selectFrom('categories')
      .select(['id', 'wallet_id', 'type'])
      .where('id', '=', categoryId)
      .executeTakeFirst();

    if (!category || category.wallet_id !== walletId || category.type !== CategoryType.EXPENSE) {
      throw new AppError('VALIDATION_FAILED', undefined, {
        categoryId: ['Must be an EXPENSE category belonging to this wallet'],
      });
    }
  }
}
