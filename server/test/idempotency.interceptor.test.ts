import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, Observable, Subject, throwError } from 'rxjs';

import { AppError } from '../src/common/app-error.ts';
import { IdempotencyInterceptor } from '../src/common/idempotency.interceptor.ts';

interface FakeRequest {
  method: string;
  originalUrl: string;
  body: unknown;
  user?: { id: string };
  header(name: string): string | undefined;
}

function contextFor(request: Partial<FakeRequest> & { key?: string }): ExecutionContext {
  const full: FakeRequest = {
    method: 'POST',
    originalUrl: '/api/v1/transactions',
    body: { amount: '10' },
    user: { id: 'user-a' },
    ...request,
    header: (name) => (name.toLowerCase() === 'idempotency-key' ? request.key : undefined),
  };
  return { switchToHttp: () => ({ getRequest: () => full }) } as unknown as ExecutionContext;
}

/** A handler whose every invocation is counted, answering with a fresh response id each time. */
function countingHandler(): CallHandler & { calls: number } {
  const handler = {
    calls: 0,
    handle: () =>
      new Observable((subscriber) => {
        handler.calls += 1;
        subscriber.next({ id: `response-${handler.calls}` });
        subscriber.complete();
      }),
  };
  return handler;
}

describe('IdempotencyInterceptor (API spec §2.10)', () => {
  it('replays the first response for the same key and body, running the handler once', async () => {
    const interceptor = new IdempotencyInterceptor();
    const handler = countingHandler();
    const first = await firstValueFrom(interceptor.intercept(contextFor({ key: 'k1' }), handler));
    const second = await firstValueFrom(interceptor.intercept(contextFor({ key: 'k1' }), handler));
    assert.deepEqual([first, second, handler.calls], [{ id: 'response-1' }, { id: 'response-1' }, 1]);
  });

  it('runs the handler once when a retry arrives while the first attempt is still in flight', async () => {
    const interceptor = new IdempotencyInterceptor();
    let calls = 0;
    const gate = new Subject<unknown>();
    const slow: CallHandler = {
      handle: () =>
        new Observable((subscriber) => {
          calls += 1;
          gate.subscribe(subscriber);
        }),
    };
    const first = firstValueFrom(interceptor.intercept(contextFor({ key: 'k-race' }), slow));
    const retry = firstValueFrom(interceptor.intercept(contextFor({ key: 'k-race' }), slow));
    gate.next({ id: 'only-one' });
    gate.complete();
    assert.deepEqual([await first, await retry, calls], [{ id: 'only-one' }, { id: 'only-one' }, 1]);
  });

  it('refuses the same key with a different body rather than serving the wrong response', () => {
    const interceptor = new IdempotencyInterceptor();
    const handler = countingHandler();
    interceptor.intercept(contextFor({ key: 'k2' }), handler).subscribe();
    assert.throws(
      () => interceptor.intercept(contextFor({ key: 'k2', body: { amount: '99' } }), handler),
      (error: unknown) => error instanceof AppError && error.code === 'VALIDATION_FAILED',
    );
  });

  it('lets a retry run again after the first attempt failed, so an error is never replayed', async () => {
    const interceptor = new IdempotencyInterceptor();
    const failing: CallHandler = { handle: () => throwError(() => new Error('database down')) };
    await assert.rejects(firstValueFrom(interceptor.intercept(contextFor({ key: 'k3' }), failing)), /database down/);

    const handler = countingHandler();
    assert.deepEqual(await firstValueFrom(interceptor.intercept(contextFor({ key: 'k3' }), handler)), { id: 'response-1' });
  });

  it('keeps keys per user, and ignores reads and requests without a key', async () => {
    const interceptor = new IdempotencyInterceptor();
    const handler = countingHandler();
    await firstValueFrom(interceptor.intercept(contextFor({ key: 'shared', user: { id: 'user-a' } }), handler));
    await firstValueFrom(interceptor.intercept(contextFor({ key: 'shared', user: { id: 'user-b' } }), handler));
    await firstValueFrom(interceptor.intercept(contextFor({ key: 'k4', method: 'GET' }), handler));
    await firstValueFrom(interceptor.intercept(contextFor({ key: 'k4', method: 'GET' }), handler));
    await firstValueFrom(interceptor.intercept(contextFor({}), handler));
    assert.equal(handler.calls, 5);
  });
});
