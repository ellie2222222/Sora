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

import { deleteVoid, getList, getOne, idempotencyHeaders, patchOne, postOne } from './client.ts';

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

  create(body: CreateGoalRequest): Promise<GoalResponse> {
    return postOne<GoalResponse>(apiUrl(ROUTES.goals.create()), body);
  },

  update(goalId: string, body: UpdateGoalRequest): Promise<GoalResponse> {
    return patchOne<GoalResponse>(apiUrl(ROUTES.goals.update(goalId)), body);
  },

  /** Cancels the goal; contributions are retained, as they record real money. */
  cancel(goalId: string): Promise<void> {
    return deleteVoid(apiUrl(ROUTES.goals.archive(goalId)));
  },

  async contributions(goalId: string): Promise<ContributionResponse[]> {
    const { items } = await getList<ContributionResponse>(
      apiUrl(ROUTES.goals.contributions(goalId)),
    );
    return items;
  },

  /**
   * Idempotency-keyed for the same reason a transaction create is: with
   * `recordAsTransaction` set, this moves real money out of an account.
   */
  addContribution(
    goalId: string,
    body: CreateContributionRequest,
  ): Promise<ContributionResponse> {
    return postOne<ContributionResponse>(
      apiUrl(ROUTES.goals.contributions(goalId)),
      body,
      idempotencyHeaders(),
    );
  },

  removeContribution(goalId: string, contributionId: string): Promise<void> {
    return deleteVoid(apiUrl(ROUTES.goals.contribution(goalId, contributionId)));
  },
};
