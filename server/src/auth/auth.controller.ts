import { Body, Controller, Get, HttpCode, Patch, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';

import {
  ROUTES,
  googleAuthSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  updatePreferencesSchema,
  type AuthResponse,
  type AuthTokens,
  type UserResponse,
} from '@sora/contracts';

import { ClientIp, CurrentUser, Public, type AuthenticatedUser } from '../common/decorators.ts';
import { zodPipe } from '../common/zod-validation.pipe.ts';
import { AuthRateLimitGuard } from './auth-rate-limit.guard.ts';
import { AuthService } from './auth.service.ts';

/**
 * Logout's body is optional and has no contracts schema — §5.4 defines the field
 * but the app never validates it, so the shape is declared where it is consumed
 * rather than added to the shared package for one server-only use.
 */
const logoutSchema = z.object({ refreshToken: z.string().min(1).optional() }).default({});

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

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
  @HttpCode(200)
  @Post(ROUTES.auth.login())
  login(
    @Body(zodPipe(loginSchema)) body: z.infer<typeof loginSchema>,
    @ClientIp() ip: string | null,
  ): Promise<AuthResponse> {
    return this.auth.login(body, ip);
  }

  @Public()
  @UseGuards(AuthRateLimitGuard)
  @HttpCode(200)
  @Post(ROUTES.auth.google())
  google(
    @Body(zodPipe(googleAuthSchema)) body: z.infer<typeof googleAuthSchema>,
    @ClientIp() ip: string | null,
  ): Promise<AuthResponse> {
    return this.auth.loginWithGoogle(body, ip);
  }

  @Public()
  @UseGuards(AuthRateLimitGuard)
  @HttpCode(200)
  @Post(ROUTES.auth.refresh())
  refresh(
    @Body(zodPipe(refreshSchema)) body: z.infer<typeof refreshSchema>,
    @ClientIp() ip: string | null,
  ): Promise<AuthTokens> {
    return this.auth.refresh(body, ip);
  }

  @HttpCode(204)
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
}
