/**
 * Enforces `@RequireWalletRole(...)` for routes whose wallet id is on the
 * request itself — `/wallets/:id/...`, or a `walletId` in the body or query.
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
import {
  REQUIRED_WALLET_ROLE,
  WALLET_ID_SOURCE,
  type AuthenticatedUser,
  type WalletIdSource,
} from '../common/decorators.ts';
import { WalletAccessService, type WalletAccess } from './wallet-access.service.ts';

/** Where the guard leaves what it resolved, for the handler to reuse. */
export const WALLET_ACCESS_KEY = 'walletAccess';

interface GuardedRequest extends Request {
  user?: AuthenticatedUser;
  [WALLET_ACCESS_KEY]?: WalletAccess;
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

    const source =
      this.reflector.getAllAndOverride<WalletIdSource | undefined>(WALLET_ID_SOURCE, [
        context.getHandler(),
        context.getClass(),
      ]) ?? 'param:id';

    const request = context.switchToHttp().getRequest<GuardedRequest>();
    const userId = request.user?.id;
    if (!userId) throw new AppError('UNAUTHENTICATED');

    const walletId = walletIdFrom(request, source);
    // No wallet id at all cannot be an authorization pass. On the routes where
    // walletId is optional (GET /accounts across every wallet), the handler
    // filters by accessibleWalletIds instead of declaring a required role.
    if (!walletId) throw new AppError('WALLET_NOT_FOUND');

    request[WALLET_ACCESS_KEY] = await this.access.require(userId, walletId, required);
    return true;
  }
}

function walletIdFrom(request: GuardedRequest, source: WalletIdSource): string | null {
  const raw =
    source === 'param:id'
      ? request.params?.['id']
      : source === 'body:walletId'
        ? (request.body as Record<string, unknown> | undefined)?.['walletId']
        : request.query?.['walletId'];

  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}
