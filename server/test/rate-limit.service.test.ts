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
    service.beginLoginAttempt('probe@example.invalid', 1, HOUR, 0);

    service.sweep(HOUR - 1);
    assert.equal(service.beginLoginAttempt('probe@example.invalid', 1, HOUR, HOUR - 1).allowed, false);

    service.sweep(HOUR);
    assert.equal(service.beginLoginAttempt('probe@example.invalid', 1, HOUR, HOUR).allowed, true);
  });

  it('drops an unlocked failure streak after a day, so it cannot count toward a lockout later', () => {
    service = new RateLimitService();
    service.beginLoginAttempt('probe@example.invalid', 2, HOUR, 0);

    service.sweep(24 * HOUR);
    // Had the first attempt still counted, the second of these would be the third and refused.
    assert.equal(service.beginLoginAttempt('probe@example.invalid', 2, HOUR, 24 * HOUR).allowed, true);
    assert.equal(service.beginLoginAttempt('probe@example.invalid', 2, HOUR, 24 * HOUR).allowed, true);
  });
});

describe('RateLimitService.beginLoginAttempt', () => {
  let service: RateLimitService;
  afterEach(() => service.onModuleDestroy());

  it('refuses the attempt past the limit while earlier ones are still being checked', () => {
    service = new RateLimitService();
    // Five concurrent sign-ins, none finished yet: each counts the moment it is admitted.
    const admitted = Array.from({ length: 5 }, () => service.beginLoginAttempt('probe@example.invalid', 5, HOUR, 0).allowed);
    assert.deepEqual(admitted, [true, true, true, true, true]);
    assert.equal(service.beginLoginAttempt('probe@example.invalid', 5, HOUR, 0).allowed, false);
  });

  it('clears the streak on a success, so only consecutive failures lock an email out', () => {
    service = new RateLimitService();
    service.beginLoginAttempt('probe@example.invalid', 2, HOUR, 0);
    service.recordLoginSuccess('probe@example.invalid');
    assert.equal(service.beginLoginAttempt('probe@example.invalid', 2, HOUR, 0).allowed, true);
    assert.equal(service.beginLoginAttempt('probe@example.invalid', 2, HOUR, 0).allowed, true);
  });
});
