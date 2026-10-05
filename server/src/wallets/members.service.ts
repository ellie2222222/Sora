import { Injectable } from '@nestjs/common';
import type { Transaction } from 'kysely';

import {
  WalletRole,
  MemberStatus,
  type UpdateMemberRequest,
  type WalletMemberResponse,
} from '@sora/contracts';

import { AUDIT_EVENTS, ENTITY_TYPES } from '../audit/audit-events.ts';
import { AuditService } from '../audit/audit.service.ts';
import { AppError } from '../common/app-error.ts';
import type { AuthenticatedUser } from '../common/decorators.ts';
import { paginated, type Enveloped } from '../common/envelope.ts';
import { offsetOf, paginationMeta, type PageQuery } from '../common/pagination.ts';
import { translatingPgErrors } from '../common/pg-error.ts';
import { DatabaseService } from '../database/database.service.ts';
import type { DB, Executor } from '../database/types.ts';
import { WalletAccessService } from './wallet-access.service.ts';

interface MemberRow {
  id: string;
  wallet_id: string;
  user_id: string;
  role: WalletRole;
  relation_label: string | null;
  status: MemberStatus;
  joined_at: Date;
  display_name: string;
  email: string;
}

@Injectable()
export class MembersService {
  constructor(
    private readonly database: DatabaseService,
    private readonly access: WalletAccessService,
    private readonly audit: AuditService,
  ) {}

  /** VIEWER is enough: you can see who else can see your money (§7.1). */
  async list(
    user: AuthenticatedUser,
    walletId: string,
    query: { status: MemberStatus } & PageQuery,
  ): Promise<Enveloped<WalletMemberResponse[]>> {
    const access = await this.access.require(user.id, walletId, WalletRole.VIEWER);
    const [rows, totalRow] = await Promise.all([
      this.rows(access.walletId, query.status, query),
      this.database.db
        .selectFrom('wallet_members')
        .select((eb) => eb.fn.countAll<string>().as('count'))
        .where('wallet_id', '=', access.walletId)
        .where('status', '=', query.status)
        .executeTakeFirstOrThrow(),
    ]);
    return paginated(rows.map(toMemberResponse), paginationMeta(query.page, query.pageSize, Number(totalRow.count)));
  }

  /**
   * Change a member's role.
   *
   * Promotion to OWNER is refused here on purpose: ownership is a *transfer*,
   * where the outgoing owner is demoted in the same transaction, not an additive
   * grant — and `uq_wallet_single_owner` would reject the second active owner
   * anyway. §7.4 is the endpoint for it.
   */
  async updateRole(
    user: AuthenticatedUser,
    walletId: string,
    memberId: string,
    request: UpdateMemberRequest,
    ip: string | null,
  ): Promise<WalletMemberResponse> {
    const access = await this.access.require(user.id, walletId, WalletRole.OWNER);

    if (request.role === WalletRole.OWNER) {
      throw new AppError(
        'VALIDATION_FAILED',
        'Use POST /wallets/{id}/transfer-ownership to move ownership',
        { role: ['Ownership is transferred, not granted'] },
      );
    }

    const target = await this.database.db.transaction().execute(async (trx) => {
      await lockOwnerAuthority(trx, access.walletId, user.id);
      const target = await this.member(access.walletId, memberId, trx);
      if (target.status !== MemberStatus.ACTIVE) throw new AppError('MEMBER_NOT_FOUND');

      // A wallet has exactly one active owner, so demoting whoever holds the role
      // always leaves none — which is the unadministrable state §7.5 also guards.
      if (target.role === WalletRole.OWNER) throw new AppError('WALLET_LAST_OWNER');

      await trx
        .updateTable('wallet_members')
        .set({ role: request.role, updated_at: new Date() })
        .where('id', '=', target.id)
        .execute();

      await this.audit.record(
        {
          event: AUDIT_EVENTS.MEMBER_ROLE_CHANGED,
          entityType: ENTITY_TYPES.WALLET_MEMBER,
          entityId: target.id,
          actorId: user.id,
          walletId: access.walletId,
          actorRole: access.role,
          note: `${target.email}: ${target.role} -> ${request.role}`,
          ip,
        },
        trx,
      );
      return target;
    });

    return toMemberResponse({ ...target, role: request.role });
  }

