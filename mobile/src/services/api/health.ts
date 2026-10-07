import { ROUTES, apiUrl } from '@sora/contracts';

import { http } from './client.ts';

export const healthApi = {
  /** Whether the API answers and can reach its database — a `503` means it is up but cannot serve data. */
  async ping(): Promise<boolean> {
    try {
      await http.get(apiUrl(ROUTES.health()));
      return true;
    } catch {
      return false;
    }
  },
};
