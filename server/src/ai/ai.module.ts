import { Module } from '@nestjs/common';

import { BalanceModule } from '../accounts/balance.module.ts';
import { CONFIG, type AppConfig } from '../config/env.ts';
import { DashboardModule } from '../dashboard/dashboard.module.ts';
import { TransactionsModule } from '../transactions/transactions.module.ts';
import { WalletAccessModule } from '../wallets/wallet-access.module.ts';
import { AiToolsService } from './ai-tools.service.ts';
import { AiController } from './ai.controller.ts';
import { AiService } from './ai.service.ts';
import { GeminiLlmProvider } from './gemini-llm.provider.ts';
import { LLM_PROVIDER } from './llm-provider.ts';
import { MockLlmProvider } from './mock-llm.provider.ts';
import { ContextBuilderService } from './services/context-builder.service.ts';
import { IntentDetectorService } from './services/intent-detector.service.ts';
import { ModelRouterService } from './services/model-router.service.ts';
import { QueryPlannerService } from './services/query-planner.service.ts';

/**
 * AuditService, ConfigModule, and DatabaseService are @Global — not re-imported here.
 * When GEMINI_API_KEY is configured in the environment, GeminiLlmProvider is activated;
 * otherwise it runs deterministically via MockLlmProvider for offline and test runs.
 */
@Module({
  imports: [WalletAccessModule, BalanceModule, DashboardModule, TransactionsModule],
  controllers: [AiController],
  providers: [
    AiService,
    AiToolsService,
    ModelRouterService,
    IntentDetectorService,
    QueryPlannerService,
    ContextBuilderService,
    {
      provide: LLM_PROVIDER,
      useFactory: (config: AppConfig) => {
        return config.GEMINI_API_KEY
          ? new GeminiLlmProvider(
              config.GEMINI_API_KEY,
              config.GEMINI_MODEL,
              config.GEMINI_FALLBACK_MODEL,
            )
          : new MockLlmProvider();
      },
      inject: [CONFIG],
    },
  ],
  exports: [
    AiService,
    ModelRouterService,
    IntentDetectorService,
    QueryPlannerService,
    ContextBuilderService,
  ],
})
export class AiModule {}
