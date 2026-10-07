import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, Observable } from 'rxjs';

import { parseAcceptLanguage, requestLocale, RequestLocaleInterceptor } from '../src/common/request-locale.ts';
import type { DatabaseService } from '../src/database/database.service.ts';

describe('parseAcceptLanguage', () => {
  it('reads a bare supported tag, ignoring region subtags and case', () => {
    assert.equal(parseAcceptLanguage('vi'), 'vi');
    assert.equal(parseAcceptLanguage('vi-VN'), 'vi');
    assert.equal(parseAcceptLanguage('EN-us'), 'en');
  });

  it('picks the highest-weighted supported language, skipping unsupported ones', () => {
    assert.equal(parseAcceptLanguage('fr-FR,fr;q=0.9,vi;q=0.8,en;q=0.7'), 'vi');
    assert.equal(parseAcceptLanguage('en;q=0.4, vi;q=0.6'), 'vi');
  });

  it('breaks a weight tie by header order', () => {
    assert.equal(parseAcceptLanguage('en, vi'), 'en');
  });

  it('returns null when nothing usable was asked for', () => {
    assert.equal(parseAcceptLanguage(undefined), null);
    assert.equal(parseAcceptLanguage(''), null);
    assert.equal(parseAcceptLanguage('fr, de'), null);
    assert.equal(parseAcceptLanguage('vi;q=0'), null);
    assert.equal(parseAcceptLanguage('*'), null);
  });
});

describe('RequestLocaleInterceptor', () => {
  function contextFor(request: { headers: Record<string, string>; user?: { id: string } }): ExecutionContext {
    return {
      getType: () => 'http',
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  }

  // The handler reports the locale it sees, after an await, to prove the store survives async work.
  const reportsLocale: CallHandler = {
    handle: () => new Observable((subscriber) => {
      void Promise.resolve().then(() => {
        subscriber.next(requestLocale());
        subscriber.complete();
      });
    }),
  };

  function interceptorWithProfileLocale(locale: string | undefined): { interceptor: RequestLocaleInterceptor; lookups: () => number } {
    let lookups = 0;
    const query = {
      select: () => query,
      where: () => query,
      executeTakeFirst: async () => {
        lookups += 1;
        return locale === undefined ? undefined : { locale };
      },
    };
    const database = { db: { selectFrom: () => query } } as unknown as DatabaseService;
    return { interceptor: new RequestLocaleInterceptor(database), lookups: () => lookups };
  }

  it('uses Accept-Language without reading the profile', async () => {
    const { interceptor, lookups } = interceptorWithProfileLocale('en');
    const seen = await firstValueFrom(interceptor.intercept(contextFor({ headers: { 'accept-language': 'vi-VN' }, user: { id: 'u' } }), reportsLocale));
    assert.equal(seen, 'vi');
    assert.equal(lookups(), 0);
  });

  it("falls back to the caller's saved locale when the header names nothing supported", async () => {
    const { interceptor } = interceptorWithProfileLocale('vi');
    const seen = await firstValueFrom(interceptor.intercept(contextFor({ headers: { 'accept-language': 'fr' }, user: { id: 'u' } }), reportsLocale));
    assert.equal(seen, 'vi');
  });

  it('falls back to English for an anonymous request', async () => {
    const { interceptor, lookups } = interceptorWithProfileLocale('vi');
    const seen = await firstValueFrom(interceptor.intercept(contextFor({ headers: {} }), reportsLocale));
    assert.equal(seen, 'en');
    assert.equal(lookups(), 0);
  });

  it('reads English outside any request', () => {
    assert.equal(requestLocale(), 'en');
  });
});
