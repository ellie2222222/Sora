import axios from 'axios';
import { HTTP_STATUS } from '@sora/contracts';

/** A 4xx other than 429 is the server refusing the token; anything else may succeed on retry. */
export function isRefreshRejection(error: unknown): boolean {
  if (!axios.isAxiosError(error) || error.response === undefined) return false;
  const { status } = error.response;
  return status >= 400 && status < 500 && status !== HTTP_STATUS.TOO_MANY_REQUESTS;
}
