// Throwaway verification harness — NOT part of the deliverable.
// Boots a minimal Nest app wiring in BudgetsModule/GoalsModule (which
// app.module.ts does not import yet, per instructions) so the new endpoints
// can be curl-tested against a real Postgres. Deleted after verification.
import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory, APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

const DIST = new URL('./dist/src/', import.meta.url).pathname;

const { ConfigModule } = await import(`${DIST}config/config.module.js`);
const { CommonModule } = await import(`${DIST}common/common.module.js`);
const { DatabaseModule } = await import(`${DIST}database/database.module.js`);
const { AuditModule } = await import(`${DIST}audit/audit.module.js`);
const { AuthModule } = await import(`${DIST}auth/auth.module.js`);
const { WalletsModule } = await import(`${DIST}wallets/wallets.module.js`);
const { AccountsModule } = await import(`${DIST}accounts/accounts.module.js`);
const { BudgetsModule } = await import(`${DIST}budgets/budgets.module.js`);
const { GoalsModule } = await import(`${DIST}goals/goals.module.js`);
const { JwtAuthGuard } = await import(`${DIST}auth/jwt-auth.guard.js`);
const { AllExceptionsFilter } = await import(`${DIST}common/all-exceptions.filter.js`);
const { EnvelopeInterceptor } = await import(`${DIST}common/envelope.interceptor.js`);
const { IdempotencyInterceptor } = await import(`${DIST}common/idempotency.interceptor.js`);
const { loadConfig } = await import(`${DIST}config/env.js`);

class VerifyAppModule {}
Module({
  imports: [
    ConfigModule,
    CommonModule,
    DatabaseModule,
    AuditModule,
    AuthModule,
    WalletsModule,
    AccountsModule,
    BudgetsModule,
    GoalsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: EnvelopeInterceptor },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
  ],
})(VerifyAppModule);

async function bootstrap() {
  const config = loadConfig();
  const app = await NestFactory.create(VerifyAppModule, { logger: ['log', 'warn', 'error'] });
  app.enableCors();
  await app.listen(config.PORT);
  console.log(`VERIFY_LISTENING ${config.PORT}`);
}

await bootstrap();
