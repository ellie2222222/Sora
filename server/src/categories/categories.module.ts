import { Module } from '@nestjs/common';

import { WalletAccessModule } from '../wallets/wallet-access.module.ts';
import { CategoriesController } from './categories.controller.ts';
import { CategoriesService } from './categories.service.ts';

/** AuditService and DatabaseService are @Global — not re-imported here. */
@Module({
  imports: [WalletAccessModule],
  controllers: [CategoriesController],
  providers: [CategoriesService],
})
export class CategoriesModule {}
