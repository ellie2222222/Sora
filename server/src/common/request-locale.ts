/**
 * The locale a request reads starter-category names in: `Accept-Language`, else the
 * caller's saved preference, else English. Resolved once per request and held in
 * AsyncLocalStorage, so every query that names a category reads the same locale without
 * threading it through each service signature.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { Observable, type Subscription } from 'rxjs';

import { isLocale, type Locale } from '@sora/contracts';

import { DatabaseService } from '../database/database.service.ts';

export const DEFAULT_LOCALE: Locale = 'en';

const storage = new AsyncLocalStorage<Locale>();

/** English outside a request (a test, a background job), where nothing asked for a language. */
export function requestLocale(): Locale {
  return storage.getStore() ?? DEFAULT_LOCALE;
}

/** The highest-weighted supported language in an `Accept-Language` header; region subtags are ignored (`vi-VN` → `vi`). */
export function parseAcceptLanguage(header: string | undefined): Locale | null {
  if (!header) return null;
  const ranked = header
    .split(',')
    .map((part, index) => {
      const [tag = '', ...params] = part.trim().split(';');
      const weight = params.map((param) => param.trim()).find((param) => param.startsWith('q='));
      const quality = weight === undefined ? 1 : Number(weight.slice(2));
      return { language: tag.trim().toLowerCase().split('-')[0] ?? '', quality: Number.isFinite(quality) ? quality : 0, index };
    })
    .filter((entry) => entry.quality > 0 && isLocale(entry.language))
    .sort((a, b) => b.quality - a.quality || a.index - b.index);
  const best = ranked[0]?.language;
  return best !== undefined && isLocale(best) ? best : null;
}

@Injectable()
export class RequestLocaleInterceptor implements NestInterceptor {
  constructor(private readonly database: DatabaseService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const request = context.switchToHttp().getRequest<Request & { user?: { id: string } }>();

    return new Observable((subscriber) => {
      let subscription: Subscription | undefined;
      let closed = false;
      this.resolve(request).then(
        (locale) => {
          if (closed) return;
          // The handler must be subscribed inside run(): that is what carries the store into its async work.
          storage.run(locale, () => {
            subscription = next.handle().subscribe(subscriber);
          });
        },
        (error: unknown) => subscriber.error(error),
      );
      return () => {
        closed = true;
        subscription?.unsubscribe();
      };
    });
  }

  private async resolve(request: Request & { user?: { id: string } }): Promise<Locale> {
    const requested = parseAcceptLanguage(request.headers['accept-language']);
    if (requested !== null) return requested;
    if (!request.user) return DEFAULT_LOCALE;
    const row = await this.database.db.selectFrom('users').select('locale').where('id', '=', request.user.id).executeTakeFirst();
    return row !== undefined && isLocale(row.locale) ? row.locale : DEFAULT_LOCALE;
  }
}
