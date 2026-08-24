import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, NestFactory } from '@nestjs/core';

import { AccountsModule } from './accounts/accounts.module.ts';
import { AuditModule } from './audit/audit.module.ts';
import { AuthModule } from './auth/auth.module.ts';
import { JwtAuthGuard } from './auth/jwt-auth.guard.ts';
import { AllExceptionsFilter } from './common/all-exceptions.filter.ts';
import { CommonModule } from './common/common.module.ts';
import { EnvelopeInterceptor } from './common/envelope.interceptor.ts';
import { IdempotencyInterceptor } from './common/idempotency.interceptor.ts';
import { ConfigModule } from './config/config.module.ts';
import { DatabaseModule } from './database/database.module.ts';
import { HealthModule } from './health/health.module.ts';
import { TransactionsModule } from './transactions/transactions.module.ts';
import { WalletsModule } from './wallets/wallets.module.ts';

// Scratch harness, mirroring app.module.ts plus the not-yet-wired
// TransactionsModule, to exercise the new module against a real Postgres
// without editing app.module.ts (out of scope for this change). Deleted
// after verification.
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
    TransactionsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: EnvelopeInterceptor },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
  ],
})
class VerifyAppModule {}

const app = await NestFactory.create(VerifyAppModule, { logger: ['log', 'warn', 'error'] });
app.enableCors();
await app.listen(Number(process.env.PORT ?? 8091));
console.log('verify app listening');
