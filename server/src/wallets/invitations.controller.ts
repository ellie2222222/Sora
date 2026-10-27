import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';

import {
  ROUTES,
  acceptInvitationSchema,
  previewInvitationSchema,
  type InvitationPreviewResponse,
  type ReceivedInvitationResponse,
  type WalletResponse,
} from '@sora/contracts';

import { ClientIp, CurrentUser, Public, type AuthenticatedUser } from '../common/decorators.ts';
import type { Enveloped } from '../common/envelope.ts';
import { pageQuery } from '../common/pagination.ts';
import { zodPipe } from '../common/zod-validation.pipe.ts';
import { InvitationsService } from './invitations.service.ts';

const receivedListQuerySchema = z.object({ ...pageQuery });

/**
 * The invitee's routes, by token or by their own email: outside `/wallets/{id}/**` because the caller has no
 * membership yet, so WalletsController's class-level RequireWalletRoleGuard would reject every one of them.
 */
@Controller()
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Public()
  @Post(ROUTES.invitations.preview())
  @HttpCode(HttpStatus.OK)
  preview(
    @Body(zodPipe(previewInvitationSchema)) body: z.infer<typeof previewInvitationSchema>,
  ): Promise<InvitationPreviewResponse> {
    return this.invitations.preview(body.token);
  }

  @Post(ROUTES.invitations.accept())
  @HttpCode(HttpStatus.OK)
  accept(
    @CurrentUser() user: AuthenticatedUser,
    @Body(zodPipe(acceptInvitationSchema)) body: z.infer<typeof acceptInvitationSchema>,
    @ClientIp() ip: string | null,
  ): Promise<WalletResponse> {
    return this.invitations.accept(user, body.token, ip);
  }

  @Get(ROUTES.invitations.received())
  listReceived(
    @CurrentUser() user: AuthenticatedUser,
    @Query(zodPipe(receivedListQuerySchema)) query: z.infer<typeof receivedListQuerySchema>,
  ): Promise<Enveloped<ReceivedInvitationResponse[]>> {
    return this.invitations.listReceived(user, query);
  }

  @Post(ROUTES.invitations.acceptById(':id'))
  @HttpCode(HttpStatus.OK)
  acceptById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') invitationId: string,
    @ClientIp() ip: string | null,
  ): Promise<WalletResponse> {
    return this.invitations.acceptById(user, invitationId, ip);
  }

  @Post(ROUTES.invitations.decline(':id'))
  @HttpCode(HttpStatus.NO_CONTENT)
  decline(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') invitationId: string,
    @ClientIp() ip: string | null,
  ): Promise<void> {
    return this.invitations.decline(user, invitationId, ip);
  }
}
