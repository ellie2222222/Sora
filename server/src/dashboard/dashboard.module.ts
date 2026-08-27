import { Module } from '@nestjs/common';

import { BalanceModule } from '../accounts/balance.module.ts';
import { WalletAccessModule } from '../wallets/wallet-access.module.ts';
import { DashboardController } from './dashboard.controller.ts';
import { DashboardService } from './dashboard.service.ts';

/** AuditService and DatabaseService are @Global — not re-imported here. */
@Module({
  imports: [WalletAccessModule, BalanceModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
