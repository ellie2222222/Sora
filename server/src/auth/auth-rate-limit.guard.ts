/**
 * Per-IP, per-route limiting for the unauthenticated auth routes (§2.9).
 *
 * Sets `Retry-After` before raising, because a client that is told only "429"
 * has no basis for a backoff and will usually retry immediately.
 */

import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { Request, Response } from 'express';

import { AppError } from '../common/app-error.ts';
import { RateLimitService } from '../common/rate-limit.service.ts';
import { CONFIG, type AppConfig } from '../config/env.ts';

const ONE_MINUTE_MS = 60_000;

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  constructor(
    @Inject(CONFIG) private readonly config: AppConfig,
    private readonly rateLimit: RateLimitService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const key = `auth:${request.ip ?? 'unknown'}:${request.path}`;

    const decision = this.rateLimit.hit(
      key,
      this.config.AUTH_RATE_LIMIT_PER_MINUTE,
      ONE_MINUTE_MS,
    );

    if (!decision.allowed) {
      http.getResponse<Response>().setHeader('Retry-After', String(decision.retryAfterSeconds));
      throw new AppError('RATE_LIMITED');
    }

    return true;
  }
}
