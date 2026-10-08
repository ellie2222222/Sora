// The seed's own HTTP client: bearer per persona, one refresh on a 401, Accept-Language per persona,
// an Idempotency-Key per create so a retried network failure can never record money twice.

import { randomUUID } from 'node:crypto';

import { API_PREFIX } from '@sora/contracts';

import type { ApiResponse } from '../../server/test/support/probe-data.ts';
import type { PersonaKey } from './personas.ts';

export interface Session {
  persona: PersonaKey;
  userId: string;
  email: string;
  password: string;
  locale: string;
  accessToken: string;
  refreshToken: string;
}

/** Shaped like the app's own (`isApiError`), so app code driven from here can branch on `code`. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly fields: Record<string, string[]>;
  constructor(method: string, path: string, response: ApiResponse) {
    const error = response.body?.error;
    super(`${method} ${path} → ${response.status} ${error?.code ?? ''} ${response.body?.message ?? ''}${error?.fields ? ` ${JSON.stringify(error.fields)}` : ''}`.trim());
    this.status = response.status;
    this.code = error?.code;
    this.fields = error?.fields ?? {};
  }
}

interface CallOptions {
  body?: unknown;
  session?: Session;
  /** Statuses that count as success; anything else throws ApiError. */
  expect?: number[];
  /** A caller's own key, pinned across its retries; a POST gets a fresh one otherwise. */
  idempotencyKey?: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class SeedApi {
  private readonly refreshing = new Map<PersonaKey, Promise<void>>();
  requests = 0;
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  get apiBase(): string {
    return `${this.baseUrl}${API_PREFIX}`;
  }

  async call<T = any>(method: string, path: string, options: CallOptions = {}): Promise<T> {
    const response = await this.raw<T>(method, path, options);
    const expected = options.expect ?? [200, 201, 204];
    if (!expected.includes(response.status)) throw new ApiError(method, path, response);
    return response.body?.data as T;
  }

  /** Every page of a list endpoint (API-05 caps a page at 200). */
  async all<T = any>(path: string, session: Session): Promise<T[]> {
    const items: T[] = [];
    for (let page = 1; ; page++) {
      const response = await this.raw<T[]>('GET', `${path}${path.includes('?') ? '&' : '?'}page=${page}&pageSize=200`, { session });
      if (response.status !== 200) throw new ApiError('GET', path, response);
      items.push(...(response.body!.data as T[]));
      if (!response.body!.meta?.pagination?.hasMore) return items;
    }
  }

  async raw<T = any>(method: string, path: string, options: CallOptions = {}): Promise<ApiResponse<T>> {
    const idempotencyKey = options.idempotencyKey ?? (method === 'POST' ? randomUUID() : undefined);
    for (let attempt = 0; ; attempt++) {
      let response: ApiResponse<T>;
      try {
        response = await this.send<T>(method, path, options, idempotencyKey);
      } catch (error) {
        // Only a request that never got an answer is retried, under the same key.
        if (attempt < 3) {
          await sleep(500 * (attempt + 1));
          continue;
        }
        throw error;
      }
      if (response.status === 401 && options.session && attempt === 0 && response.body?.error?.code === 'TOKEN_EXPIRED') {
        await this.refresh(options.session);
        continue;
      }
      if (response.status === 429 && attempt < 2) {
        const wait = Number(response.headers['retry-after'] ?? 60);
        console.log(`  rate limited on ${path}; waiting ${wait}s`);
        await sleep(wait * 1000);
        continue;
      }
      return response;
    }
  }

  private async send<T>(method: string, path: string, options: CallOptions, idempotencyKey: string | undefined): Promise<ApiResponse<T>> {
    this.requests++;
    const session = options.session;
    const response = await fetch(`${this.apiBase}${path}`, {
      method,
      headers: {
        ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(session ? { authorization: `Bearer ${session.accessToken}`, 'accept-language': session.locale } : {}),
        ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const text = await response.text();
    return { status: response.status, headers: Object.fromEntries(response.headers), body: text ? JSON.parse(text) : null };
  }

  /** Refresh tokens are single-use and a replay revokes the whole family, so one refresh per persona at a time. */
  private refresh(session: Session): Promise<void> {
    let pending = this.refreshing.get(session.persona);
    if (!pending) {
      pending = (async () => {
        const tokens = await this.call<{ accessToken: string; refreshToken: string }>('POST', '/auth/refresh', { body: { refreshToken: session.refreshToken } });
        session.accessToken = tokens.accessToken;
        session.refreshToken = tokens.refreshToken;
      })().finally(() => this.refreshing.delete(session.persona));
      this.refreshing.set(session.persona, pending);
    }
    return pending;
  }
}
