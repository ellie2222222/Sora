import { strict as assert } from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { ValuationStatus } from '@sora/contracts';
import { type AppConfig } from '../src/config/env.ts';
import { ExchangeRateService } from '../src/exchange-rate/exchange-rate.service.ts';

describe('ExchangeRateService', () => {
  const mockConfig: AppConfig = {
    NODE_ENV: 'test',
    PORT: 3001,
    DATABASE_URL: 'postgres://localhost/test',
    DATABASE_POOL_MAX: 10,
    JWT_SECRET: '01234567890123456789012345678901',
    JWT_ISSUER: 'sora-server',
    ACCESS_TOKEN_TTL_SECONDS: 900,
    REFRESH_TOKEN_TTL_DAYS: 7,
    INVITATION_TTL_DAYS: 7,
    AUTH_RATE_LIMIT_PER_MINUTE: 10,
    LOGIN_FAILURE_LIMIT: 5,
    LOGIN_LOCKOUT_MINUTES: 15,
    APP_VERSION: '0.1.0',
    GOOGLE_CLIENT_ID: 'test-google-client-id',
    EXCHANGE_RATE_API_URL: 'https://open.er-api.com/v6/latest',
    EXCHANGE_RATE_TIMEOUT_SECONDS: 5,
    EXCHANGE_RATE_CACHE_TTL_MINUTES: 720,
  };

  let service: ExchangeRateService;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    service = new ExchangeRateService(mockConfig);
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    service.clearCache();
  });

  it('same-currency shortcut: does not invoke fetch and returns exact sum with FRESH status', async () => {
    let fetchCalled = false;
    globalThis.fetch = async () => {
      fetchCalled = true;
      throw new Error('Should not be called');
    };

    const totals = [
      { currency: 'VND', amount: '100000.0000' },
      { currency: 'VND', amount: '250000.0000' },
    ];

    const result = await service.calculateValuation(totals, 'VND');

    assert.equal(fetchCalled, false, 'fetch must not be called when all currencies match target');
    assert.equal(result.currency, 'VND');
    assert.equal(result.amount, '350000.0000');
    assert.equal(result.isApproximate, false);
    assert.equal(result.status, ValuationStatus.FRESH);
  });

  it('empty totals returns 0.0000 with FRESH status', async () => {
    const result = await service.calculateValuation([], 'USD');
    assert.equal(result.currency, 'USD');
    assert.equal(result.amount, '0.0000');
    assert.equal(result.isApproximate, false);
    assert.equal(result.status, ValuationStatus.FRESH);
  });

  it('converts multi-currency totals with FRESH status and caches rate', async () => {
    let fetchCount = 0;
    globalThis.fetch = async (url: string | URL | Request) => {
      fetchCount++;
      assert.ok(String(url).endsWith('/USD'), `expected URL ending with /USD, got ${url}`);
      return new Response(
        JSON.stringify({
          result: 'success',
          base_code: 'USD',
          time_last_update_utc: 'Wed, 14 Sep 2026 00:00:01 +0000',
          rates: {
            USD: 1,
            VND: 25000, // 1 USD = 25000 VND -> 500,000 VND = 20 USD
            EUR: 0.92,  // 1 USD = 0.92 EUR
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    };

    const totals = [
      { currency: 'USD', amount: '100.0000' },
      { currency: 'VND', amount: '500000.0000' }, // 500,000 / 25000 = 20 USD
    ];

    const result = await service.calculateValuation(totals, 'USD');

    assert.equal(fetchCount, 1);
    assert.equal(result.currency, 'USD');
    assert.equal(result.amount, '120.0000'); // 100 + 20 = 120
    assert.equal(result.isApproximate, true);
    assert.equal(result.status, ValuationStatus.FRESH);
    assert.equal(result.rateTimestamp, 'Wed, 14 Sep 2026 00:00:01 +0000');

    // Subsequent call should use cache
    const secondResult = await service.calculateValuation(totals, 'USD');
    assert.equal(fetchCount, 1, 'subsequent call must hit cache');
    assert.equal(secondResult.amount, '120.0000');
    assert.equal(secondResult.status, ValuationStatus.FRESH);
  });

  it('stale rate fallback: falls back to expired rate with STALE status when provider fails', async () => {
    // 1. Prime the cache with fresh rates
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          result: 'success',
          base_code: 'USD',
          time_last_update_utc: '2026-09-13T00:00:00Z',
          rates: { USD: 1, VND: 25000 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    };

    await service.getRates('USD');

    // Artificially expire the cache
    const cached = (service as any).cache.get('USD');
    assert.ok(cached);
    cached.expiresAt = Date.now() - 1000; // expired!

    // 2. Provider fails now
    globalThis.fetch = async () => {
      throw new Error('Provider unreachable');
    };

    const totals = [
      { currency: 'USD', amount: '100.0000' },
      { currency: 'VND', amount: '250000.0000' }, // 10 USD
    ];

    const result = await service.calculateValuation(totals, 'USD');

    assert.equal(result.currency, 'USD');
    assert.equal(result.amount, '110.0000');
    assert.equal(result.status, ValuationStatus.STALE);
    assert.equal(result.rateTimestamp, '2026-09-13T00:00:00Z');
  });

  it('complete conversion rule: returns UNAVAILABLE with missingCurrencies if any rate is missing', async () => {
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          result: 'success',
          base_code: 'USD',
          rates: {
            USD: 1,
            // JPY is missing!
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    };

    const totals = [
      { currency: 'USD', amount: '100.0000' },
      { currency: 'JPY', amount: '5000.0000' },
    ];

    const result = await service.calculateValuation(totals, 'USD');

    assert.equal(result.currency, 'USD');
    assert.equal(result.amount, null);
    assert.equal(result.status, ValuationStatus.UNAVAILABLE);
    assert.deepEqual(result.missingCurrencies, ['JPY']);
    assert.equal(result.isApproximate, true);
  });

  it('handles provider HTTP errors gracefully with UNAVAILABLE and missingCurrencies when no cache exists', async () => {
    globalThis.fetch = async () => {
      return new Response('Internal Server Error', { status: 500 });
    };

    const totals = [
      { currency: 'USD', amount: '100.0000' },
      { currency: 'VND', amount: '500000.0000' },
    ];

    const result = await service.calculateValuation(totals, 'VND');

    assert.equal(result.currency, 'VND');
    assert.equal(result.amount, null);
    assert.equal(result.status, ValuationStatus.UNAVAILABLE);
    assert.deepEqual(result.missingCurrencies, ['USD']);
    assert.equal(result.isApproximate, true);
  });

  it('handles network failure / timeout gracefully by returning UNAVAILABLE', async () => {
    globalThis.fetch = async () => {
      throw new Error('Network timeout');
    };

    const totals = [
      { currency: 'USD', amount: '100.0000' },
      { currency: 'EUR', amount: '50.0000' },
    ];

    const result = await service.calculateValuation(totals, 'USD');

    assert.equal(result.currency, 'USD');
    assert.equal(result.amount, null);
    assert.equal(result.status, ValuationStatus.UNAVAILABLE);
    assert.deepEqual(result.missingCurrencies, ['EUR']);
    assert.equal(result.isApproximate, true);
  });

  it('historical rates: retrieves snapshot when present and returns null when missing', async () => {
    const mockDb: any = {
      db: {
        selectFrom: () => ({
          selectAll: () => ({
            where: (_col: string, _op: string, val1: string) => ({
              where: (_col2: string, _op2: string, val2: string) => ({
                executeTakeFirst: async () => {
                  if (val1 === 'USD' && val2 === '2026-09-10') {
                    return {
                      snapshot_date: '2026-09-10',
                      base_currency: 'USD',
                      rates: { USD: 1, VND: 24500 },
                      fetched_at: new Date('2026-09-10T08:00:00Z'),
                    };
                  }
                  return undefined;
                },
              }),
            }),
          }),
        }),
      },
    };

    const dbService = new ExchangeRateService(mockConfig, mockDb);

    // Found historical date
    const foundResult = await dbService.getRates('USD', { historicalDate: '2026-09-10' });
    assert.ok(foundResult);
    assert.equal(foundResult.rates.VND, 24500);
    assert.equal(foundResult.status, ValuationStatus.FRESH);

    // Missing historical date (do not guess!)
    const missingResult = await dbService.getRates('USD', { historicalDate: '2026-09-01' });
    assert.equal(missingResult, null);
  });
});
