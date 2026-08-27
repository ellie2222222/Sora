import { Controller, Get, Query } from '@nestjs/common';
import type { z } from 'zod';

import { ROUTES, dashboardQuerySchema, type DashboardResponse } from '@finance/contracts';

import { CurrentUser, type AuthenticatedUser } from '../common/decorators.ts';
import { zodPipe } from '../common/zod-validation.pipe.ts';
import { DashboardService } from './dashboard.service.ts';

@Controller()
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get(ROUTES.dashboard.summary())
  summary(
    @CurrentUser() user: AuthenticatedUser,
    @Query(zodPipe(dashboardQuerySchema)) query: z.infer<typeof dashboardQuerySchema>,
  ): Promise<DashboardResponse> {
    return this.dashboard.summary(user, query);
  }
}
