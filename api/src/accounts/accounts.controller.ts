import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { z } from 'zod';

import {
  ACCOUNT_STATUSES,
  ACCOUNT_TYPES,
  ROUTES,
  createAccountSchema,
  updateAccountSchema,
  uuidSchema,
  type AccountDetailResponse,
  type AccountResponse,
} from '@finance/contracts';

import { ClientIp, CurrentUser, type AuthenticatedUser } from '../common/decorators.ts';
import { zodPipe } from '../common/zod-validation.pipe.ts';
import { AccountsService } from './accounts.service.ts';

/** Query filters have no contracts schema — see WalletsController's identical note. */
const accountListQuerySchema = z.object({
  walletId: uuidSchema.optional(),
  status: z.enum(ACCOUNT_STATUSES).optional(),
  type: z.enum(ACCOUNT_TYPES).optional(),
});

@Controller()
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get(ROUTES.accounts.list())
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(zodPipe(accountListQuerySchema)) query: z.infer<typeof accountListQuerySchema>,
  ): Promise<AccountResponse[]> {
    return this.accounts.list(user, query);
  }

  @Post(ROUTES.accounts.create())
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(zodPipe(createAccountSchema)) body: z.infer<typeof createAccountSchema>,
    @ClientIp() ip: string | null,
  ): Promise<AccountResponse> {
    return this.accounts.create(user, body, ip);
  }

  @Get(ROUTES.accounts.detail(':id'))
  detail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') accountId: string,
  ): Promise<AccountDetailResponse> {
    return this.accounts.detail(user, accountId);
  }

  @Patch(ROUTES.accounts.update(':id'))
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') accountId: string,
    @Body(zodPipe(updateAccountSchema)) body: z.infer<typeof updateAccountSchema>,
    @ClientIp() ip: string | null,
  ): Promise<AccountResponse> {
    return this.accounts.update(user, accountId, body, ip);
  }

  @HttpCode(204)
  @Delete(ROUTES.accounts.archive(':id'))
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') accountId: string,
    @ClientIp() ip: string | null,
  ): Promise<void> {
    return this.accounts.archive(user, accountId, ip);
  }
}
