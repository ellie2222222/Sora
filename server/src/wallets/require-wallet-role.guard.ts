/**
 * Enforces `@RequireWalletRole(...)` for routes whose wallet id is the `:id`
 * path parameter — `/wallets/:id/...`.
 *
 * A route keyed only by a sub-resource id (`/accounts/:id`, `/budgets/:id`)
 * cannot be guarded here: its wallet is a property of the stored row, so
 * resolving it means a database read that also has to decide whether the row is
 * visible at all. Those check the role through WalletAccessService inside the
 * service, which is the same code path — the guard is a convenience for the
 * cases where the id arrives for free, not a second implementation.
 */

import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import type { WalletRole } from '@sora/contracts';

import { AppError } from '../common/app-error.ts';
import { REQUIRED_WALLET_ROLE, type AuthenticatedUser } from '../common/decorators.ts';
import { WalletAccessService } from './wallet-access.service.ts';

interface GuardedRequest extends Request {
  user?: AuthenticatedUser;
}

@Injectable()
export class RequireWalletRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly access: WalletAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<WalletRole | undefined>(
      REQUIRED_WALLET_ROLE,
      [context.getHandler(), context.getClass()],
    );
    if (!required) return true;

    const request = context.switchToHttp().getRequest<GuardedRequest>();
    const userId = request.user?.id;
    if (!userId) throw new AppError('UNAUTHENTICATED');

    const walletId = request.params?.['id'];
    // No wallet id at all cannot be an authorization pass.
    if (typeof walletId !== 'string' || walletId.length === 0) throw new AppError('WALLET_NOT_FOUND');

    await this.access.require(userId, walletId, required);
    return true;
  }
}
