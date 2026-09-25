import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import type { ApiErrorBody } from '@sora/contracts';

import {
  ApiError,
  NETWORK_ERROR_MESSAGE,
  UNKNOWN_ERROR_MESSAGE,
  getServerErrorMessage,
  isApiError,
  isNetworkError,
  isUnauthenticated,
  issueMessagesByPath,
  messageOf,
  serializeApiError,
  toApiError,
  type TranslationFunction,
} from './errors.ts';

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

describe('issueMessagesByPath', () => {
  it('keys each field by its dotted path and keeps the first message per field', () => {
    assert.deepEqual(
      issueMessagesByPath([
        { path: ['amount'], message: 'Required' },
        { path: ['amount'], message: 'Must be positive' },
        { path: ['body', 0, 'name'], message: 'Too long' },
      ]),
      { amount: 'Required', 'body.0.name': 'Too long' },
    );
  });
});

describe('toApiError', () => {
  const envelope: ApiErrorBody = {
    success: false,
    message: 'Budget amount must be positive',
    error: {
      code: 'VALIDATION_FAILED',
      fields: { amount: ['Must be positive'] },
      params: { field: 'amount' },
    },
    meta: { timestamp: '2026-09-25T00:00:00.000Z' },
  };

  it("keeps the server envelope's code, message, fields, params and status", () => {
    const error = toApiError(422, envelope);

    assert.equal(error.code, 'VALIDATION_FAILED');
    assert.equal(error.message, 'Budget amount must be positive');
    assert.equal(error.status, 422);
    assert.deepEqual(error.fields, { amount: ['Must be positive'] });
    assert.deepEqual(error.params, { field: 'amount' });
  });

  it('falls back to the contract status for the code when no status arrived with the body', () => {
    assert.equal(toApiError(undefined, envelope).status, 422);
  });

  it('keeps the real status of a non-JSON response, so it is not mistaken for offline', () => {
    const error = toApiError(502, '<html>Bad Gateway</html>', 'Request failed with status code 502');

    assert.equal(error.code, 'INTERNAL_ERROR');
    assert.equal(error.status, 502);
    assert.equal(error.message, 'Request failed with status code 502');
    assert.equal(isNetworkError(error), false);
  });

  it('uses the generic messages when the transport supplied none', () => {
    assert.equal(toApiError(500, null).message, UNKNOWN_ERROR_MESSAGE);
    assert.equal(toApiError(undefined, undefined).message, NETWORK_ERROR_MESSAGE);
  });

  it('does not accept a body whose error code is not a string as a server envelope', () => {
    assert.equal(toApiError(400, { message: 'nope', error: { code: 42 } }).code, 'INTERNAL_ERROR');
  });
});

describe('isNetworkError — RTK Query and axios shapes', () => {
  it('classifies RTK fetch and timeout errors and axios aborts as offline', () => {
    assert.equal(isNetworkError({ status: 'FETCH_ERROR', error: 'TypeError: Network request failed' }), true);
    assert.equal(isNetworkError({ status: 'TIMEOUT_ERROR', error: 'AbortError: signal timed out' }), true);
    assert.equal(isNetworkError({ code: 'ECONNABORTED', message: 'timeout of 15000ms exceeded' }), true);
    assert.equal(isNetworkError({ code: 'ETIMEDOUT' }), true);
    assert.equal(isNetworkError({ status: 0 }), true);
  });

  it('treats an unparseable response body as a server response, not an outage', () => {
    assert.equal(
      isNetworkError({ status: 'PARSING_ERROR', originalStatus: 502, error: 'SyntaxError: Unexpected token <' }),
      false,
    );
  });
});

describe('serializeApiError', () => {
  it('produces a plain object that still reads as an ApiError', () => {
    const serialized = serializeApiError(
      new ApiError('WALLET_NOT_FOUND', 'Wallet not found', 404, {}, { walletId: 'w-1' }),
    );

    assert.equal(serialized instanceof Error, false);
    assert.equal(Object.getPrototypeOf(serialized), Object.prototype);
    assert.equal(isApiError(serialized), true);
    assert.equal(serialized.code, 'WALLET_NOT_FOUND');
    assert.equal(serialized.message, 'Wallet not found');
    assert.equal(serialized.status, 404);
    assert.deepEqual(serialized.params, { walletId: 'w-1' });
  });

  it('keeps a transport failure classified as offline after serialization', () => {
    assert.equal(isNetworkError(serializeApiError(toApiError(undefined, undefined))), true);
  });

  it('rejects objects missing or mistyping any ApiError field', () => {
    assert.equal(isApiError({ code: 'FORBIDDEN', message: 'x', status: 403 }), false);
    assert.equal(isApiError({ code: 'FORBIDDEN', message: 'x', status: '403', fields: {} }), false);
    assert.equal(isApiError(new Error('plain')), false);
  });
});

describe('isUnauthenticated', () => {
  it('is true only for the codes that end a session', () => {
    assert.equal(isUnauthenticated(new ApiError('UNAUTHENTICATED', 'x')), true);
    assert.equal(isUnauthenticated(new ApiError('TOKEN_EXPIRED', 'x')), true);
    assert.equal(isUnauthenticated(new ApiError('TOKEN_INVALID', 'x')), true);
  });

  it('does not end the session for a wrong password, a role denial or a bare 401 shape', () => {
    assert.equal(isUnauthenticated(new ApiError('CREDENTIALS_INVALID', 'x')), false);
    assert.equal(isUnauthenticated(new ApiError('FORBIDDEN', 'x')), false);
    assert.equal(isUnauthenticated({ status: 401 }), false);
  });
});

describe('getServerErrorMessage and messageOf', () => {
  const calls: { key: string; options: Record<string, unknown> | undefined }[] = [];
  const t: TranslationFunction = (key, options) => {
    calls.push({ key, options });
    return `t:${key}`;
  };

  it('reports offline before anything the error itself says', () => {
    assert.equal(getServerErrorMessage(new ApiError('INTERNAL_ERROR', 'Server exploded', 0), t), 't:errors.offlineTitle');
  });

  it('translates the error code and passes its params through to t', () => {
    calls.length = 0;
    const error = new ApiError('CATEGORY_IN_USE', 'An active budget still references this category', 409, {}, { count: 2 });

    assert.equal(getServerErrorMessage(error, t), 't:errors.categoryInUse');
    assert.deepEqual(calls, [{ key: 'errors.categoryInUse', options: { count: 2 } }]);
  });

  it('falls back to the generic key for a code this build does not know, or a non-API error', () => {
    const fromNewerServer = { code: 'SOMETHING_NEW', message: 'x', status: 400, fields: {} };
    assert.equal(getServerErrorMessage(fromNewerServer, t), 't:errors.somethingWentWrong');
    assert.equal(getServerErrorMessage(new Error('boom'), t), 't:errors.somethingWentWrong');
  });

  it('routes through translation when given t', () => {
    assert.equal(messageOf(new ApiError('GOAL_NOT_FOUND', 'Goal not found'), t), 't:errors.goalNotFound');
  });

  it('uses the server message, then the error message, then the fallback, when given no t', () => {
    assert.equal(messageOf(new ApiError('GOAL_NOT_FOUND', 'Goal not found')), 'Goal not found');
    assert.equal(messageOf(new ApiError('GOAL_NOT_FOUND', ''), undefined, 'Try later'), 'Try later');
    assert.equal(messageOf(new Error('Disk full')), 'Disk full');
    assert.equal(messageOf('a string'), UNKNOWN_ERROR_MESSAGE);
  });
});
