import {
  ROUTES,
  apiUrl,
  type DashboardQuery,
  type DashboardResponse,
} from '@sora/contracts';

import { getOne } from './client.ts';

/**
 * One request for the whole home screen.
 *
 * The alternative — a query per tile — would show the balance, the income total
 * and the category split as they each arrived, letting the user read figures
 * computed from different moments as if they reconciled.
 */
export const dashboardApi = {
  summary(query: DashboardQuery): Promise<DashboardResponse> {
    return getOne<DashboardResponse>(apiUrl(ROUTES.dashboard.summary()), query);
  },
};
