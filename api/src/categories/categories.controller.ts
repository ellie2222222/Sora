import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { z } from 'zod';

import {
  CATEGORY_STATUSES,
  CATEGORY_TYPES,
  ROUTES,
  createCategorySchema,
  updateCategorySchema,
  uuidSchema,
  type CategoryResponse,
} from '@finance/contracts';

import { ClientIp, CurrentUser, type AuthenticatedUser } from '../common/decorators.ts';
import { zodPipe } from '../common/zod-validation.pipe.ts';
import { CategoriesService } from './categories.service.ts';

/** Query filters have no contracts schema — see WalletsController's identical note. */
const categoryListQuerySchema = z.object({
  walletId: uuidSchema,
  type: z.enum(CATEGORY_TYPES).optional(),
  status: z.enum(CATEGORY_STATUSES).optional(),
  tree: z.coerce.boolean().optional().default(false),
});

/** `mode` is DELETE-only and never validated client-side, so it stays local too. */
const categoryDeleteQuerySchema = z.object({
  mode: z.enum(['archive', 'permanent']).default('archive'),
});

@Controller()
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get(ROUTES.categories.list())
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(zodPipe(categoryListQuerySchema)) query: z.infer<typeof categoryListQuerySchema>,
  ): Promise<CategoryResponse[]> {
    return this.categories.list(user, query);
  }

  @Post(ROUTES.categories.create())
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(zodPipe(createCategorySchema)) body: z.infer<typeof createCategorySchema>,
    @ClientIp() ip: string | null,
  ): Promise<CategoryResponse> {
    return this.categories.create(user, body, ip);
  }

  @Patch(ROUTES.categories.update(':id'))
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') categoryId: string,
    @Body(zodPipe(updateCategorySchema)) body: z.infer<typeof updateCategorySchema>,
    @ClientIp() ip: string | null,
  ): Promise<CategoryResponse> {
    return this.categories.update(user, categoryId, body, ip);
  }

  @HttpCode(204)
  @Delete(ROUTES.categories.archive(':id'))
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') categoryId: string,
    @Query(zodPipe(categoryDeleteQuerySchema)) query: z.infer<typeof categoryDeleteQuerySchema>,
    @ClientIp() ip: string | null,
  ): Promise<void> {
    return this.categories.remove(user, categoryId, query.mode, ip);
  }
}
