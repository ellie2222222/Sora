import { Inject, Injectable } from '@nestjs/common';

import type {
  InviteMemberRequest,
  WalletInvitationCreatedResponse,
  WalletInvitationResponse,
  WalletResponse,
  WalletRole,
} from '@sora/contracts';

import { AUDIT_EVENTS, ENTITY_TYPES } from '../audit/audit-events.ts';
import { AuditService } from '../audit/audit.service.ts';
import { TokenService } from '../auth/token.service.ts';
import { AppError } from '../common/app-error.ts';
import type { AuthenticatedUser } from '../common/decorators.ts';
import { translatingPgErrors } from '../common/pg-error.ts';
import { CONFIG, type AppConfig } from '../config/env.ts';
import { DatabaseService } from '../database/database.service.ts';
import { WalletAccessService } from './wallet-access.service.ts';
import { WalletsService } from './wallets.service.ts';

export type InvitationState = 'open' | 'accepted' | 'revoked' | 'expired';

export interface InvitationPreview {
  walletName: string;
  invitedEmail: string;
  role: WalletRole;
  expiresAt: string;
}

interface InvitationRow {
  id: string;
  wallet_id: string;
  wallet_name: string;
  invited_email: string;
  role: WalletRole;
  relation_label: string | null;
  expires_at: Date;
  accepted_at: Date | null;
  revoked_at: Date | null;
  created_at: Date;
}

@Injectable()
export class InvitationsService {
  constructor(
    @Inject(CONFIG) private readonly config: AppConfig,
    private readonly database: DatabaseService,
    private readonly access: WalletAccessService,
    private readonly wallets: WalletsService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
  ) {}

  /**
   * The token is deliberately absent from this response.
   *
   * A list endpoint that re-emitted live tokens would turn read access to the
   * invitation list into the ability to join the wallet — the token is returned
   * exactly once, at creation (§8.1).
   */
  async list(
    user: AuthenticatedUser,
    walletId: string,
    state: InvitationState,
  ): Promise<WalletInvitationResponse[]> {
    const access = await this.access.require(user.id, walletId, 'OWNER');

    let query = this.baseQuery().where('wallet_invitations.wallet_id', '=', access.walletId);
    const now = new Date();

    if (state === 'open') {
      query = query
        .where('wallet_invitations.accepted_at', 'is', null)
        .where('wallet_invitations.revoked_at', 'is', null)
        .where('wallet_invitations.expires_at', '>', now);
    } else if (state === 'accepted') {
      query = query.where('wallet_invitations.accepted_at', 'is not', null);
    } else if (state === 'revoked') {
      query = query.where('wallet_invitations.revoked_at', 'is not', null);
    } else {
      query = query
        .where('wallet_invitations.accepted_at', 'is', null)
        .where('wallet_invitations.revoked_at', 'is', null)
        .where('wallet_invitations.expires_at', '<=', now);
    }

    const rows = await query.orderBy('wallet_invitations.created_at', 'desc').execute();
    return rows.map(toInvitationResponse);
  }

