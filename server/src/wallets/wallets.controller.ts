import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';

import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MEMBER_STATUSES,
  MemberStatus,
  ROUTES,
  WALLET_STATUSES,
  WalletRole,
  WalletStatus,
  createWalletSchema,
  inviteMemberSchema,
  isoDateSchema,
  updateMemberSchema,
  updateWalletSchema,
  uuidSchema,
  type AuditLogResponse,
  type WalletInvitationCreatedResponse,
  type WalletInvitationResponse,
  type WalletMemberResponse,
  type WalletResponse,
} from '@sora/contracts';

import { AuditService } from '../audit/audit.service.ts';
import {
  ClientIp,
  CurrentUser,
  RequireWalletRole,
  type AuthenticatedUser,
} from '../common/decorators.ts';
import { type Enveloped, paginated } from '../common/envelope.ts';
import { paginationMeta } from '../common/pagination.ts';
import { zodPipe } from '../common/zod-validation.pipe.ts';
import { InvitationsService } from './invitations.service.ts';
import { MembersService } from './members.service.ts';
import { RequireWalletRoleGuard } from './require-wallet-role.guard.ts';
import { WalletsService } from './wallets.service.ts';

/**
 * Query and body shapes with no counterpart in @sora/contracts.
 *
 * The contracts package covers what both sides validate; these are list filters
 * and one body the app does not validate client-side, so they are declared where
 * they are consumed rather than added to the shared package for a single use.
 */
const walletListQuerySchema = z.object({
  status: z.enum(WALLET_STATUSES).default(WalletStatus.ACTIVE),
  includeOwn: z.coerce.boolean().default(true),
  includeShared: z.coerce.boolean().default(true),
});

const memberListQuerySchema = z.object({
  status: z.enum(MEMBER_STATUSES).default(MemberStatus.ACTIVE),
});

const invitationListQuerySchema = z.object({
  state: z.enum(['open', 'accepted', 'revoked', 'expired']).default('open'),
});

const transferOwnershipSchema = z.object({ toUserId: uuidSchema });

