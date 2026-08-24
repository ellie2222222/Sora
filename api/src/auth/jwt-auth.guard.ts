/**
 * Applied globally; routes opt out with `@Public()`.
 *
 * Global-by-default rather than per-controller, because the failure mode of the
 * opposite arrangement is a new controller that silently ships unauthenticated —
 * forgetting `@Public()` fails closed, forgetting `@UseGuards()` fails open.
 */

import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { AppError } from '../common/app-error.ts';
import { IS_PUBLIC, type AuthenticatedUser } from '../common/decorators.ts';
import { TokenService } from './token.service.ts';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const header = request.header('authorization');

    if (!header?.toLowerCase().startsWith('bearer ')) {
      throw new AppError('UNAUTHENTICATED');
    }

    request.user = this.tokens.verifyAccessToken(header.slice('bearer '.length).trim());
    return true;
  }
}
