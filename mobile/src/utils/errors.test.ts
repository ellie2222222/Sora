import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { ApiError, isNetworkError, toApiError } from './errors.ts';

describe('isNetworkError', () => {
  it('treats a transport failure as offline', () => {
    assert.equal(isNetworkError(toApiError(undefined, undefined)), true);
    assert.equal(isNetworkError({ code: 'ERR_NETWORK', message: 'Network Error' }), true);
    assert.equal(isNetworkError({ code: 'ECONNABORTED', message: 'timeout of 15000ms exceeded' }), true);
    assert.equal(isNetworkError({ status: 'FETCH_ERROR' }), true);
    assert.equal(isNetworkError(new TypeError('Network request failed')), true);
    assert.equal(isNetworkError(new TypeError('Failed to fetch')), true);
  });

  it('never treats a server response as offline, whatever its message says', () => {
    assert.equal(isNetworkError(new ApiError('INTERNAL_ERROR', 'Could not fetch exchange rates', 500)), false);
    assert.equal(isNetworkError(new ApiError('VALIDATION_FAILED', 'Bank connection name is required', 422)), false);
    assert.equal(isNetworkError({ message: 'Network timeout upstream', response: { status: 502 } }), false);
  });

  it('does not match unrelated errors on a loose word like "fetch" or "connection"', () => {
    assert.equal(isNetworkError(new Error('prefetch cache miss')), false);
    assert.equal(isNetworkError(new Error('connection pool exhausted in reducer')), false);
    assert.equal(isNetworkError(null), false);
    assert.equal(isNetworkError(42), false);
  });
});