/** §15.1's filters — `event` is not in @sora/contracts (see audit-events.ts's own note). */
const auditLogQuerySchema = z.object({
  event: z.string().trim().min(1).optional(),
  dateFrom: isoDateSchema.optional(),
  dateTo: isoDateSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

@UseGuards(RequireWalletRoleGuard)
@Controller()
export class WalletsController {
  constructor(
    private readonly wallets: WalletsService,
    private readonly members: MembersService,
    private readonly invitations: InvitationsService,
    private readonly audit: AuditService,
  ) {}

  @Get(ROUTES.wallets.list())
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(zodPipe(walletListQuerySchema)) query: z.infer<typeof walletListQuerySchema>,
  ): Promise<WalletResponse[]> {
    return this.wallets.list(user, query);
  }

  @Post(ROUTES.wallets.create())
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(zodPipe(createWalletSchema)) body: z.infer<typeof createWalletSchema>,
    @ClientIp() ip: string | null,
  ): Promise<WalletResponse> {
    return this.wallets.create(user, body, ip);
  }

  @RequireWalletRole(WalletRole.VIEWER)
  @Get(ROUTES.wallets.detail(':id'))
  detail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') walletId: string,
  ): Promise<WalletResponse> {
    return this.wallets.get(user, walletId);
  }

  @RequireWalletRole(WalletRole.OWNER)
  @Patch(ROUTES.wallets.update(':id'))
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') walletId: string,
    @Body(zodPipe(updateWalletSchema)) body: z.infer<typeof updateWalletSchema>,
    @ClientIp() ip: string | null,
  ): Promise<WalletResponse> {
    return this.wallets.update(user, walletId, body, ip);
  }

  @RequireWalletRole(WalletRole.OWNER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(ROUTES.wallets.archive(':id'))
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') walletId: string,
    @ClientIp() ip: string | null,
  ): Promise<void> {
    return this.wallets.archive(user, walletId, ip);
  }

  @RequireWalletRole(WalletRole.VIEWER)
  @Get(ROUTES.wallets.members(':id'))
  listMembers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') walletId: string,
    @Query(zodPipe(memberListQuerySchema)) query: z.infer<typeof memberListQuerySchema>,
  ): Promise<WalletMemberResponse[]> {
    return this.members.list(user, walletId, query.status);
  }

  @RequireWalletRole(WalletRole.OWNER)
  @Patch(ROUTES.wallets.member(':id', ':memberId'))
  updateMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') walletId: string,
    @Param('memberId') memberId: string,
    @Body(zodPipe(updateMemberSchema)) body: z.infer<typeof updateMemberSchema>,
    @ClientIp() ip: string | null,
  ): Promise<WalletMemberResponse> {
    return this.members.updateRole(user, walletId, memberId, body, ip);
  }

  @RequireWalletRole(WalletRole.OWNER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(ROUTES.wallets.member(':id', ':memberId'))
  removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') walletId: string,
    @Param('memberId') memberId: string,
    @ClientIp() ip: string | null,
  ): Promise<void> {
    return this.members.remove(user, walletId, memberId, ip);
  }

  @RequireWalletRole(WalletRole.OWNER)
  @HttpCode(HttpStatus.OK)
  @Post(ROUTES.wallets.transferOwnership(':id'))
  transferOwnership(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') walletId: string,
    @Body(zodPipe(transferOwnershipSchema)) body: z.infer<typeof transferOwnershipSchema>,
    @ClientIp() ip: string | null,
  ): Promise<WalletMemberResponse[]> {
    return this.members.transferOwnership(user, walletId, body.toUserId, ip);
  }

  @RequireWalletRole(WalletRole.VIEWER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post(ROUTES.wallets.leave(':id'))
  leave(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') walletId: string,
    @ClientIp() ip: string | null,
  ): Promise<void> {
    return this.members.leave(user, walletId, ip);
  }

  @RequireWalletRole(WalletRole.OWNER)
  @Get(ROUTES.wallets.invitations(':id'))
  listInvitations(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') walletId: string,
    @Query(zodPipe(invitationListQuerySchema)) query: z.infer<typeof invitationListQuerySchema>,
  ): Promise<WalletInvitationResponse[]> {
    return this.invitations.list(user, walletId, query.state);
  }

  @RequireWalletRole(WalletRole.OWNER)
  @Post(ROUTES.wallets.invitations(':id'))
  createInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') walletId: string,
    @Body(zodPipe(inviteMemberSchema)) body: z.infer<typeof inviteMemberSchema>,
    @ClientIp() ip: string | null,
  ): Promise<WalletInvitationCreatedResponse> {
    return this.invitations.create(user, walletId, body, ip);
  }

  @RequireWalletRole(WalletRole.OWNER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(ROUTES.wallets.invitation(':id', ':invitationId'))
  revokeInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') walletId: string,
    @Param('invitationId') invitationId: string,
    @ClientIp() ip: string | null,
  ): Promise<void> {
    return this.invitations.revoke(user, walletId, invitationId, ip);
  }

  /**
   * OWNER-only (§15.1, AC-04): membership and role changes are visible in this
   * trail, so a VIEWER/EDITOR must not read it. `RequireWalletRoleGuard` has
   * already resolved the 404-vs-403 distinction by the time this body runs.
   */
  @RequireWalletRole(WalletRole.OWNER)
  @Get(ROUTES.audit.list(':id'))
  async listAuditLogs(
    @Param('id') walletId: string,
    @Query(zodPipe(auditLogQuerySchema)) query: z.infer<typeof auditLogQuerySchema>,
  ): Promise<Enveloped<AuditLogResponse[]>> {
    const { rows, total } = await this.audit.listForWallet(walletId, query);
    return paginated(rows, paginationMeta(query.page, query.pageSize, total));
  }
}
