/**
 * Accounts CRUD (§9 of the API specification).
 *
 * Balances are never read from a stored column — BalanceService derives every
 * figure from transaction rows, so a response here can never disagree with
 * @sora/contracts' own calc.ts, which the app uses for its optimistic values.
 */

import { Injectable } from '@nestjs/common';
import type { Transaction } from 'kysely';

import {
  formatMoney,
  AccountStatus,
  type AccountDetailResponse,
  type AccountResponse,
  type AccountType,
  type CreateAccountRequest,
  type UpdateAccountRequest,
} from '@sora/contracts';

import { AUDIT_EVENTS, ENTITY_TYPES } from '../audit/audit-events.ts';
import { AuditService } from '../audit/audit.service.ts';
import { AppError } from '../common/app-error.ts';
import type { AuthenticatedUser } from '../common/decorators.ts';
import { DatabaseService } from '../database/database.service.ts';
import type { DB } from '../database/types.ts';
import { WalletAccessService } from '../wallets/wallet-access.service.ts';
import { lockAccountForCurrencyChange } from './account-currency-lock.ts';
import { BalanceService } from './balance.service.ts';

export interface AccountListQuery {
  walletId?: string;
  status?: AccountStatus;
  type?: AccountType;
}

interface AccountRow {
  id: string;
  wallet_id: string;
  name: string;
  type: string;
  currency: string;
  initial_balance: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class AccountsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly access: WalletAccessService,
    private readonly balances: BalanceService,
    private readonly audit: AuditService,
  ) {}

  async list(user: AuthenticatedUser, query: AccountListQuery): Promise<AccountResponse[]> {
    const walletIds = query.walletId
      ? [(await this.access.require(user.id, query.walletId, 'VIEWER')).walletId]
      : await this.access.accessibleWalletIds(user.id);

    if (walletIds.length === 0) return [];

    let builder = this.database.db
      .selectFrom('accounts')
      .selectAll()
      .where('wallet_id', 'in', walletIds);
    if (query.status) builder = builder.where('status', '=', query.status);
    if (query.type) builder = builder.where('type', '=', query.type);

    const rows = await builder.orderBy('created_at', 'asc').execute();
    const balances = await this.balances.balancesForWallets(walletIds);

    return rows.map((row) => toAccountResponse(row, balances.get(row.id)?.balance));
  }

  async create(
    user: AuthenticatedUser,
    request: CreateAccountRequest,
    ip: string | null,
  ): Promise<AccountResponse> {
    await this.access.requireWritable(user.id, request.walletId, 'EDITOR');

    const row = await this.database.db
      .insertInto('accounts')
      .values({
        wallet_id: request.walletId,
        name: request.name,
        type: request.type,
        currency: request.currency,
        initial_balance: request.initialBalance,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await this.audit.record({
      event: AUDIT_EVENTS.ACCOUNT_CREATED,
      entityType: ENTITY_TYPES.ACCOUNT,
      entityId: row.id,
      actorId: user.id,
      walletId: request.walletId,
      ip,
    });

    // A brand-new account has no transactions, so its balance is its opening one.
    return toAccountResponse(row);
  }

  async detail(user: AuthenticatedUser, accountId: string): Promise<AccountDetailResponse> {
    await this.access.requireAccount(user.id, accountId, 'VIEWER');
    const row = await this.accountRow(accountId);

    const [balance, activity] = await Promise.all([
      this.balances.balanceForAccount(row),
      this.balances.activityForAccount(accountId),
    ]);

    return {
      ...toAccountResponse(row, balance.balance),
      totalIncome: activity.totalIncome,
      totalExpense: activity.totalExpense,
      transferredIn: activity.transferredIn,
      transferredOut: activity.transferredOut,
      transactionCount: activity.transactionCount,
    };
  }

  async update(
    user: AuthenticatedUser,
    accountId: string,
    request: UpdateAccountRequest,
    ip: string | null,
  ): Promise<AccountResponse> {
    const access = await this.access.requireAccount(user.id, accountId, 'EDITOR');

    if (request.status === AccountStatus.ARCHIVED && access.accountStatus === AccountStatus.ACTIVE) {
      await this.assertNotLastActiveAccount(access.walletId, accountId);
    }

    const row = await this.database.db.transaction().execute(async (trx) => {
      if (request.currency !== undefined && request.currency !== access.currency) {
        await lockAccountForCurrencyChange(trx, accountId);
        await this.assertNothingNamesAccount(trx, accountId);
      }

      const updated = await trx
        .updateTable('accounts')
        .set({
          ...(request.name !== undefined ? { name: request.name } : {}),
          ...(request.currency !== undefined ? { currency: request.currency } : {}),
          ...(request.status !== undefined ? { status: request.status } : {}),
          updated_at: new Date(),
        })
        .where('id', '=', accountId)
        .returningAll()
        .executeTakeFirst();

      if (!updated) throw new AppError('ACCOUNT_NOT_FOUND');

      await this.audit.record(
        {
          event:
            request.status === AccountStatus.ARCHIVED ? AUDIT_EVENTS.ACCOUNT_ARCHIVED : AUDIT_EVENTS.ACCOUNT_UPDATED,
          entityType: ENTITY_TYPES.ACCOUNT,
          entityId: accountId,
          actorId: user.id,
          walletId: access.walletId,
          ip,
        },
        trx,
      );
      return updated;
    });

    const balance = await this.balances.balanceForAccount(row);
    return toAccountResponse(row, balance.balance);
  }

  /** DELETE /accounts/{id} — archives; hard delete is not exposed (§9.5). */
  async archive(user: AuthenticatedUser, accountId: string, ip: string | null): Promise<void> {
    const access = await this.access.requireAccount(user.id, accountId, 'EDITOR');
    if (access.accountStatus === AccountStatus.ARCHIVED) return;

    await this.assertNotLastActiveAccount(access.walletId, accountId);

    await this.database.db
      .updateTable('accounts')
      .set({ status: AccountStatus.ARCHIVED, updated_at: new Date() })
      .where('id', '=', accountId)
      .execute();

    await this.audit.record({
      event: AUDIT_EVENTS.ACCOUNT_ARCHIVED,
      entityType: ENTITY_TYPES.ACCOUNT,
      entityId: accountId,
      actorId: user.id,
      walletId: access.walletId,
      ip,
    });
  }

  /**
   * A wallet must always keep at least one active account — the same reasoning
   * as `uq_wallet_single_owner`, expressed here rather than as a CHECK because
   * "how many *other* rows are ACTIVE" is not something a single-row
   * constraint can see.
   */
  private async assertNotLastActiveAccount(
    walletId: string,
    excludingAccountId: string,
  ): Promise<void> {
    const remaining = await this.database.db
      .selectFrom('accounts')
      .select((eb) => eb.fn.countAll<string>().as('count'))
      .where('wallet_id', '=', walletId)
      .where('status', '=', AccountStatus.ACTIVE)
      .where('id', '!=', excludingAccountId)
      .executeTakeFirstOrThrow();

    if (Number(remaining.count) === 0) throw new AppError('ACCOUNT_LAST_ACTIVE');
  }

  /** Run under the account's `FOR UPDATE`, so no writer can name it between this check and the update. */
  private async assertNothingNamesAccount(trx: Transaction<DB>, accountId: string): Promise<void> {
    const transaction = await trx
      .selectFrom('transactions')
      .select('id')
      .where((eb) => eb.or([eb('from_account_id', '=', accountId), eb('to_account_id', '=', accountId)]))
      .executeTakeFirst();

    // An earmark contribution carries the account's currency without a transaction behind it.
    const earmark = await trx
      .selectFrom('goal_contributions')
      .select('id')
      .where('account_id', '=', accountId)
      .executeTakeFirst();

    if (transaction || earmark) {
      throw new AppError(
        'ACCOUNT_CURRENCY_MISMATCH',
        'Cannot change currency once a transaction or goal contribution names this account',
      );
    }
  }

  private async accountRow(accountId: string): Promise<AccountRow> {
    const row = await this.database.db
      .selectFrom('accounts')
      .selectAll()
      .where('id', '=', accountId)
      .executeTakeFirst();
    if (!row) throw new AppError('ACCOUNT_NOT_FOUND');
    return row;
  }
}

function toAccountResponse(row: AccountRow, balance?: bigint): AccountResponse {
  return {
    id: row.id,
    walletId: row.wallet_id,
    name: row.name,
    type: row.type as AccountType,
    currency: row.currency,
    initialBalance: row.initial_balance,
    balance: balance !== undefined ? formatMoney(balance) : row.initial_balance,
    status: row.status as AccountStatus,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
