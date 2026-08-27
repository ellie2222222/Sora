import { Module } from '@nestjs/common';

import { WalletAccessModule } from '../wallets/wallet-access.module.ts';
import { BudgetsController } from './budgets.controller.ts';
import { BudgetsService } from './budgets.service.ts';

/** AuditService and DatabaseService are @Global — not re-imported here. */
@Module({
  imports: [WalletAccessModule],
  controllers: [BudgetsController],
  providers: [BudgetsService],
})
export class BudgetsModule {}
