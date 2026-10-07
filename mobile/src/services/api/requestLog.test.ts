import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { describeFailure, describeRequest, describeResponse, redactForLog } from './requestLog.ts';

describe('describeResponse', () => {
  it('shows the status', () => {
    assert.equal(describeResponse({ method: 'post', url: '/wallets' }, 201), '[api] ← 201 POST /wallets');
  });
});

describe('describeFailure', () => {
  it('shows the full URL tried and the reason when nothing came back', () => {
    assert.equal(
      describeFailure({
        config: { method: 'get', baseURL: 'http://localhost:3000', url: '/api/v1/health' },
        code: 'ERR_NETWORK',
        message: 'Network Error',
      }),
      '[api] ← network error GET http://localhost:3000/api/v1/health (ERR_NETWORK: Network Error)',
    );
    assert.equal(describeFailure({ config: { method: 'get', url: '/dashboard' } }), '[api] ← network error GET /dashboard');
  });

  it("shows the status and the server's message for an error response", () => {
    assert.equal(
      describeFailure({
        config: { method: 'post', url: '/wallets' },
        response: { status: 409, data: { success: false, message: 'Wallet name already used' } },
      }),
      '[api] ← 409 POST /wallets: Wallet name already used',
    );
    assert.equal(describeFailure({ config: { method: 'get', url: '/x' }, response: { status: 503 } }), '[api] ← 503 GET /x');
  });
});

describe('describeRequest', () => {
  it('shows the method, full URL, params and body', () => {
    assert.equal(
      describeRequest({ method: 'get', baseURL: 'http://192.168.1.5:3000', url: '/transactions', params: { page: 1 } }),
      '[api] GET http://192.168.1.5:3000/transactions params={"page":1}',
    );
    assert.equal(
      describeRequest({ method: 'post', url: '/wallets', data: { name: 'Cash', timeZone: 'Asia/Ho_Chi_Minh' } }),
      '[api] POST /wallets body={"name":"Cash","timeZone":"Asia/Ho_Chi_Minh"}',
    );
  });

  it('masks passwords and tokens at any depth', () => {
    const line = describeRequest({
      method: 'post',
      url: '/auth/register',
      data: { email: 'probe@example.invalid', password: 'hunter2hunter2', nested: [{ refreshToken: 'r', idToken: 'i' }] },
    });
    assert.ok(!line.includes('hunter2'));
    assert.deepEqual(redactForLog({ nested: [{ refreshToken: 'r', idToken: 'i' }], token: 't' }), {
      nested: [{ refreshToken: '[redacted]', idToken: '[redacted]' }],
      token: '[redacted]',
    });
  });

  it('names a non-plain body instead of dumping it', () => {
    assert.equal(redactForLog(new Map()), '[Map]');
  });
});
