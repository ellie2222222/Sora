import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { AccountsModule } from './accounts/accounts.module.ts';
import { AiModule } from './ai/ai.module.ts';
import { AuditModule } from './audit/audit.module.ts';
import { AuthModule } from './auth/auth.module.ts';
import { JwtAuthGuard } from './auth/jwt-auth.guard.ts';
import { BudgetsModule } from './budgets/budgets.module.ts';
import { CategoriesModule } from './categories/categories.module.ts';
import { AllExceptionsFilter } from './common/all-exceptions.filter.ts';
import { CommonModule } from './common/common.module.ts';
import { EnvelopeInterceptor } from './common/envelope.interceptor.ts';
import { IdempotencyInterceptor } from './common/idempotency.interceptor.ts';
import { PathIdGuard } from './common/path-id.guard.ts';
import { RequestLocaleInterceptor } from './common/request-locale.ts';
import { ConfigModule } from './config/config.module.ts';
import { DashboardModule } from './dashboard/dashboard.module.ts';
import { DatabaseModule } from './database/database.module.ts';
import { ExchangeRateModule } from './exchange-rate/exchange-rate.module.ts';
import { GoalsModule } from './goals/goals.module.ts';
import { HealthModule } from './health/health.module.ts';
import { TransactionsModule } from './transactions/transactions.module.ts';
import { WalletsModule } from './wallets/wallets.module.ts';

/**
 * Global cross-cutting concerns are registered as providers (APP_GUARD/
 * APP_FILTER/APP_INTERCEPTOR), not via `app.useGlobal*()` in main.ts — that
 * form constructs the instance outside Nest's DI container, so a guard or
 * interceptor with injected dependencies (JwtAuthGuard needs Reflector and
 * TokenService; EnvelopeInterceptor needs Reflector) would have to be wired by
 * hand instead of resolved automatically.
 *
 * Global guards run before route-level `@UseGuards` ones, so JwtAuthGuard authenticates
 * first; interceptors run in registration order, so EnvelopeInterceptor wraps
 * whatever IdempotencyInterceptor's `next.handle()` eventually resolves to.
 */
@Module({
  imports: [
    ConfigModule,
    CommonModule,
    DatabaseModule,
    AuditModule,
    HealthModule,
    AuthModule,
    WalletsModule,
    AccountsModule,
    CategoriesModule,
    TransactionsModule,
    BudgetsModule,
    GoalsModule,
    DashboardModule,
    ExchangeRateModule,
    AiModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PathIdGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: RequestLocaleInterceptor },
    { provide: APP_INTERCEPTOR, useClass: EnvelopeInterceptor },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
  ],
})
export class AppModule {}