  /**
   * Revokes rather than deletes.
   *
   * `transactions.created_by_user_id` still has to resolve to a name — a removed
   * member's past entries must not become anonymous (§7.3).
   */
  async remove(
    user: AuthenticatedUser,
    walletId: string,
    memberId: string,
    ip: string | null,
  ): Promise<void> {
    const access = await this.access.require(user.id, walletId, WalletRole.OWNER);

    await this.database.db.transaction().execute(async (trx) => {
      await lockOwnerAuthority(trx, access.walletId, user.id);
      const target = await this.member(access.walletId, memberId, trx);
      if (target.status !== MemberStatus.ACTIVE) throw new AppError('MEMBER_NOT_FOUND');
      if (target.role === WalletRole.OWNER) throw new AppError('WALLET_LAST_OWNER');

      await trx
        .updateTable('wallet_members')
        .set({ status: MemberStatus.REVOKED, updated_at: new Date() })
        .where('id', '=', target.id)
        .execute();

      await this.audit.record(
        {
          event: AUDIT_EVENTS.MEMBER_REMOVED,
          entityType: ENTITY_TYPES.WALLET_MEMBER,
          entityId: target.id,
          actorId: user.id,
          walletId: access.walletId,
          actorRole: access.role,
          note: `Removed ${target.email} (${target.role})`,
          ip,
        },
        trx,
      );
    });
  }

  /**
   * Ownership transfer, in one transaction.
   *
   * The demote lands **before** the promote: `uq_wallet_single_owner` is a real
   * partial unique index and rejects two active owners even momentarily, so the
   * opposite order fails on the second statement. `FOR UPDATE` on the wallet's
   * membership rows serialises concurrent transfers, turning what would be a
   * constraint violation into a clean queue (§16.2).
   */
  async transferOwnership(
    user: AuthenticatedUser,
    walletId: string,
    toUserId: string,
    ip: string | null,
  ): Promise<WalletMemberResponse[]> {
    const access = await this.access.require(user.id, walletId, WalletRole.OWNER);

    await translatingPgErrors(() =>
      this.database.db.transaction().execute(async (trx) => {
        const members = await lockOwnerAuthority(trx, access.walletId, user.id);
        const currentOwner = members.find((member) => member.user_id === user.id)!;
        const incoming = members.find((member) => member.user_id === toUserId);

        if (!incoming) throw new AppError('MEMBER_NOT_FOUND');
        if (incoming.role === WalletRole.OWNER) {
          throw new AppError('VALIDATION_FAILED', 'That member already owns this wallet', {
            toUserId: ['Already the owner'],
          });
        }

        await trx
          .updateTable('wallet_members')
          .set({ role: WalletRole.EDITOR, updated_at: new Date() })
          .where('id', '=', currentOwner.id)
          .execute();

        await trx
          .updateTable('wallet_members')
          .set({ role: WalletRole.OWNER, updated_at: new Date() })
          .where('id', '=', incoming.id)
          .execute();

        await trx
          .updateTable('wallets')
          .set({ owner_user_id: toUserId, updated_at: new Date() })
          .where('id', '=', access.walletId)
          .execute();

        await this.audit.record(
          {
            event: AUDIT_EVENTS.WALLET_OWNERSHIP_TRANSFERRED,
            entityType: ENTITY_TYPES.WALLET,
            entityId: access.walletId,
            actorId: user.id,
            walletId: access.walletId,
            actorRole: access.role,
            note: `Ownership moved from ${user.id} to ${toUserId}`,
            ip,
          },
          trx,
        );
      }),
    );

    return (await this.rows(access.walletId, MemberStatus.ACTIVE)).map(toMemberResponse);
  }

