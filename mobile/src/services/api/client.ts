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
import type { ApiEnvelope, PaginationMeta } from '@sora/contracts';

import { env } from '@/app/config';
import { toApiError } from '@/utils';
import { AUTH_PATHS_WITHOUT_RETRY, session } from '@/services/auth';
import { handleFailedResponse, type RetryableRequest } from './refreshRetry.ts';

interface RetryableConfig extends InternalAxiosRequestConfig, RetryableRequest {}

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

http.interceptors.response.use(
  (response) => response,
  (error: AxiosError) =>
    handleFailedResponse(
      { config: error.config as RetryableConfig | undefined, response: error.response, message: error.message },
      {
        pathsWithoutRetry: AUTH_PATHS_WITHOUT_RETRY,
        refreshTokens: () => session.refreshTokens(),
        hasSession: () => session.current() !== null,
        replay: (config, accessToken) => {
          config.headers.set('Authorization', `Bearer ${accessToken}`);
          return http.request(config);
        },
        toError: toApiError,
      },
    ),
);

export interface ListResult<T> {
  items: T[];
  pagination: PaginationMeta | undefined;
}

/** API-05 paging params for the list endpoints that honour them. */
export interface PageQuery {
  page: number;
  pageSize: number;
}

/**
 * Every response is wrapped (API spec §2.1), so the unwrap happens once here
 * rather than at each call site.
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

export async function patchOne<T>(path: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const response = await http.patch<ApiEnvelope<T>>(path, body, config);
  return response.data.data;
}

/** For the 204 endpoints — archive, revoke, logout — which carry no body. */
export async function postVoid(path: string, body?: unknown): Promise<void> {
  await http.post(path, body);
}

export async function deleteVoid(
  path: string,
  params?: unknown,
  config?: AxiosRequestConfig,
): Promise<void> {
  await http.delete(path, { ...config, params });
}

/**
 * An idempotency key for creates (API spec §2.10). It only has to be unique per
 * attempt, not unguessable, so a timestamp plus randomness is sufficient and
 * avoids pulling in a crypto dependency for it.
 *
 * `key` lets a caller pin its own value instead — the guest-mode upload
 * sequencer (`guestUpload.ts`) needs one key per local transaction/contribution
 * that stays stable across a retry, so a resumed upload after an app kill
 * never double-records the same money. Every other caller omits it and gets
 * the default fresh-per-attempt behaviour.
 */
export function idempotencyHeaders(key?: string): AxiosRequestConfig {
  const resolvedKey = key ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return { headers: { 'Idempotency-Key': resolvedKey } };
}
