import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';

import { isRefreshRejection } from './refreshRejection.ts';

function withStatus(status: number): AxiosError {
  const config = { headers: new AxiosHeaders() };
  const response = { status, statusText: '', headers: {}, config, data: {} } as AxiosResponse;
  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, undefined, response);
}

describe('isRefreshRejection', () => {
  it('treats the server refusing the token as a rejection', () => {
    assert.equal(isRefreshRejection(withStatus(401)), true);
    assert.equal(isRefreshRejection(withStatus(422)), true);
  });

  it('keeps the session for no response, rate limiting and server faults', () => {
    assert.equal(isRefreshRejection(new AxiosError('Network Error', 'ERR_NETWORK')), false);
    assert.equal(isRefreshRejection(withStatus(429)), false);
    assert.equal(isRefreshRejection(withStatus(503)), false);
    assert.equal(isRefreshRejection(new Error('not axios')), false);
  });
});
