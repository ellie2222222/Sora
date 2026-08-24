import { Module } from '@nestjs/common';

import { BalanceService } from './balance.service.ts';

/** Separate from AccountsModule so wallets and the dashboard can derive balances
 * without importing the accounts controllers. */
@Module({
  providers: [BalanceService],
  exports: [BalanceService],
})
export class BalanceModule {}
