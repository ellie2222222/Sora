import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { WalletRole } from '@sora/contracts';

import { NO_ENVELOPE } from './envelope.ts';

export const IS_PUBLIC = 'finance:isPublic';
export const REQUIRED_WALLET_ROLE = 'finance:requiredWalletRole';

/** Opts a route out of the globally applied JwtAuthGuard. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Opts a route out of the response envelope. */
export const NoEnvelope = () => SetMetadata(NO_ENVELOPE, true);

/**
 * Declares the minimum role the caller must hold on the wallet in the `:id` path
 * parameter. A route keyed by a sub-resource id (an account, a budget) resolves
 * its wallet from the row and so checks the role in the service instead.
 */
export const RequireWalletRole = (role: WalletRole) => SetMetadata(REQUIRED_WALLET_ROLE, role);

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
}

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
  return request.user;
});

/** Client IP, recorded on audit rows so a denied attempt can be traced. */
export const ClientIp = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<{ ip?: string }>();
  return request.ip ?? null;
});
