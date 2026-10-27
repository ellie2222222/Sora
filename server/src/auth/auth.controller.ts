import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';

import {
  ROUTES,
  confirmEmailVerificationSchema,
  googleAuthSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  updatePreferencesSchema,
  type AuthResponse,
  type AuthTokens,
  type EmailVerificationSentResponse,
  type UserResponse,
} from '@sora/contracts';

import { ClientIp, CurrentUser, Public, type AuthenticatedUser } from '../common/decorators.ts';
import { zodPipe } from '../common/zod-validation.pipe.ts';
import { AuthRateLimitGuard } from './auth-rate-limit.guard.ts';
import { AppError } from '../common/app-error.ts';
import { AuthService } from './auth.service.ts';
import { EmailVerificationService } from './email-verification.service.ts';

/**
 * Logout's body is optional and has no contracts schema — §5.4 defines the field
 * but the app never validates it, so the shape is declared where it is consumed
 * rather than added to the shared package for one server-only use.
 */
const logoutSchema = z.object({ refreshToken: z.string().min(1).optional() }).default({});

@Controller()
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly emailVerification: EmailVerificationService,
  ) {}

  @Public()
  @UseGuards(AuthRateLimitGuard)
  @Post(ROUTES.auth.register())
  register(
    @Body(zodPipe(registerSchema)) body: z.infer<typeof registerSchema>,
    @ClientIp() ip: string | null,
  ): Promise<AuthResponse> {
    return this.auth.register(body, ip);
  }

  @Public()
  @UseGuards(AuthRateLimitGuard)
  @HttpCode(HttpStatus.OK)
  @Post(ROUTES.auth.login())
  login(
    @Body(zodPipe(loginSchema)) body: z.infer<typeof loginSchema>,
    @ClientIp() ip: string | null,
  ): Promise<AuthResponse> {
    return this.auth.login(body, ip);
  }

  @Public()
  @UseGuards(AuthRateLimitGuard)
  @HttpCode(HttpStatus.OK)
  @Post(ROUTES.auth.google())
  google(
    @Body(zodPipe(googleAuthSchema)) body: z.infer<typeof googleAuthSchema>,
    @ClientIp() ip: string | null,
  ): Promise<AuthResponse> {
    return this.auth.loginWithGoogle(body, ip);
  }

  @Public()
  @UseGuards(AuthRateLimitGuard)
  @HttpCode(HttpStatus.OK)
  @Post(ROUTES.auth.refresh())
  refresh(
    @Body(zodPipe(refreshSchema)) body: z.infer<typeof refreshSchema>,
    @ClientIp() ip: string | null,
  ): Promise<AuthTokens> {
    return this.auth.refresh(body, ip);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post(ROUTES.auth.logout())
  logout(
    @CurrentUser() user: AuthenticatedUser,
    @Body(zodPipe(logoutSchema)) body: z.infer<typeof logoutSchema>,
    @ClientIp() ip: string | null,
  ): Promise<void> {
    return this.auth.logout(user, body.refreshToken, ip);
  }

  @Get(ROUTES.auth.me())
  me(@CurrentUser() user: AuthenticatedUser): Promise<UserResponse> {
    return this.auth.me(user);
  }

  @Patch(ROUTES.auth.preferences())
  updatePreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body(zodPipe(updatePreferencesSchema)) body: z.infer<typeof updatePreferencesSchema>,
  ): Promise<UserResponse> {
    return this.auth.updatePreferences(user, body);
  }

  @UseGuards(AuthRateLimitGuard)
  @HttpCode(HttpStatus.OK)
  @Post(ROUTES.auth.sendEmailVerification())
  async sendEmailVerification(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<EmailVerificationSentResponse> {
    try {
      return await this.emailVerification.send(user);
    } catch (error) {
      const wait = error instanceof AppError ? error.params?.retryAfterSeconds : undefined;
      if (typeof wait === 'number') response.setHeader('Retry-After', String(wait));
      throw error;
    }
  }

  @UseGuards(AuthRateLimitGuard)
  @HttpCode(HttpStatus.OK)
  @Post(ROUTES.auth.confirmEmailVerification())
  confirmEmailVerification(
    @CurrentUser() user: AuthenticatedUser,
    @Body(zodPipe(confirmEmailVerificationSchema)) body: z.infer<typeof confirmEmailVerificationSchema>,
    @ClientIp() ip: string | null,
  ): Promise<UserResponse> {
    return this.emailVerification.confirm(user, body.code, ip);
  }
}