  /**
   * Any member may leave, except the owner.
   *
   * An owner who left would make the wallet permanently unadministrable, so they
   * must transfer ownership or archive it first (§7.5).
   */
  async leave(user: AuthenticatedUser, walletId: string, ip: string | null): Promise<void> {
    const access = await this.access.require(user.id, walletId, WalletRole.VIEWER);
    if (access.role === WalletRole.OWNER) throw new AppError('WALLET_LAST_OWNER');

    await this.database.db.transaction().execute(async (trx) => {
      // Re-read under the lock: a transfer committed meanwhile may have made this caller the owner.
      const caller = (await lockActiveMembers(trx, access.walletId)).find((member) => member.user_id === user.id);
      if (!caller) throw new AppError('WALLET_NOT_FOUND');
      if (caller.role === WalletRole.OWNER) throw new AppError('WALLET_LAST_OWNER');

      await trx
        .updateTable('wallet_members')
        .set({ status: MemberStatus.REVOKED, updated_at: new Date() })
        .where('id', '=', caller.id)
        .execute();

      await this.audit.record(
        {
          event: AUDIT_EVENTS.MEMBER_LEFT,
          entityType: ENTITY_TYPES.WALLET_MEMBER,
          entityId: caller.id,
          actorId: user.id,
          walletId: access.walletId,
          actorRole: caller.role,
          ip,
        },
        trx,
      );
    });
  }

  /** Every matching member, or one page of them; ordered by join time, then id, so pages never overlap. */
  private async rows(walletId: string, status: MemberStatus, page?: PageQuery): Promise<MemberRow[]> {
    let query = this.database.db
      .selectFrom('wallet_members')
      .innerJoin('users', 'users.id', 'wallet_members.user_id')
      .select([
        'wallet_members.id as id',
        'wallet_members.wallet_id as wallet_id',
        'wallet_members.user_id as user_id',
        'wallet_members.role as role',
        'wallet_members.relation_label as relation_label',
        'wallet_members.status as status',
        'wallet_members.joined_at as joined_at',
        'users.display_name as display_name',
        'users.email as email',
      ])
      .where('wallet_members.wallet_id', '=', walletId)
      .where('wallet_members.status', '=', status)
      .orderBy('wallet_members.joined_at', 'asc')
      .orderBy('wallet_members.id', 'asc');
    if (page) query = query.limit(page.pageSize).offset(offsetOf(page));
    return query.execute();
  }

  private async member(walletId: string, memberId: string, executor: Executor = this.database.db): Promise<MemberRow> {
    const row = await executor
      .selectFrom('wallet_members')
      .innerJoin('users', 'users.id', 'wallet_members.user_id')
      .select([
        'wallet_members.id as id',
        'wallet_members.wallet_id as wallet_id',
        'wallet_members.user_id as user_id',
        'wallet_members.role as role',
        'wallet_members.relation_label as relation_label',
        'wallet_members.status as status',
        'wallet_members.joined_at as joined_at',
        'users.display_name as display_name',
        'users.email as email',
      ])
      .where('wallet_members.id', '=', memberId)
      .where('wallet_members.wallet_id', '=', walletId)
      .executeTakeFirst();

    if (!row) throw new AppError('MEMBER_NOT_FOUND');
    return row;
  }
}

/**
 * Every membership write locks the wallet's active member rows first, in one order, so role
 * changes, removals, leaves and transfers queue instead of each acting on a read another has
 * already invalidated: an unlocked pair could leave the wallet with no owner (BR-01).
 */
async function lockActiveMembers(trx: Transaction<DB>, walletId: string) {
  return trx
    .selectFrom('wallet_members')
    .select(['id', 'user_id', 'role', 'status'])
    .where('wallet_id', '=', walletId)
    .where('status', '=', MemberStatus.ACTIVE)
    .orderBy('id')
    .forUpdate()
    .execute();
}

/** Under the lock the caller must still own the wallet: a transfer may have demoted them since the guard ran. */
async function lockOwnerAuthority(trx: Transaction<DB>, walletId: string, callerId: string) {
  const members = await lockActiveMembers(trx, walletId);
  const caller = members.find((member) => member.user_id === callerId);
  // Revoked meanwhile: a non-member now, so 404 rather than a 403 with a made-up role (AC-01).
  if (!caller) throw new AppError('WALLET_NOT_FOUND');
  if (caller.role !== WalletRole.OWNER) throw AppError.forbidden(caller.role, walletId);
  return members;
}

function toMemberResponse(row: MemberRow): WalletMemberResponse {
  return {
    id: row.id,
    walletId: row.wallet_id,
    userId: row.user_id,
    displayName: row.display_name,
    email: row.email,
    role: row.role,
    relationLabel: row.relation_label,
    status: row.status,
    joinedAt: row.joined_at.toISOString(),
  };
}
