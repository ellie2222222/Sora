/**
 * Preloaded via `node --import` before any test file runs (see test/run.mjs). Makes an unstubbed `fetch` fail loudly instead of silently
 * reaching a real external API — `ExchangeRateService` is the one caller today,
 * and every test that exercises it already stubs `globalThis.fetch` itself
 * (see exchange-rate.service.test.ts's beforeEach/afterEach); this is the
 * backstop for the test that forgets to.
 */
globalThis.fetch = (async () => {
  throw new Error(
    'Real network call attempted in a test: globalThis.fetch was not stubbed. ' +
      'Stub it locally (see exchange-rate.service.test.ts) before exercising code that calls an external API.',
  );
}) as typeof fetch;
