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
  deleteTransactionSchema,
  createTransactionSchema,
  transactionQuerySchema,
  updateTransactionSchema,
  type TransactionResponse,
} from '@sora/contracts';

import { ClientIp, CurrentUser, type AuthenticatedUser } from '../common/decorators.ts';
import type { Enveloped } from '../common/envelope.ts';
import { zodPipe } from '../common/zod-validation.pipe.ts';
import { rejectImmutableFieldsPipe, TransactionsService } from './transactions.service.ts';

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
    @Body(rejectImmutableFieldsPipe, zodPipe(updateTransactionSchema)) body: z.infer<typeof updateTransactionSchema>,
    @ClientIp() ip: string | null,
  ): Promise<TransactionResponse> {
    return this.transactions.update(user, transactionId, body, ip);
  }

  @HttpCode(HttpStatus.OK)
  @Post(ROUTES.transactions.delete(':id'))
  delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') transactionId: string,
    @Body(zodPipe(deleteTransactionSchema)) body: z.infer<typeof deleteTransactionSchema>,
    @ClientIp() ip: string | null,
  ): Promise<TransactionResponse> {
    return this.transactions.delete(user, transactionId, body, ip);
  }
}
