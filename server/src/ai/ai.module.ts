import { Module } from '@nestjs/common';

import { BalanceModule } from '../accounts/balance.module.ts';
import { DashboardModule } from '../dashboard/dashboard.module.ts';
import { TransactionsModule } from '../transactions/transactions.module.ts';
import { WalletAccessModule } from '../wallets/wallet-access.module.ts';
import { AiToolsService } from './ai-tools.service.ts';
import { AiController } from './ai.controller.ts';
import { AiService } from './ai.service.ts';
import { LLM_PROVIDER } from './llm-provider.ts';
import { MockLlmProvider } from './mock-llm.provider.ts';

/**
 * AuditService and DatabaseService are @Global — not re-imported here. A real
 * model replaces MockLlmProvider behind LLM_PROVIDER without touching the rest.
 */
@Module({
  imports: [WalletAccessModule, BalanceModule, DashboardModule, TransactionsModule],
  controllers: [AiController],
  providers: [AiService, AiToolsService, { provide: LLM_PROVIDER, useClass: MockLlmProvider }],
})
export class AiModule {}
