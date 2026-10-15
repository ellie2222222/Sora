import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { ConfigError, loadConfig } from '../src/config/env.ts';

const REQUIRED = {
  DATABASE_URL: 'postgresql://probe@127.0.0.1:9/probe_env_test',
  JWT_SECRET: 'probe-secret-not-a-credential-0000000000',
  GOOGLE_CLIENT_ID: 'probe.apps.googleusercontent.com',
};

describe('loadConfig', () => {
  it('AUTH-US-02: defaults the per-IP auth limit to 10 a minute and the per-email lockout to 5 failures for 15 minutes', () => {
    const config = loadConfig(REQUIRED);
    assert.deepEqual(
      [config.AUTH_RATE_LIMIT_PER_MINUTE, config.LOGIN_FAILURE_LIMIT, config.LOGIN_LOCKOUT_MINUTES],
      [10, 5, 15],
    );
  });

  it('refuses to boot on a JWT secret under 32 characters', () => {
    assert.throws(() => loadConfig({ ...REQUIRED, JWT_SECRET: 'short' }), ConfigError);
  });

  it('loads optional GEMINI_API_KEY and trims whitespace', () => {
    const unset = loadConfig(REQUIRED);
    assert.equal(unset.GEMINI_API_KEY, undefined);

    const empty = loadConfig({ ...REQUIRED, GEMINI_API_KEY: '   ' });
    assert.equal(empty.GEMINI_API_KEY, undefined);

    const configured = loadConfig({ ...REQUIRED, GEMINI_API_KEY: '  test-key  ', GEMINI_MODEL: 'gemini-1.5-pro' });
    assert.equal(configured.GEMINI_API_KEY, 'test-key');
    assert.equal(configured.GEMINI_MODEL, 'gemini-1.5-pro');
  });
});
