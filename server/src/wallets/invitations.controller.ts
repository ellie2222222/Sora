import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import type { z } from 'zod';

import {
  ROUTES,
  acceptInvitationSchema,
  previewInvitationSchema,
  type InvitationPreviewResponse,
  type WalletResponse,
} from '@sora/contracts';

import { ClientIp, CurrentUser, Public, type AuthenticatedUser } from '../common/decorators.ts';
import { zodPipe } from '../common/zod-validation.pipe.ts';
import { InvitationsService } from './invitations.service.ts';

/**
 * Token-addressed invitation routes, which sit outside `/wallets/{id}/**`
 * because the caller has no membership on that wallet yet — the token is the
 * only thing identifying it, so a wallet-scoped path would be unresolvable.
 *
 * Kept in its own controller rather than on WalletsController: that one applies
 * RequireWalletRoleGuard at class level, which cannot be satisfied here and
 * would reject the public preview outright.
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
}
