import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';
import type { ExecutionContext } from '@nestjs/common';

import { AppError } from '../src/common/app-error.ts';
import { PathIdGuard } from '../src/common/path-id.guard.ts';

function contextWith(params: Record<string, string> | undefined): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => ({ params }) }) } as unknown as ExecutionContext;
}

describe('PathIdGuard', () => {
  const guard = new PathIdGuard();

  it('lets a route with no path parameters through', () => {
    assert.equal(guard.canActivate(contextWith({})), true);
    assert.equal(guard.canActivate(contextWith(undefined)), true);
  });

  it('lets uuid parameters through', () => {
    assert.equal(guard.canActivate(contextWith({ id: randomUUID(), memberId: randomUUID() })), true);
  });

  it('answers a malformed id as a path no route matches, before anything queries it', () => {
    assert.throws(
      () => guard.canActivate(contextWith({ id: randomUUID(), memberId: 'not-a-uuid' })),
      (error: unknown) => error instanceof AppError && error.code === 'ROUTE_NOT_FOUND' && error.status === 404,
    );
  });
});
