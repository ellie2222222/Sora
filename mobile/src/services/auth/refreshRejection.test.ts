import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';

import { isRefreshRejection } from './refreshRejection.ts';

function withStatus(status: number, data: unknown = { error: { code: 'TOKEN_INVALID' } }): AxiosError {
  const config = { headers: new AxiosHeaders() };
  const response = { status, statusText: '', headers: {}, config, data } as AxiosResponse;
  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, undefined, response);
}

describe('isRefreshRejection', () => {
  it('treats the server refusing the token as a rejection', () => {
    assert.equal(isRefreshRejection(withStatus(401)), true);
    assert.equal(isRefreshRejection(withStatus(422, { error: { code: 'VALIDATION_FAILED' } })), true);
  });

  it('keeps the session for no response, rate limiting and server faults', () => {
    assert.equal(isRefreshRejection(new AxiosError('Network Error', 'ERR_NETWORK')), false);
    assert.equal(isRefreshRejection(withStatus(429)), false);
    assert.equal(isRefreshRejection(withStatus(503)), false);
    assert.equal(isRefreshRejection(new Error('not axios')), false);
  });

  it('keeps the session for a 4xx the API did not send, such as an offline tunnel', () => {
    assert.equal(isRefreshRejection(withStatus(404, '<html>ERR_NGROK_3200 endpoint offline</html>')), false);
    assert.equal(isRefreshRejection(withStatus(401, '')), false);
    assert.equal(isRefreshRejection(withStatus(400, { message: 'no code' })), false);
  });
});
