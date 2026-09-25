import { Module } from '@nestjs/common';

import { BalanceModule } from '../accounts/balance.module.ts';
import { AuthModule } from '../auth/auth.module.ts';
import { InvitationsController } from './invitations.controller.ts';
import { InvitationsService } from './invitations.service.ts';
import { MembersService } from './members.service.ts';
import { RequireWalletRoleGuard } from './require-wallet-role.guard.ts';
import { WalletAccessModule } from './wallet-access.module.ts';
import { WalletsController } from './wallets.controller.ts';
import { WalletsService } from './wallets.service.ts';

/**
 * Imports AuthModule for TokenService (invitations mint their own tokens) —
 * safe because AuthModule does not import WalletsModule back.
 *
 * RequireWalletRoleGuard comes from WalletAccessModule's exports, so it is not
 * re-provided here for WalletsController's `@UseGuards`.
 */
@Module({
  imports: [WalletAccessModule, BalanceModule, AuthModule],
  controllers: [WalletsController, InvitationsController],
  providers: [WalletsService, MembersService, InvitationsService],
  exports: [WalletsService],
})
export class WalletsModule {}
