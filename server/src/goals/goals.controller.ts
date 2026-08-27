import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { z } from 'zod';

import {
  GOAL_STATUSES,
  ROUTES,
  createContributionSchema,
  createGoalSchema,
  updateGoalSchema,
  uuidSchema,
  type ContributionResponse,
  type GoalResponse,
} from '@sora/contracts';

import { ClientIp, CurrentUser, type AuthenticatedUser } from '../common/decorators.ts';
import type { Enveloped } from '../common/envelope.ts';
import { zodPipe } from '../common/zod-validation.pipe.ts';
import { GoalContributionsService } from './goal-contributions.service.ts';
import { GoalsService } from './goals.service.ts';

/** List/pagination filters have no contracts schema — see WalletsController's identical note. */
const goalListQuerySchema = z.object({
  walletId: uuidSchema,
  status: z.enum(GOAL_STATUSES).optional(),
});

const contributionListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
});

@Controller()
export class GoalsController {
  constructor(
    private readonly goals: GoalsService,
    private readonly contributions: GoalContributionsService,
  ) {}

  @Get(ROUTES.goals.list())
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(zodPipe(goalListQuerySchema)) query: z.infer<typeof goalListQuerySchema>,
  ): Promise<GoalResponse[]> {
    return this.goals.list(user, query);
  }

  @Post(ROUTES.goals.create())
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(zodPipe(createGoalSchema)) body: z.infer<typeof createGoalSchema>,
    @ClientIp() ip: string | null,
  ): Promise<GoalResponse> {
    return this.goals.create(user, body, ip);
  }

  @Get(ROUTES.goals.detail(':id'))
  detail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') goalId: string,
  ): Promise<GoalResponse> {
    return this.goals.detail(user, goalId);
  }

  @Patch(ROUTES.goals.update(':id'))
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') goalId: string,
    @Body(zodPipe(updateGoalSchema)) body: z.infer<typeof updateGoalSchema>,
    @ClientIp() ip: string | null,
  ): Promise<GoalResponse> {
    return this.goals.update(user, goalId, body, ip);
  }

  @HttpCode(204)
  @Delete(ROUTES.goals.archive(':id'))
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') goalId: string,
    @ClientIp() ip: string | null,
  ): Promise<void> {
    return this.goals.archive(user, goalId, ip);
  }

  @Get(ROUTES.goals.contributions(':id'))
  listContributions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') goalId: string,
    @Query(zodPipe(contributionListQuerySchema)) query: z.infer<typeof contributionListQuerySchema>,
  ): Promise<Enveloped<ContributionResponse[]>> {
    return this.contributions.list(user, goalId, query);
  }

  @Post(ROUTES.goals.contributions(':id'))
  createContribution(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') goalId: string,
    @Body(zodPipe(createContributionSchema)) body: z.infer<typeof createContributionSchema>,
    @ClientIp() ip: string | null,
  ): Promise<ContributionResponse> {
    return this.contributions.create(user, goalId, body, ip);
  }

  @HttpCode(204)
  @Delete(ROUTES.goals.contribution(':id', ':contributionId'))
  removeContribution(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') goalId: string,
    @Param('contributionId') contributionId: string,
    @ClientIp() ip: string | null,
  ): Promise<void> {
    return this.contributions.remove(user, goalId, contributionId, ip);
  }
}