  async create(
    user: AuthenticatedUser,
    walletId: string,
    request: InviteMemberRequest,
    ip: string | null,
  ): Promise<WalletInvitationCreatedResponse> {
    const access = await this.access.require(user.id, walletId, 'OWNER');

    const existingMember = await this.database.db
      .selectFrom('wallet_members')
      .innerJoin('users', 'users.id', 'wallet_members.user_id')
      .select('wallet_members.id')
      .where('wallet_members.wallet_id', '=', access.walletId)
      .where('wallet_members.status', '=', 'ACTIVE')
      .where('users.email', '=', request.email)
      .executeTakeFirst();

    if (existingMember) throw new AppError('MEMBER_ALREADY_EXISTS');

    const token = this.tokens.newOpaqueToken();
    const expiresAt = new Date(
      Date.now() + this.config.INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    // uq_wallet_invitation_open is what actually rejects a second live invitation
    // for the same (wallet, email); a pre-check could pass and still race.
    const created = await translatingPgErrors(() =>
      this.database.db
        .insertInto('wallet_invitations')
        .values({
          wallet_id: access.walletId,
          invited_email: request.email,
          role: request.role,
          relation_label: request.relationLabel ?? null,
          token_hash: this.tokens.hashToken(token),
          expires_at: expiresAt,
          created_by_user_id: user.id,
        })
        .returning(['id', 'created_at'])
        .executeTakeFirstOrThrow(),
    );

    await this.audit.record({
      event: AUDIT_EVENTS.MEMBER_INVITED,
      entityType: ENTITY_TYPES.WALLET_INVITATION,
      entityId: created.id,
      actorId: user.id,
      walletId: access.walletId,
      actorRole: access.role,
      note: `Invited ${request.email} as ${request.role}`,
      ip,
    });

    return {
      id: created.id,
      walletId: access.walletId,
      walletName: access.walletName,
      invitedEmail: request.email,
      role: request.role,
      relationLabel: request.relationLabel ?? null,
      expiresAt: expiresAt.toISOString(),
      createdAt: created.created_at.toISOString(),
      token,
    };
  }

  /** Revoking also frees the (wallet, email) slot for a fresh invitation. */
  async revoke(
    user: AuthenticatedUser,
    walletId: string,
    invitationId: string,
    ip: string | null,
  ): Promise<void> {
    const access = await this.access.require(user.id, walletId, 'OWNER');

    const invitation = await this.baseQuery()
      .where('wallet_invitations.id', '=', invitationId)
      .where('wallet_invitations.wallet_id', '=', access.walletId)
      .executeTakeFirst();

    if (!invitation) throw new AppError('INVITATION_NOT_FOUND');
    if (invitation.accepted_at !== null) throw new AppError('INVITATION_ALREADY_USED');

    await this.database.db
      .updateTable('wallet_invitations')
      .set({ revoked_at: new Date() })
      .where('id', '=', invitation.id)
      .where('revoked_at', 'is', null)
      .execute();

    await this.audit.record({
      event: AUDIT_EVENTS.INVITATION_REVOKED,
      entityType: ENTITY_TYPES.WALLET_INVITATION,
      entityId: invitation.id,
      actorId: user.id,
      walletId: access.walletId,
      actorRole: access.role,
      note: `Revoked invitation for ${invitation.invited_email}`,
      ip,
    });
  }

  /**
   * Public: lets an invitee see what they are being offered before signing up.
   *
   * The email is masked because the token may be pasted anywhere and this
   * endpoint needs no authentication — handing back a full address would make it
   * an address-lookup oracle for anyone who obtains a token (§8.4).
   */
  async preview(token: string): Promise<InvitationPreview> {
    const invitation = await this.byToken(token);
    this.assertOpen(invitation);

    return {
      walletName: invitation.wallet_name,
      invitedEmail: maskEmail(invitation.invited_email),
      role: invitation.role,
      expiresAt: invitation.expires_at.toISOString(),
    };
  }

  /**
   * Accept, as the person the invitation names.
   *
   * The email equality check is what makes this an invitation rather than a
   * bearer capability: without it anyone holding the token could join the wallet
   * (§8.5).
   */
  async accept(
    user: AuthenticatedUser,
    token: string,
    ip: string | null,
  ): Promise<WalletResponse> {
    const invitation = await this.byToken(token);
    this.assertOpen(invitation);

    if (invitation.invited_email.toLowerCase() !== user.email.toLowerCase()) {
      throw new AppError('INVITATION_EMAIL_MISMATCH');
    }

    const existing = await this.database.db
      .selectFrom('wallet_members')
      .select(['id', 'status'])
      .where('wallet_id', '=', invitation.wallet_id)
      .where('user_id', '=', user.id)
      .executeTakeFirst();

    if (existing?.status === 'ACTIVE') throw new AppError('MEMBER_ALREADY_EXISTS');

    await translatingPgErrors(() =>
      this.database.db.transaction().execute(async (trx) => {
        if (existing) {
          // A previously revoked membership is reinstated rather than inserted:
          // uq_wallet_member is on (wallet_id, user_id) regardless of status.
          await trx
            .updateTable('wallet_members')
            .set({
              role: invitation.role,
              relation_label: invitation.relation_label,
              status: 'ACTIVE',
              joined_at: new Date(),
              updated_at: new Date(),
            })
            .where('id', '=', existing.id)
            .execute();
        } else {
          await trx
            .insertInto('wallet_members')
            .values({
              wallet_id: invitation.wallet_id,
              user_id: user.id,
              role: invitation.role,
              relation_label: invitation.relation_label,
            })
            .execute();
        }

        await trx
          .updateTable('wallet_invitations')
          .set({ accepted_at: new Date() })
          .where('id', '=', invitation.id)
          .execute();

        await this.audit.record(
          {
            event: AUDIT_EVENTS.INVITATION_ACCEPTED,
            entityType: ENTITY_TYPES.WALLET_INVITATION,
            entityId: invitation.id,
            actorId: user.id,
            walletId: invitation.wallet_id,
            actorRole: invitation.role,
            note: `${user.email} joined as ${invitation.role}`,
            ip,
          },
          trx,
        );
      }),
    );

    return this.wallets.get(user, invitation.wallet_id);
  }

  private baseQuery() {
    return this.database.db
      .selectFrom('wallet_invitations')
      .innerJoin('wallets', 'wallets.id', 'wallet_invitations.wallet_id')
      .select([
        'wallet_invitations.id as id',
        'wallet_invitations.wallet_id as wallet_id',
        'wallets.name as wallet_name',
        'wallet_invitations.invited_email as invited_email',
        'wallet_invitations.role as role',
        'wallet_invitations.relation_label as relation_label',
        'wallet_invitations.expires_at as expires_at',
        'wallet_invitations.accepted_at as accepted_at',
        'wallet_invitations.revoked_at as revoked_at',
        'wallet_invitations.created_at as created_at',
      ]);
  }

  private async byToken(token: string): Promise<InvitationRow> {
    const row = await this.baseQuery()
      .where('wallet_invitations.token_hash', '=', this.tokens.hashToken(token))
      .executeTakeFirst();

    if (!row) throw new AppError('INVITATION_NOT_FOUND');
    return row;
  }

  /** A revoked invitation reads as absent: it was withdrawn, so there is nothing to accept. */
  private assertOpen(invitation: InvitationRow): void {
    if (invitation.revoked_at !== null) throw new AppError('INVITATION_NOT_FOUND');
    if (invitation.accepted_at !== null) throw new AppError('INVITATION_ALREADY_USED');
    if (invitation.expires_at.getTime() <= Date.now()) throw new AppError('INVITATION_EXPIRED');
  }
}

function toInvitationResponse(row: InvitationRow): WalletInvitationResponse {
  return {
    id: row.id,
    walletId: row.wallet_id,
    walletName: row.wallet_name,
    invitedEmail: row.invited_email,
    role: row.role,
    relationLabel: row.relation_label,
    expiresAt: row.expires_at.toISOString(),
    createdAt: row.created_at.toISOString(),
  };
}

function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return '***';
  return `${email.slice(0, 1)}***${email.slice(at)}`;
}
