import { Module } from '@nestjs/common';

import { WalletAccessModule } from '../wallets/wallet-access.module.ts';
import { AccountsController } from './accounts.controller.ts';
import { AccountsService } from './accounts.service.ts';
import { BalanceModule } from './balance.module.ts';

/** AuditService and DatabaseService are @Global — not re-imported here. */
@Module({
  imports: [WalletAccessModule, BalanceModule],
  controllers: [AccountsController],
  providers: [AccountsService],
})
export class AccountsModule {}
