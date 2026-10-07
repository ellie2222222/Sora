import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import { API_PREFIX, STARTER_CATEGORIES } from '@sora/contracts';

import { integrationSkipReason, registerProbeUser, startTestApi, type TestApi } from './support/integration.ts';

describe('auth against a real database', { skip: integrationSkipReason() }, () => {
  let api: TestApi;

  before(async () => {
    api = await startTestApi();
  });

  after(async () => {
    await api?.close();
  });

  it('registers a user with an owned personal wallet seeded with every starter category and an audit row', async () => {
    const user = await registerProbeUser(api, 'register');

    const [membership] = await api.sql<{ role: string; status: string }>(
      'SELECT role, status FROM wallet_members WHERE wallet_id = $1 AND user_id = $2',
      [user.walletId, user.id],
    );
    assert.deepEqual(membership, { role: 'OWNER', status: 'ACTIVE' });

    const seeded = new Set(
      (await api.sql<{ system_key: string; name: string }>('SELECT system_key, name FROM categories WHERE wallet_id = $1', [user.walletId]))
        .map((row) => `${row.system_key}|${row.name}`),
    );
    assert.deepEqual(STARTER_CATEGORIES.filter((category) => !seeded.has(`${category.key}|${category.names.en}`)), []);

    const audit = await api.sql('SELECT 1 FROM audit_logs WHERE actor_id = $1 AND event = $2', [user.id, 'USER_REGISTERED']);
    assert.equal(audit.length, 1);
  });

  it('names the default wallet and Cash account in the language chosen at sign-up', async () => {
    const email = `probe+register-vi-${randomUUID()}@example.invalid`;
    const registered = await api.call('POST', '/auth/register', {
      body: { email, password: `probe-pw-${randomUUID()}`, displayName: 'An', timeZone: 'Asia/Ho_Chi_Minh', locale: 'vi' },
    });
    assert.equal(registered.status, 201);
    const userId = registered.body!.data.user.id as string;
    assert.equal(registered.body!.data.user.locale, 'vi');

    const [wallet] = await api.sql<{ id: string; name: string }>('SELECT id, name FROM wallets WHERE owner_user_id = $1', [userId]);
    assert.equal(wallet?.name, 'Ví của An');
    assert.deepEqual(await api.sql('SELECT name FROM accounts WHERE wallet_id = $1', [wallet!.id]), [{ name: 'Tiền mặt' }]);
  });

  it('refuses a second registration for the same address in another case', async () => {
    const user = await registerProbeUser(api, 'dupe');
    const again = await api.call('POST', '/auth/register', {
      body: { email: user.email.toUpperCase(), password: user.password, displayName: 'probe-dupe-2', timeZone: 'Asia/Ho_Chi_Minh' },
    });
    assert.equal(again.status, 409);
    assert.equal(again.body?.error?.code, 'EMAIL_ALREADY_REGISTERED');
  });

  it('answers an unknown email and a wrong password identically, so login cannot enumerate accounts', async () => {
    const user = await registerProbeUser(api, 'enum');
    const wrongPassword = await api.call('POST', '/auth/login', { body: { email: user.email, password: 'not-the-password-123' } });
    const unknownEmail = await api.call('POST', '/auth/login', {
      body: { email: `probe+nobody-${randomUUID()}@example.invalid`, password: 'not-the-password-123' },
    });
    assert.equal(wrongPassword.status, 401);
    assert.equal(unknownEmail.status, 401);
    assert.equal(wrongPassword.body?.error?.code, 'CREDENTIALS_INVALID');
    assert.deepEqual(
      { code: unknownEmail.body?.error?.code, message: unknownEmail.body?.message },
      { code: wrongPassword.body?.error?.code, message: wrongPassword.body?.message },
    );
  });

  it('locks an email after 5 failures, even for the right password, and says when to retry (spec §2.9)', async () => {
    const user = await registerProbeUser(api, 'lockout');
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const failed = await api.call('POST', '/auth/login', { body: { email: user.email, password: 'wrong-password-123' } });
      assert.equal(failed.status, 401);
    }
    const locked = await api.call('POST', '/auth/login', { body: { email: user.email, password: user.password } });
    assert.equal(locked.status, 429);
    assert.equal(locked.body?.error?.code, 'RATE_LIMITED');
    assert.ok(Number(locked.headers['retry-after']) > 0, `Retry-After was ${String(locked.headers['retry-after'])}`);
  });

  it('rotates a refresh token, and a replay of the old one revokes the whole family', async () => {
    const user = await registerProbeUser(api, 'replay');
    const rotated = await api.call('POST', '/auth/refresh', { body: { refreshToken: user.refreshToken } });
    assert.equal(rotated.status, 200);
    const next = rotated.body!.data.refreshToken as string;
    assert.notEqual(next, user.refreshToken);

    const replay = await api.call('POST', '/auth/refresh', { body: { refreshToken: user.refreshToken } });
    assert.equal(replay.status, 401);
    const afterReplay = await api.call('POST', '/auth/refresh', { body: { refreshToken: next } });
    assert.equal(afterReplay.status, 401, 'a replay must end every session of that user');

    // Both presentations after the first are replays: the old token, then the newer one the family revoke killed.
    const audit = await api.sql('SELECT result FROM audit_logs WHERE actor_id = $1 AND event = $2', [user.id, 'TOKEN_REPLAY_DETECTED']);
    assert.deepEqual(audit, [{ result: 'DENIED' }, { result: 'DENIED' }]);
  });

  it('lets exactly one of ten concurrent refreshes of one token win', async () => {
    const user = await registerProbeUser(api, 'burst');
    const results = await Promise.all(
      Array.from({ length: 10 }, () => api.call('POST', '/auth/refresh', { body: { refreshToken: user.refreshToken } })),
    );
    assert.equal(results.filter((result) => result.status === 200).length, 1);
    assert.equal(results.filter((result) => result.status === 401).length, 9);
  });

  it('revokes only the presented refresh token on logout', async () => {
    const user = await registerProbeUser(api, 'logout');
    const second = await api.call('POST', '/auth/login', { body: { email: user.email, password: user.password } });
    const otherSession = second.body!.data.tokens.refreshToken as string;

    const logout = await api.call('POST', '/auth/logout', { token: user.token, body: { refreshToken: user.refreshToken } });
    assert.equal(logout.status, 204);
    // The other session first: presenting the logged-out token is a replay, which ends every session by design.
    assert.equal((await api.call('POST', '/auth/refresh', { body: { refreshToken: otherSession } })).status, 200);
    assert.equal((await api.call('POST', '/auth/refresh', { body: { refreshToken: user.refreshToken } })).status, 401);
  });

  it('refuses every mounted route without a bearer token, except the few that are public by design', async () => {
    // A guard missing from a new controller is the defect this catches, so the list is read off
    // the running app rather than written down here.
    const PUBLIC = new Set([
      `GET ${API_PREFIX}/health`,
      `POST ${API_PREFIX}/auth/register`,
      `POST ${API_PREFIX}/auth/login`,
      `POST ${API_PREFIX}/auth/google`,
      `POST ${API_PREFIX}/auth/refresh`,
      `POST ${API_PREFIX}/invitations/preview`,
    ]);
    const router = (api.app.getHttpAdapter().getInstance() as { router: { stack: { route?: { path: string; methods: Record<string, boolean> } }[] } }).router;
    const routes = router.stack.flatMap((layer) =>
      layer.route ? Object.keys(layer.route.methods).map((method) => `${method.toUpperCase()} ${layer.route!.path}`) : [],
    );
    assert.ok(routes.length > 40, `read only ${routes.length} routes off the router`);

    const unguarded: string[] = [];
    for (const route of routes.filter((candidate) => !PUBLIC.has(candidate))) {
      const [method, path] = route.split(' ') as [string, string];
      const concrete = path.slice(API_PREFIX.length).replace(/:[A-Za-z]+/g, randomUUID());
      const response = await api.call(method, concrete, method === 'GET' ? {} : { body: {} });
      if (response.status !== 401) unguarded.push(`${route} → ${response.status}`);
    }
    assert.deepEqual(unguarded, []);
  });
});
