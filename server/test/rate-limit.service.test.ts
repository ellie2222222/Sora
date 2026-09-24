import { strict as assert } from 'node:assert';
import { afterEach, describe, it } from 'node:test';

import { RateLimitService } from '../src/common/rate-limit.service.ts';

const HOUR = 60 * 60 * 1000;

describe('RateLimitService.sweep', () => {
  let service: RateLimitService;
  afterEach(() => service.onModuleDestroy());

  it('forgets an expired window, so a returning IP starts a fresh count', () => {
    service = new RateLimitService();
    service.hit('ip-a', 1, 1000, 0);
    assert.equal(service.hit('ip-a', 1, 1000, 500).allowed, false);

    service.sweep(1000);
    assert.equal(service.hit('ip-a', 1, 1000, 1000).allowed, true);
  });

  it('keeps a lockout until it lapses, then drops it', () => {
    service = new RateLimitService();
    service.recordLoginFailure('probe@example.invalid', 1, HOUR, 0);

    service.sweep(HOUR - 1);
    assert.equal(service.lockoutFor('probe@example.invalid', HOUR - 1).allowed, false);

    service.sweep(HOUR);
    assert.equal(service.lockoutFor('probe@example.invalid', HOUR).allowed, true);
  });

  it('drops an unlocked failure streak after a day, so it cannot count toward a lockout later', () => {
    service = new RateLimitService();
    service.recordLoginFailure('probe@example.invalid', 2, HOUR, 0);

    service.sweep(24 * HOUR);
    service.recordLoginFailure('probe@example.invalid', 2, HOUR, 24 * HOUR);
    assert.equal(service.lockoutFor('probe@example.invalid', 24 * HOUR).allowed, true);
  });
});
