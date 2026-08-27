import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module.ts';
import { AuthController } from './auth.controller.ts';
import { AuthRateLimitGuard } from './auth-rate-limit.guard.ts';
import { AuthService } from './auth.service.ts';
import { JwtAuthGuard } from './jwt-auth.guard.ts';
import { TokenService } from './token.service.ts';

@Module({
  imports: [AuditModule],
  controllers: [AuthController],
  providers: [AuthService, TokenService, JwtAuthGuard, AuthRateLimitGuard],
  exports: [TokenService, JwtAuthGuard],
})
export class AuthModule {}
