import { Module } from '@nestjs/common';

import { WalletAccessModule } from '../wallets/wallet-access.module.ts';
import { TransactionsController } from './transactions.controller.ts';
import { TransactionsService } from './transactions.service.ts';

/** AuditService and DatabaseService are @Global — not re-imported here. */
@Module({
  imports: [WalletAccessModule],
  controllers: [TransactionsController],
  providers: [TransactionsService],
})
export class TransactionsModule {}
