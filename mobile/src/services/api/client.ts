/**
 * The HTTP client.
 *
 * Two interceptors, and both are load-bearing: the request one attaches the
 * bearer token from the single session instance rather than from a copy held in
 * React state (which would be stale for any request fired during a refresh), and
 * the response one turns every failure into an `ApiError` carrying the server's
 * own `code` and `message`, so no screen has to inspect an axios error shape.
 */

import axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import { HTTP_STATUS, type ApiEnvelope, type PaginationMeta } from '@sora/contracts';

import { env } from '../../app/config/env.ts';
import { toApiError } from '../../utils/errors.ts';
import { AUTH_PATHS_WITHOUT_RETRY, session } from '../auth/index.ts';

interface RetryableConfig extends InternalAxiosRequestConfig {
  /** Set once a request has already been replayed after a refresh. */
  retriedAfterRefresh?: boolean;
}

export const http = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: env.requestTimeoutMs,
  headers: { 'Content-Type': 'application/json' },
});

http.interceptors.request.use((config) => {
  const token = session.getAccessToken();
  if (token !== null) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

function isRetryablePath(url: string | undefined): boolean {
  if (url === undefined) return false;
  return !AUTH_PATHS_WITHOUT_RETRY.some((path) => url.startsWith(path));
}

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetryableConfig | undefined;
    const status = error.response?.status;

    if (
      status === HTTP_STATUS.UNAUTHORIZED &&
      config !== undefined &&
      config.retriedAfterRefresh !== true &&
      isRetryablePath(config.url)
    ) {
      config.retriedAfterRefresh = true;
      const refreshed = await session.refreshTokens();
      if (refreshed !== null) {
        config.headers.set('Authorization', `Bearer ${refreshed.accessToken}`);
        return http.request(config);
      }
    }

    throw toApiError(status, error.response?.data, error.message);
  },
);

export interface ListResult<T> {
  items: T[];
  pagination: PaginationMeta | undefined;
}

/**
 * Every response is wrapped (API spec §2.1), so the unwrap happens once here
 * rather than at each of the fifty call sites.
 */
export async function getOne<T>(path: string, params?: unknown): Promise<T> {
  const response = await http.get<ApiEnvelope<T>>(path, { params });
  return response.data.data;
}

export async function getList<T>(path: string, params?: unknown): Promise<ListResult<T>> {
  const response = await http.get<ApiEnvelope<T[]>>(path, { params });
  return { items: response.data.data, pagination: response.data.meta?.pagination };
}

export async function postOne<T>(
  path: string,
  body?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  const response = await http.post<ApiEnvelope<T>>(path, body, config);
  return response.data.data;
}

export async function patchOne<T>(path: string, body?: unknown): Promise<T> {
  const response = await http.patch<ApiEnvelope<T>>(path, body);
  return response.data.data;
}

/** For the 204 endpoints — archive, revoke, logout — which carry no body. */
export async function postVoid(path: string, body?: unknown): Promise<void> {
  await http.post(path, body);
}

export async function deleteVoid(path: string, params?: unknown): Promise<void> {
  await http.delete(path, { params });
}

/**
 * An idempotency key for creates (API spec §2.10). It only has to be unique per
 * attempt, not unguessable, so a timestamp plus randomness is sufficient and
 * avoids pulling in a crypto dependency for it.
 */
export function idempotencyHeaders(): AxiosRequestConfig {
  const key = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return { headers: { 'Idempotency-Key': key } };
}
