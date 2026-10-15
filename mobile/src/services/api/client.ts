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
import { API_PREFIX, MAX_PAGE_SIZE, type ApiEnvelope, type PaginationMeta } from '@sora/contracts';

import { env } from '@/app/config';
import { toApiError } from '@/utils';
import { AUTH_PATHS_WITHOUT_RETRY, session } from '@/services/auth';
import { activeLocale } from '@/services/locale';
import { collectPages } from './collectPages.ts';
import { handleFailedResponse, type RetryableRequest } from './refreshRetry.ts';
import { describeFailure, describeRequest, describeResponse } from './requestLog.ts';
import { requestFingerprint, RetryKeys } from './retryKeys.ts';

interface RetryableConfig extends InternalAxiosRequestConfig, RetryableRequest {
  /** Set on a write whose Idempotency-Key `retryKeys` chose, so its answer can release the key. */
  idempotencyFingerprint?: string;
}

const WRITE_METHODS = new Set(['post', 'patch', 'put', 'delete']);
// Their bodies carry a password or a refresh token, which must not sit in memory as a fingerprint.
const AUTH_PATH_PREFIX = `${API_PREFIX}/auth/`;
const retryKeys = new RetryKeys();

/** A write with no caller-pinned key gets one that an identical retry of an unanswered attempt reuses. */
function assignIdempotencyKey(config: RetryableConfig): void {
  const method = config.method?.toLowerCase() ?? 'get';
  if (!WRITE_METHODS.has(method) || config.headers.has('Idempotency-Key')) return;
  if (config.url === undefined || config.url.startsWith(AUTH_PATH_PREFIX)) return;
  const fingerprint = requestFingerprint(method, config.url, config.data);
  config.idempotencyFingerprint = fingerprint;
  config.headers.set('Idempotency-Key', retryKeys.keyFor(fingerprint));
}

export const http = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: env.requestTimeoutMs,
  headers: { 'Content-Type': 'application/json' },
});

http.interceptors.request.use((config: RetryableConfig) => {
  assignIdempotencyKey(config);
  const token = session.getAccessToken();
  if (token !== null) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  // The API names starter categories in this language (API spec §2).
  config.headers.set('Accept-Language', activeLocale());
  if (__DEV__) console.log(describeRequest(config));
  return config;
});

http.interceptors.response.use(
  (response) => {
    if (__DEV__) console.log(describeResponse(response.config, response.status));
    const fingerprint = (response.config as RetryableConfig).idempotencyFingerprint;
    if (fingerprint !== undefined) retryKeys.answered(fingerprint);
    return response;
  },
  (error: AxiosError) => {
    if (__DEV__) console.log(describeFailure(error));
    // A 401 never ran the write: the refresh replays it under the same key, so the key stays held.
    const fingerprint = (error.config as RetryableConfig | undefined)?.idempotencyFingerprint;
    if (fingerprint !== undefined && error.response !== undefined && error.response.status !== 401) retryKeys.answered(fingerprint);
    return handleFailedResponse(
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
    );
  },
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

/** Every page of a paginated list, for screens that work on the whole set rather than scroll through it. */
export function getAll<T>(path: string, params: object): Promise<T[]> {
  return collectPages((page) => getList<T>(path, { ...params, page, pageSize: MAX_PAGE_SIZE }));
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
 * An Idempotency-Key a caller pins itself (API spec §2.10): the offline queue and the guest-mode
 * upload sequencer keep one per queued row or local record, stable across an app kill, so a resumed
 * send never double-records the same money. Without one, the request interceptor assigns a key that
 * an identical retry of an unanswered attempt reuses (`retryKeys.ts`).
 */
export function idempotencyHeaders(key?: string): AxiosRequestConfig {
  return key === undefined ? {} : { headers: { 'Idempotency-Key': key } };
}
