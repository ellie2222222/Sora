/**
 * What the HTTP client does with a failed response: on a 401, refresh once and replay the
 * request, otherwise surface the failure as an `ApiError`.
 *
 * Kept free of axios, the session singleton and `@/` imports, so the decision runs under the
 * plain `node --test` runner; `client.ts` supplies the real dependencies.
 */

import { HTTP_STATUS } from '@sora/contracts';

export interface RetryableRequest {
  url?: string;
  /** Set once a request has already been replayed after a refresh, so it never loops. */
  retriedAfterRefresh?: boolean;
}

export interface FailedResponse<Request extends RetryableRequest> {
  config?: Request;
  response?: { status: number; data?: unknown };
  message: string;
}

export interface RefreshRetryDeps<Request extends RetryableRequest> {
  /** Paths whose 401 means bad credentials, not an expired token (login, refresh itself). */
  pathsWithoutRetry: readonly string[];
  refreshTokens(): Promise<{ accessToken: string } | null>;
  /** Whether a session survived a failed refresh (it does when the server never answered). */
  hasSession(): boolean;
  replay(request: Request, accessToken: string): Promise<unknown>;
  toError(status: number | undefined, data: unknown, message: string): Error;
}

export async function handleFailedResponse<Request extends RetryableRequest>(
  error: FailedResponse<Request>,
  deps: RefreshRetryDeps<Request>,
): Promise<unknown> {
  const { config } = error;
  const status = error.response?.status;

  if (
    status === HTTP_STATUS.UNAUTHORIZED &&
    config !== undefined &&
    config.retriedAfterRefresh !== true &&
    config.url !== undefined &&
    !deps.pathsWithoutRetry.some((path) => config.url!.startsWith(path))
  ) {
    config.retriedAfterRefresh = true;
    const refreshed = await deps.refreshTokens();
    if (refreshed !== null) return deps.replay(config, refreshed.accessToken);
    // The refresh failed without the server rejecting the token, so the session was
    // kept: report "no connection", not a 401 that callers would answer with sign-out.
    if (deps.hasSession()) throw deps.toError(undefined, undefined, error.message);
  }

  throw deps.toError(status, error.response?.data, error.message);
}
