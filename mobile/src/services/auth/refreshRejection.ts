import axios from 'axios';
import { HTTP_STATUS } from '@sora/contracts';

// Relative, not `@/utils`: the refresh tests run under bare `node --test`, which has no path aliases.
import { isErrorBody } from '../../utils/errors.ts';

/**
 * A 4xx other than 429, carrying the API's error envelope, is the server refusing the token; anything
 * else may succeed on retry. Without the envelope the 4xx came from a tunnel or proxy (an offline
 * tunnel answers 404), and signing out over it would end a valid session during an outage.
 */
export function isRefreshRejection(error: unknown): boolean {
  if (!axios.isAxiosError(error) || error.response === undefined) return false;
  const { status, data } = error.response;
  return status >= 400 && status < 500 && status !== HTTP_STATUS.TOO_MANY_REQUESTS && isErrorBody(data);
}
