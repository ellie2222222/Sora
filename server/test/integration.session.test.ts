import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it, mock } from 'node:test';

import { STARTER_CATEGORIES } from '@sora/contracts';

import { AuthService } from '../src/auth/auth.service.ts';
import { TokenService } from '../src/auth/token.service.ts';
import { RateLimitService } from '../src/common/rate-limit.service.ts';
import { integrationSkipReason, registerProbeUser, startTestApi, type TestApi } from './support/integration.ts';

const SPEC_AUTH_LIMIT_PER_MINUTE = 10;
const EIGHT_DAYS_MS = 8 * 24 * 60 * 60 * 1000;

interface GooglePayload {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
}

type VerifyIdToken = (options: { idToken: string; audience: unknown }) => Promise<{ getPayload(): GooglePayload }>;

describe('session lifecycle against a real database', { skip: integrationSkipReason() }, () => {
  let api: TestApi;

  before(async () => {
    api = await startTestApi();
  });

  after(async () => {
    await api?.close();
  });

  const probeEmail = (tag: string) => `probe+${tag}-${randomUUID()}@example.invalid`;

  it('AUTH-US-01: register normalises the email, defaults baseCurrency to VND, and a short password is a 422 naming the field', async () => {
    const email = probeEmail('normalise');
    const registered = await api.call('POST', '/auth/register', {
      body: { email: `  ${email.toUpperCase()}  `, password: `probe-pw-${randomUUID()}`, displayName: 'probe-normalise' },
    });
    assert.equal(registered.status, 201);
    assert.equal(registered.body?.data.user.email, email);
    assert.equal(registered.body?.data.user.baseCurrency, 'VND');

    const short = await api.call('POST', '/auth/register', {
      body: { email: probeEmail('short-pw'), password: 'elevenchars', displayName: 'probe-short-pw' },
    });
    assert.equal(short.status, 422);
    assert.equal(short.body?.error?.code, 'VALIDATION_FAILED');
    assert.ok(short.body?.error?.fields?.password?.length, `fields were ${JSON.stringify(short.body?.error?.fields)}`);
  });

  it('AUTH-US-01: a failure partway through registration leaves no user, wallet, membership or categories behind', async () => {
    const email = probeEmail('rollback');
    const displayName = `probe-rollback-${randomUUID()}`;
    // Fails after the user, wallet, membership and categories are inserted in the same transaction.
    const issue = mock.method(api.app.get(TokenService), 'issueRefreshToken', async () => {
      throw new Error('probe: forced failure during registration');
    });
    try {
      const response = await api.call('POST', '/auth/register', { body: { email, password: `probe-pw-${randomUUID()}`, displayName } });
      assert.equal(response.status, 500);
      assert.equal(issue.mock.callCount(), 1);
    } finally {
      issue.mock.restore();
    }

    assert.deepEqual(await api.sql('SELECT id FROM users WHERE LOWER(email) = $1', [email]), []);
    const wallets = await api.sql<{ id: string }>('SELECT id FROM wallets WHERE name = $1', [`${displayName}'s Wallet`]);
    assert.deepEqual(wallets, []);
    assert.deepEqual(
      await api.sql(
        `SELECT 1 FROM wallet_members m JOIN wallets w ON w.id = m.wallet_id WHERE w.name = $1
         UNION ALL SELECT 1 FROM categories c JOIN wallets w ON w.id = c.wallet_id WHERE w.name = $1`,
        [`${displayName}'s Wallet`],
      ),
      [],
    );

    // The rollback must not strand the address either.
    const retry = await api.call('POST', '/auth/register', { body: { email, password: `probe-pw-${randomUUID()}`, displayName } });
    assert.equal(retry.status, 201);
  });

  it('AUTH-US-02: login, register and refresh each answer 429 with Retry-After once 10 requests per minute per IP are spent (spec §2.9)', async () => {
    const limiter = api.app.get(RateLimitService);
    const original = limiter.hit.bind(limiter);
    // The harness lifts the limit so other tests can register freely; restore the spec's figure on a
    // fresh key, so this test's count is not inherited from earlier requests in the process.
    const scope = randomUUID();
    const hit = mock.method(limiter, 'hit', (key: string, _limit: number, windowMs: number, now?: number) =>
      original(`${key}#${scope}`, SPEC_AUTH_LIMIT_PER_MINUTE, windowMs, now),
    );
    try {
      for (const path of ['/auth/login', '/auth/register', '/auth/refresh']) {
        for (let request = 0; request < SPEC_AUTH_LIMIT_PER_MINUTE; request += 1) {
          const allowed = await api.call('POST', path, { body: {} });
          assert.notEqual(allowed.status, 429, `${path} request ${request + 1} was limited`);
        }
        const limited = await api.call('POST', path, { body: {} });
        assert.equal(limited.status, 429, path);
        assert.equal(limited.body?.error?.code, 'RATE_LIMITED');
        assert.ok(Number(limited.headers['retry-after']) > 0, `${path} Retry-After was ${String(limited.headers['retry-after'])}`);
      }
      assert.ok(hit.mock.callCount() >= 3 * (SPEC_AUTH_LIMIT_PER_MINUTE + 1));
    } finally {
      hit.mock.restore();
    }
  });

  it('AUTH-US-02: a denied and a successful sign-in each write a USER_LOGIN audit row', async () => {
    const user = await registerProbeUser(api, 'login-audit');
    const denied = await api.call('POST', '/auth/login', { body: { email: user.email, password: 'not-the-password-123' } });
    assert.equal(denied.status, 401);
    const signedIn = await api.call('POST', '/auth/login', { body: { email: user.email, password: user.password } });
    assert.equal(signedIn.status, 200);

    const audit = await api.sql<{ result: string }>(
      'SELECT result FROM audit_logs WHERE actor_id = $1 AND event = $2 ORDER BY id',
      [user.id, 'USER_LOGIN'],
    );
    assert.deepEqual(audit, [{ result: 'DENIED' }, { result: 'SUCCESS' }]);
  });

  it('AUTH-US-03: an expired refresh token is 401 TOKEN_EXPIRED and an unknown one 401 TOKEN_INVALID, and neither ends other sessions', async () => {
    const user = await registerProbeUser(api, 'refresh-refused');
    const second = await api.call('POST', '/auth/login', { body: { email: user.email, password: user.password } });
    const otherSession = second.body!.data.tokens.refreshToken as string;

    // Refresh tokens live 7 days; the clock is moved past that rather than editing the row.
    const realNow = Date.now.bind(Date);
    const clock = mock.method(Date, 'now', () => realNow() + EIGHT_DAYS_MS);
    let expired;
    try {
      expired = await api.call('POST', '/auth/refresh', { body: { refreshToken: user.refreshToken } });
    } finally {
      clock.mock.restore();
    }
    assert.equal(expired.status, 401);
    assert.equal(expired.body?.error?.code, 'TOKEN_EXPIRED');

    const unknown = await api.call('POST', '/auth/refresh', { body: { refreshToken: `probe-unknown-${randomUUID()}` } });
    assert.equal(unknown.status, 401);
    assert.equal(unknown.body?.error?.code, 'TOKEN_INVALID');

    const stillLive = await api.call('POST', '/auth/refresh', { body: { refreshToken: otherSession } });
    assert.equal(stillLive.status, 200);
  });

  it('AUTH-US-04: logging out twice with the same refresh token succeeds both times', async () => {
    const user = await registerProbeUser(api, 'logout-twice');
    const first = await api.call('POST', '/auth/logout', { token: user.token, body: { refreshToken: user.refreshToken } });
    const second = await api.call('POST', '/auth/logout', { token: user.token, body: { refreshToken: user.refreshToken } });
    assert.equal(first.status, 204);
    assert.equal(second.status, 204);
  });

  it('AUTH-US-04: a logout writes one USER_LOGOUT audit row', async () => {
    const user = await registerProbeUser(api, 'logout-audit');
    const logout = await api.call('POST', '/auth/logout', { token: user.token, body: { refreshToken: user.refreshToken } });
    assert.equal(logout.status, 204);

    const audit = await api.sql('SELECT 1 FROM audit_logs WHERE actor_id = $1 AND event = $2', [user.id, 'USER_LOGOUT']);
    assert.equal(audit.length, 1);
  });

  describe('Google sign-in with a stubbed verifier (spec §5.6)', () => {
    type GoogleClient = { verifyIdToken: VerifyIdToken };
    let client: GoogleClient;
    const payloads = new Map<string, GooglePayload>();
    const audiences: unknown[] = [];

    before(() => {
      client = (api.app.get(AuthService) as unknown as { googleClient: GoogleClient }).googleClient;
      // An own property shadows the prototype method; deleting it in after() restores the real one.
      client.verifyIdToken = async ({ idToken, audience }) => {
        audiences.push(audience);
        const payload = payloads.get(idToken);
        if (!payload) throw new Error('probe: invalid token signature');
        return { getPayload: () => payload };
      };
    });

    after(() => {
      delete (client as Partial<GoogleClient>).verifyIdToken;
    });

    const googleIdentity = (tag: string, email = probeEmail(tag)) => {
      const idToken = `probe-google-${tag}-${randomUUID()}`;
      payloads.set(idToken, { sub: `probe-sub-${randomUUID()}`, email, email_verified: true, name: `probe-${tag}` });
      return { idToken, email };
    };

    it('AUTH-US-02: a first Google sign-in creates the user with a seeded wallet; a second signs the same user in', async () => {
      const { idToken, email } = googleIdentity('google-new');
      const first = await api.call('POST', '/auth/google', { body: { idToken } });
      assert.equal(first.status, 200);
      assert.equal(first.body?.data.user.email, email);
      assert.equal(first.body?.data.user.hasPassword, false);
      assert.ok(first.body?.data.tokens.accessToken && first.body?.data.tokens.refreshToken);
      assert.deepEqual([audiences.at(-1)].flat(), process.env.GOOGLE_CLIENT_ID!.split(',').map((id) => id.trim()));
      const userId = first.body!.data.user.id as string;

      const wallets = await api.call('GET', '/wallets', { token: first.body!.data.tokens.accessToken });
      assert.equal(wallets.body?.data.length, 1);
      const wallet = wallets.body!.data[0];
      assert.equal(wallet.name, "probe-google-new's Wallet");
      assert.deepEqual(
        await api.sql('SELECT role, status FROM wallet_members WHERE wallet_id = $1 AND user_id = $2', [wallet.id, userId]),
        [{ role: 'OWNER', status: 'ACTIVE' }],
      );
      const categories = await api.sql<{ name: string }>('SELECT name FROM categories WHERE wallet_id = $1', [wallet.id]);
      const names = new Set(categories.map((row) => row.name));
      assert.deepEqual(STARTER_CATEGORIES.filter((category) => !names.has(category.name)), []);
      assert.deepEqual(await api.sql('SELECT type FROM accounts WHERE wallet_id = $1', [wallet.id]), [{ type: 'CASH' }]);

      const passwordLogin = await api.call('POST', '/auth/login', { body: { email, password: 'any-password-at-all' } });
      assert.equal(passwordLogin.status, 401);
      assert.equal(passwordLogin.body?.error?.code, 'CREDENTIALS_INVALID');

      const again = await api.call('POST', '/auth/google', { body: { idToken } });
      assert.equal(again.status, 200);
      assert.equal(again.body?.data.user.id, userId);
      assert.equal((await api.sql('SELECT id FROM users WHERE LOWER(email) = $1', [email])).length, 1);
      assert.equal((await api.sql('SELECT id FROM wallets WHERE owner_user_id = $1', [userId])).length, 1);

      const audit = await api.sql<{ event: string; result: string }>(
        'SELECT event, result FROM audit_logs WHERE actor_id = $1 AND event IN ($2, $3) ORDER BY id',
        [userId, 'USER_REGISTERED', 'USER_LOGIN'],
      );
      assert.deepEqual(audit, [
        { event: 'USER_REGISTERED', result: 'SUCCESS' },
        { event: 'USER_LOGIN', result: 'DENIED' },
        { event: 'USER_LOGIN', result: 'SUCCESS' },
      ]);
    });

    it('AUTH-US-02: Google sign-in for an email that already has a password account links it instead of creating a second user', async () => {
      const user = await registerProbeUser(api, 'google-link');
      const { idToken } = googleIdentity('google-link', user.email);
      const linked = await api.call('POST', '/auth/google', { body: { idToken } });
      assert.equal(linked.status, 200);
      assert.equal(linked.body?.data.user.id, user.id);
      assert.equal(linked.body?.data.user.hasPassword, true);

      const rows = await api.sql<{ id: string; google_id: string | null }>('SELECT id, google_id FROM users WHERE LOWER(email) = $1', [user.email]);
      assert.deepEqual(rows, [{ id: user.id, google_id: payloads.get(idToken)!.sub }]);
      assert.equal((await api.sql('SELECT id FROM wallets WHERE owner_user_id = $1', [user.id])).length, 1);
      const passwordLogin = await api.call('POST', '/auth/login', { body: { email: user.email, password: user.password } });
      assert.equal(passwordLogin.status, 200);
    });

    it('AUTH-US-02: a second Google account with the same verified email is refused, not swapped in for the linked one', async () => {
      const user = await registerProbeUser(api, 'google-relink');
      const first = googleIdentity('google-relink', user.email);
      assert.equal((await api.call('POST', '/auth/google', { body: { idToken: first.idToken } })).status, 200);

      const second = googleIdentity('google-relink-other', user.email);
      const refused = await api.call('POST', '/auth/google', { body: { idToken: second.idToken } });
      assert.deepEqual([refused.status, refused.body?.error?.code], [409, 'GOOGLE_ACCOUNT_MISMATCH']);
      assert.deepEqual(await api.sql('SELECT google_id FROM users WHERE id = $1', [user.id]), [{ google_id: payloads.get(first.idToken)!.sub }]);

      assert.equal((await api.call('POST', '/auth/google', { body: { idToken: first.idToken } })).status, 200, 'the linked one still signs in');
    });

    it('AUTH-US-02: a Google ID token that fails verification is 401 GOOGLE_TOKEN_INVALID and creates nothing', async () => {
      const refused = await api.call('POST', '/auth/google', { body: { idToken: `probe-google-forged-${randomUUID()}` } });
      assert.equal(refused.status, 401);
      assert.equal(refused.body?.error?.code, 'GOOGLE_TOKEN_INVALID');
      assert.equal(refused.body?.data ?? null, null);
    });
  });

  it('AUTH-US-03: GET /auth/me returns the caller, and PATCH /auth/me/preferences persists theme and locale but refuses values outside their sets', async () => {
    const user = await registerProbeUser(api, 'me');
    const me = await api.call('GET', '/auth/me', { token: user.token });
    assert.equal(me.status, 200);
    const { createdAt, ...profile } = me.body!.data;
    assert.deepEqual(profile, {
      id: user.id,
      email: user.email,
      displayName: 'probe-me',
      baseCurrency: 'VND',
      theme: 'obsidian',
      locale: 'en',
      hasPassword: true,
    });
    assert.ok(!Number.isNaN(Date.parse(createdAt)));

    const updated = await api.call('PATCH', '/auth/me/preferences', { token: user.token, body: { theme: 'sage', locale: 'vi' } });
    assert.equal(updated.status, 200);
    assert.deepEqual({ theme: updated.body?.data.theme, locale: updated.body?.data.locale }, { theme: 'sage', locale: 'vi' });

    for (const [body, field] of [
      [{ theme: 'neon' }, 'theme'],
      [{ locale: 'fr' }, 'locale'],
      [{}, null],
      // Base currency is not a preference (§5.7 takes theme and locale only), so this carries no field to update.
      [{ baseCurrency: 'USD' }, null],
    ] as const) {
      const refused = await api.call('PATCH', '/auth/me/preferences', { token: user.token, body });
      assert.equal(refused.status, 422, JSON.stringify(body));
      assert.equal(refused.body?.error?.code, 'VALIDATION_FAILED');
      if (field) assert.ok(refused.body?.error?.fields?.[field]?.length, `fields were ${JSON.stringify(refused.body?.error?.fields)}`);
    }

    const reread = await api.call('GET', '/auth/me', { token: user.token });
    assert.deepEqual(
      { theme: reread.body?.data.theme, locale: reread.body?.data.locale, baseCurrency: reread.body?.data.baseCurrency },
      { theme: 'sage', locale: 'vi', baseCurrency: 'VND' },
    );
  });
});
