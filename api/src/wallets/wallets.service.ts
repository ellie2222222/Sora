import { Injectable } from '@nestjs/common';

import type {
  CreateWalletRequest,
  UpdateWalletRequest,
  WalletResponse,
  WalletRole,
  WalletStatus,
} from '@finance/contracts';

import { AUDIT_EVENTS, ENTITY_TYPES } from '../audit/audit-events.ts';
import { AuditService } from '../audit/audit.service.ts';
import { BalanceService } from '../accounts/balance.service.ts';
import { AppError } from '../common/app-error.ts';
import type { AuthenticatedUser } from '../common/decorators.ts';
import { DatabaseService } from '../database/database.service.ts';
import { WalletAccessService } from './wallet-access.service.ts';

export interface WalletListFilter {
  status: WalletStatus;
  includeOwn: boolean;
  includeShared: boolean;
}

interface WalletRowWithMembership {
  id: string;
  name: string;
  status: WalletStatus;
  owner_user_id: string;
  created_at: Date;
  updated_at: Date;
  role: WalletRole;
  relation_label: string | null;
}

@Injectable()
export class WalletsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly access: WalletAccessService,
    private readonly balances: BalanceService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Every wallet the caller can reach — their own and the ones shared with them.
   *
   * Authorization is implicit: the query starts from the caller's membership
   * rows, so there is no wallet in the result they are not a member of and no
   * separate check to forget.
   */
  async list(user: AuthenticatedUser, filter: WalletListFilter): Promise<WalletResponse[]> {
    const rows = await this.database.db
      .selectFrom('wallet_members')
      .innerJoin('wallets', 'wallets.id', 'wallet_members.wallet_id')
      .select([
        'wallets.id as id',
        'wallets.name as name',
        'wallets.status as status',
        'wallets.owner_user_id as owner_user_id',
        'wallets.created_at as created_at',
        'wallets.updated_at as updated_at',
        'wallet_members.role as role',
        'wallet_members.relation_label as relation_label',
      ])
      .where('wallet_members.user_id', '=', user.id)
      .where('wallet_members.status', '=', 'ACTIVE')
      .where('wallets.status', '=', filter.status)
      .orderBy('wallets.created_at', 'asc')
      .execute();

    const visible = rows.filter((row) => {
      const isOwn = row.owner_user_id === user.id;
      return isOwn ? filter.includeOwn : filter.includeShared;
    });

    return this.decorate(user, visible);
  }

  async get(user: AuthenticatedUser, walletId: string): Promise<WalletResponse> {
    const access = await this.access.require(user.id, walletId, 'VIEWER');
    const row = await this.row(access.walletId);
    const [response] = await this.decorate(user, [
      { ...row, role: access.role, relation_label: access.relationLabel },
    ]);

    if (!response) throw new AppError('WALLET_NOT_FOUND');
    return response;
  }

  /**
   * The wallet and the caller's OWNER membership commit together.
   *
   * A wallet with no owner cannot be administered through any API path — no
   * member list, no invitations, no archive — so it would be unrecoverable
   * (§6.2).
   */
  async create(
    user: AuthenticatedUser,
    request: CreateWalletRequest,
    ip: string | null,
  ): Promise<WalletResponse> {
    const wallet = await this.database.db.transaction().execute(async (trx) => {
      const created = await trx
        .insertInto('wallets')
        .values({ owner_user_id: user.id, name: request.name })
        .returning(['id', 'name', 'status', 'owner_user_id', 'created_at', 'updated_at'])
        .executeTakeFirstOrThrow();

      await trx
        .insertInto('wallet_members')
        .values({ wallet_id: created.id, user_id: user.id, role: 'OWNER' })
        .execute();

      await this.audit.record(
        {
          event: AUDIT_EVENTS.WALLET_CREATED,
          entityType: ENTITY_TYPES.WALLET,
          entityId: created.id,
          actorId: user.id,
          walletId: created.id,
          actorRole: 'OWNER',
          ip,
        },
        trx,
      );

      return created;
    });

    const [response] = await this.decorate(user, [
      { ...wallet, role: 'OWNER' as const, relation_label: null },
    ]);
    if (!response) throw new AppError('WALLET_NOT_FOUND');
    return response;
  }

  async update(
    user: AuthenticatedUser,
    walletId: string,
    request: UpdateWalletRequest,
    ip: string | null,
  ): Promise<WalletResponse> {
    // Deliberately not requireWritable: un-archiving is an update, so an
    // archived wallet has to accept this one.
    const access = await this.access.require(user.id, walletId, 'OWNER');

    const updated = await this.database.db
      .updateTable('wallets')
      .set({
        ...(request.name !== undefined ? { name: request.name } : {}),
        ...(request.status !== undefined ? { status: request.status } : {}),
        updated_at: new Date(),
      })
      .where('id', '=', access.walletId)
      .returning(['id', 'name', 'status', 'owner_user_id', 'created_at', 'updated_at'])
      .executeTakeFirstOrThrow();

    await this.audit.record({
      event: AUDIT_EVENTS.WALLET_UPDATED,
      entityType: ENTITY_TYPES.WALLET,
      entityId: access.walletId,
      actorId: user.id,
      walletId: access.walletId,
      actorRole: access.role,
      note: `Changed: ${Object.keys(request).join(', ')}`,
      ip,
    });

    const [response] = await this.decorate(user, [
      { ...updated, role: access.role, relation_label: access.relationLabel },
    ]);
    if (!response) throw new AppError('WALLET_NOT_FOUND');
    return response;
  }

  /**
   * Archives; never deletes.
   *
   * Hard deletion is not exposed anywhere: transactions are the ledger, and
   * destroying one wallet's rows would silently rewrite the other side of every
   * cross-wallet transfer it took part in (§6.5).
   */
  async archive(user: AuthenticatedUser, walletId: string, ip: string | null): Promise<void> {
    const access = await this.access.require(user.id, walletId, 'OWNER');

    await this.database.db
      .updateTable('wallets')
      .set({ status: 'ARCHIVED', updated_at: new Date() })
      .where('id', '=', access.walletId)
      .execute();

    await this.audit.record({
      event: AUDIT_EVENTS.WALLET_ARCHIVED,
      entityType: ENTITY_TYPES.WALLET,
      entityId: access.walletId,
      actorId: user.id,
      walletId: access.walletId,
      actorRole: access.role,
      ip,
    });
  }

  private async row(walletId: string) {
    const found = await this.database.db
      .selectFrom('wallets')
      .select(['id', 'name', 'status', 'owner_user_id', 'created_at', 'updated_at'])
      .where('id', '=', walletId)
      .executeTakeFirst();

    if (!found) throw new AppError('WALLET_NOT_FOUND');
    return found;
  }

  /**
   * Attach the counts and the per-currency balances.
   *
   * Counts and balances are fetched once for the whole page rather than per
   * wallet, so listing N wallets stays a fixed number of queries.
   */
  private async decorate(
    user: AuthenticatedUser,
    rows: readonly WalletRowWithMembership[],
  ): Promise<WalletResponse[]> {
    if (rows.length === 0) return [];

    const walletIds = rows.map((row) => row.id);

    const [memberCounts, accountCounts, balances] = await Promise.all([
      this.countBy('wallet_members', walletIds),
      this.countBy('accounts', walletIds),
      this.balances.walletBalances(walletIds),
    ]);

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      ownerUserId: row.owner_user_id,
      role: row.role,
      relationLabel: row.relation_label,
      isOwn: row.owner_user_id === user.id,
      memberCount: memberCounts.get(row.id) ?? 0,
      accountCount: accountCounts.get(row.id) ?? 0,
      balances: balances.get(row.id) ?? [],
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    }));
  }

  private async countBy(
    table: 'wallet_members' | 'accounts',
    walletIds: readonly string[],
  ): Promise<Map<string, number>> {
    const rows = await this.database.db
      .selectFrom(table)
      .select(({ fn }) => ['wallet_id', fn.countAll<string>().as('total')])
      .where('wallet_id', 'in', [...walletIds])
      .where('status', '=', 'ACTIVE')
      .groupBy('wallet_id')
      .execute();

    return new Map(rows.map((row) => [row.wallet_id, Number(row.total)]));
  }
}
