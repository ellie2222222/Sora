import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { uuidSchema } from '@sora/contracts';
import type { Request } from 'express';

import { AppError } from './app-error.ts';

/**
 * Every path parameter is a resource id, so a segment that is not a uuid matches no route.
 * Checked as a global guard because route guards (RequireWalletRole) query by the id before any
 * pipe runs, and Postgres would answer a malformed uuid with a 500, not a 404.
 */
@Injectable()
export class PathIdGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { params } = context.switchToHttp().getRequest<Request>();
    for (const value of Object.values(params ?? {})) {
      if (!uuidSchema.safeParse(value).success) throw new AppError('ROUTE_NOT_FOUND');
    }
    return true;
  }
}
