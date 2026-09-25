import {
  ROUTES,
  apiUrl,
  type ContributionResponse,
  type CreateContributionRequest,
  type CreateGoalRequest,
  type GoalResponse,
  type GoalStatus,
  type UpdateGoalRequest,
} from '@sora/contracts';

import { deleteVoid, getList, getOne, idempotencyHeaders, patchOne, postOne, type ListResult, type PageQuery } from './client.ts';

export interface GoalListQuery {
  walletId: string;
  status?: GoalStatus | undefined;
}

export const goalsApi = {
  async list(query: GoalListQuery): Promise<GoalResponse[]> {
    const { items } = await getList<GoalResponse>(apiUrl(ROUTES.goals.list()), query);
    return items;
  },

  detail(goalId: string): Promise<GoalResponse> {
    return getOne<GoalResponse>(apiUrl(ROUTES.goals.detail(goalId)));
  },

  create(body: CreateGoalRequest, idempotencyKey?: string): Promise<GoalResponse> {
    return postOne<GoalResponse>(apiUrl(ROUTES.goals.create()), body, idempotencyHeaders(idempotencyKey));
  },

  update(goalId: string, body: UpdateGoalRequest, idempotencyKey?: string): Promise<GoalResponse> {
    return patchOne<GoalResponse>(apiUrl(ROUTES.goals.update(goalId)), body, idempotencyHeaders(idempotencyKey));
  },

  /** Cancels the goal; contributions are retained, as they record real money. */
  cancel(goalId: string, idempotencyKey?: string): Promise<void> {
    return deleteVoid(apiUrl(ROUTES.goals.archive(goalId)), undefined, idempotencyHeaders(idempotencyKey));
  },

  contributions(goalId: string, page: PageQuery): Promise<ListResult<ContributionResponse>> {
    return getList<ContributionResponse>(apiUrl(ROUTES.goals.contributions(goalId)), page);
  },

  /**
   * Idempotency-keyed for the same reason a transaction create is: with
   * `recordAsTransaction` set, this moves real money out of an account.
   *
   * `idempotencyKey` lets a caller pin its own key (guest-mode upload) instead
   * of a fresh one per call; every other caller omits it.
   */
  addContribution(
    goalId: string,
    body: CreateContributionRequest,
    idempotencyKey?: string,
  ): Promise<ContributionResponse> {
    return postOne<ContributionResponse>(
      apiUrl(ROUTES.goals.contributions(goalId)),
      body,
      idempotencyHeaders(idempotencyKey),
    );
  },

  removeContribution(goalId: string, contributionId: string): Promise<void> {
    return deleteVoid(apiUrl(ROUTES.goals.contribution(goalId, contributionId)));
  },
};
