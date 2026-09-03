import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { z } from 'zod';

import {
  ROUTES,
  cancelTransactionSchema,
  createTransactionSchema,
  transactionQuerySchema,
  updateTransactionSchema,
  type TransactionResponse,
} from '@sora/contracts';

import { ClientIp, CurrentUser, type AuthenticatedUser } from '../common/decorators.ts';
import type { Enveloped } from '../common/envelope.ts';
import { zodPipe } from '../common/zod-validation.pipe.ts';
import { TransactionsService } from './transactions.service.ts';

@Controller()
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get(ROUTES.transactions.list())
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(zodPipe(transactionQuerySchema)) query: z.infer<typeof transactionQuerySchema>,
  ): Promise<Enveloped<TransactionResponse[]>> {
    return this.transactions.list(user, query);
  }

  @Post(ROUTES.transactions.create())
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(zodPipe(createTransactionSchema)) body: z.infer<typeof createTransactionSchema>,
    @ClientIp() ip: string | null,
  ): Promise<TransactionResponse> {
    return this.transactions.create(user, body, ip);
  }

  @Get(ROUTES.transactions.detail(':id'))
  detail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') transactionId: string,
  ): Promise<TransactionResponse> {
    return this.transactions.detail(user, transactionId);
  }

  @Patch(ROUTES.transactions.update(':id'))
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') transactionId: string,
    @Body(zodPipe(updateTransactionSchema)) body: z.infer<typeof updateTransactionSchema>,
    // Unvalidated alongside `body`: amount/type/fromAccountId/toAccountId aren't
    // in updateTransactionSchema at all, so only the raw object still carries
    // them — the pipe would silently strip them before BR-03's check could see
    // that a client actually attempted to change one.
    @Body() rawBody: Record<string, unknown>,
    @ClientIp() ip: string | null,
  ): Promise<TransactionResponse> {
    return this.transactions.update(user, transactionId, body, rawBody, ip);
  }

  @HttpCode(HttpStatus.OK)
  @Post(ROUTES.transactions.cancel(':id'))
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') transactionId: string,
    @Body(zodPipe(cancelTransactionSchema)) body: z.infer<typeof cancelTransactionSchema>,
    @ClientIp() ip: string | null,
  ): Promise<TransactionResponse> {
    return this.transactions.cancel(user, transactionId, body, ip);
  }
}
