import { Module } from '@nestjs/common';

import { RequireWalletRoleGuard } from './require-wallet-role.guard.ts';
import { WalletAccessService } from './wallet-access.service.ts';

/**
 * Kept separate from WalletsModule so every feature module can import the
 * authorization layer without importing the wallet controllers — which would
 * make WalletsModule depend on the modules that depend on it.
 */
@Module({
  providers: [WalletAccessService, RequireWalletRoleGuard],
  exports: [WalletAccessService, RequireWalletRoleGuard],
})
export class WalletAccessModule {}
