import { Module } from '@nestjs/common';

import { WalletAccessModule } from '../wallets/wallet-access.module.ts';
import { GoalContributionsService } from './goal-contributions.service.ts';
import { GoalsController } from './goals.controller.ts';
import { GoalsService } from './goals.service.ts';

/** AuditService and DatabaseService are @Global — not re-imported here. */
@Module({
  imports: [WalletAccessModule],
  controllers: [GoalsController],
  providers: [GoalsService, GoalContributionsService],
})
export class GoalsModule {}
