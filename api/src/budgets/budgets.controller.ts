import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { z } from 'zod';

import {
  BUDGET_STATUSES,
  ROUTES,
  createBudgetSchema,
  isoDateSchema,
  updateBudgetSchema,
  uuidSchema,
  type BudgetResponse,
} from '@finance/contracts';

import { ClientIp, CurrentUser, type AuthenticatedUser } from '../common/decorators.ts';
import { zodPipe } from '../common/zod-validation.pipe.ts';
import { BudgetsService } from './budgets.service.ts';

/** List filters have no contracts schema — see WalletsController's identical note. */
const budgetListQuerySchema = z.object({
  walletId: uuidSchema,
  status: z.enum(BUDGET_STATUSES).optional(),
  activeOn: isoDateSchema.optional(),
});

@Controller()
export class BudgetsController {
  constructor(private readonly budgets: BudgetsService) {}

  @Get(ROUTES.budgets.list())
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(zodPipe(budgetListQuerySchema)) query: z.infer<typeof budgetListQuerySchema>,
  ): Promise<BudgetResponse[]> {
    return this.budgets.list(user, query);
  }

  @Post(ROUTES.budgets.create())
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(zodPipe(createBudgetSchema)) body: z.infer<typeof createBudgetSchema>,
    @ClientIp() ip: string | null,
  ): Promise<BudgetResponse> {
    return this.budgets.create(user, body, ip);
  }

  @Get(ROUTES.budgets.detail(':id'))
  detail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') budgetId: string,
  ): Promise<BudgetResponse> {
    return this.budgets.detail(user, budgetId);
  }

  @Patch(ROUTES.budgets.update(':id'))
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') budgetId: string,
    @Body(zodPipe(updateBudgetSchema)) body: z.infer<typeof updateBudgetSchema>,
    @ClientIp() ip: string | null,
  ): Promise<BudgetResponse> {
    return this.budgets.update(user, budgetId, body, ip);
  }

  @HttpCode(204)
  @Delete(ROUTES.budgets.archive(':id'))
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') budgetId: string,
    @ClientIp() ip: string | null,
  ): Promise<void> {
    return this.budgets.archive(user, budgetId, ip);
  }
}
