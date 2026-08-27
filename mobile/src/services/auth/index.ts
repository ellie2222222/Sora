/**
 * The app's one session instance.
 *
 * The refresh call goes out on a bare axios instance, not the intercepted client
 * in services/api/client.ts: a 401 from the refresh endpoint must surface as a
 * failed refresh, and routing it through the interceptor that reacts to 401 by
 * refreshing would make that recursive.
 */

import axios from 'axios';
import { API_PREFIX, ROUTES, apiUrl, type ApiEnvelope, type AuthTokens } from '@sora/contracts';

import { env } from '../../app/config/env.ts';
import { SESSION_STORAGE_KEY, secureStore } from '../storage/secureStore.ts';
import { SessionManager, type SessionPersistence, type StoredSession } from './session.ts';

function isStoredSession(value: unknown): value is StoredSession {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<StoredSession>;
  return (
    typeof candidate.accessToken === 'string' &&
    typeof candidate.refreshToken === 'string' &&
    typeof candidate.expiresAt === 'number'
  );
}

const persistence: SessionPersistence = {
  async load() {
    const raw = await secureStore.get(SESSION_STORAGE_KEY);
    if (raw === null) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      return isStoredSession(parsed) ? parsed : null;
    } catch {
      return null;
    }
  },
  async save(session) {
    await secureStore.set(SESSION_STORAGE_KEY, JSON.stringify(session));
  },
  async clear() {
    await secureStore.remove(SESSION_STORAGE_KEY);
  },
};

const refreshClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: env.requestTimeoutMs,
});

export const session = new SessionManager({
  persistence,
  async refresh(refreshToken) {
    const response = await refreshClient.post<ApiEnvelope<AuthTokens>>(
      apiUrl(ROUTES.auth.refresh()),
      { refreshToken },
    );
    return response.data.data;
  },
});

/** Paths the 401 interceptor must never retry — see the note above. */
export const AUTH_PATHS_WITHOUT_RETRY: readonly string[] = [
  `${API_PREFIX}${ROUTES.auth.refresh()}`,
  `${API_PREFIX}${ROUTES.auth.login()}`,
  `${API_PREFIX}${ROUTES.auth.register()}`,
];

export * from './session.ts';
