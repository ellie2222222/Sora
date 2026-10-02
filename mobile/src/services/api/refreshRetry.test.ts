import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { handleFailedResponse, type FailedResponse, type RefreshRetryDeps, type RetryableRequest } from './refreshRetry.ts';

class FakeApiError extends Error {
  readonly status: number | undefined;

  constructor(status: number | undefined, message: string) {
    super(message);
    this.status = status;
  }
}

function depsWith(overrides: Partial<RefreshRetryDeps<RetryableRequest>> = {}) {
  const calls = { refreshes: 0, replays: [] as { url?: string; token: string }[] };
  const deps: RefreshRetryDeps<RetryableRequest> = {
    pathsWithoutRetry: ['/api/v1/auth/login', '/api/v1/auth/refresh'],
    refreshTokens: async () => {
      calls.refreshes += 1;
      return { accessToken: 'fresh-token' };
    },
    hasSession: () => true,
    replay: async (request, token) => {
      calls.replays.push({ url: request.url, token });
      return 'replayed';
    },
    toError: (status, _data, message) => new FakeApiError(status, message),
    ...overrides,
  };
  return { deps, calls };
}

const unauthorized = (url = '/api/v1/wallets', extra: Partial<RetryableRequest> = {}): FailedResponse<RetryableRequest> => ({
  config: { url, ...extra },
  response: { status: 401 },
  message: 'Request failed with status code 401',
});

describe('handleFailedResponse — AUTH-US-03', () => {
  it('refreshes once and replays the request with the new token', async () => {
    const { deps, calls } = depsWith();
    assert.equal(await handleFailedResponse(unauthorized(), deps), 'replayed');
    assert.deepEqual([calls.refreshes, calls.replays], [1, [{ url: '/api/v1/wallets', token: 'fresh-token' }]]);
  });

  it('never replays a request twice, so a second 401 surfaces instead of looping', async () => {
    const { deps, calls } = depsWith();
    await assert.rejects(handleFailedResponse(unauthorized('/api/v1/wallets', { retriedAfterRefresh: true }), deps), FakeApiError);
    assert.equal(calls.refreshes, 0);
  });

  it('does not refresh for a 401 from login or refresh, where it means bad credentials', async () => {
    const { deps, calls } = depsWith();
    for (const url of ['/api/v1/auth/login', '/api/v1/auth/refresh']) {
      await assert.rejects(handleFailedResponse(unauthorized(url), deps), (error: FakeApiError) => error.status === 401);
    }
    assert.equal(calls.refreshes, 0);
  });

  it('reports "no connection" (no status) when the refresh failed but the session was kept', async () => {
    const { deps } = depsWith({ refreshTokens: async () => null, hasSession: () => true });
    await assert.rejects(handleFailedResponse(unauthorized(), deps), (error: FakeApiError) => error.status === undefined);
  });

  it('surfaces the 401 when the server refused the refresh and the session is gone, so the app signs out', async () => {
    const { deps } = depsWith({ refreshTokens: async () => null, hasSession: () => false });
    await assert.rejects(handleFailedResponse(unauthorized(), deps), (error: FakeApiError) => error.status === 401);
  });

  it('passes any other failure straight through with its status', async () => {
    const { deps, calls } = depsWith();
    await assert.rejects(
      handleFailedResponse({ config: { url: '/api/v1/wallets' }, response: { status: 409 }, message: 'conflict' }, deps),
      (error: FakeApiError) => error.status === 409,
    );
    assert.equal(calls.refreshes, 0);
  });
});
