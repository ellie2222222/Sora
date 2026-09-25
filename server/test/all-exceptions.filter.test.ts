import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { BadRequestException, HttpException, Logger, NotFoundException } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { z } from 'zod';

import { AllExceptionsFilter } from '../src/common/all-exceptions.filter.ts';
import { AppError } from '../src/common/app-error.ts';

interface Sent {
  status: number;
  body: Record<string, unknown> & { message: string; error: { code: string } };
  logged: string[];
}

function send(exception: unknown): Sent {
  const sent = { status: 0, body: undefined as unknown, logged: [] as string[] };
  const response = {
    status(code: number) {
      sent.status = code;
      return response;
    },
    json(body: unknown) {
      sent.body = body;
    },
  };
  const request = { method: 'POST', originalUrl: '/api/v1/transactions', url: '/api/v1/transactions', requestId: 'rid-test-0001' };
  const host = {
    switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }),
  } as unknown as ArgumentsHost;

  const filter = new AllExceptionsFilter();
  const logger = (filter as unknown as { logger: Logger }).logger;
  logger.error = ((message: string, stack?: string) => {
    sent.logged.push(`${message}\n${stack ?? ''}`);
  }) as Logger['error'];
  logger.warn = (() => undefined) as Logger['warn'];

  filter.catch(exception, host);
  return sent as Sent;
}

const PG_ERROR = Object.assign(
  new Error('insert or update on table "transactions" violates foreign key constraint "fk_transactions_account"'),
  { code: '23503', detail: 'Key (account_id)=(0f0e7b1c-probe) is not present in table "accounts".', constraint: 'fk_transactions_account' },
);

describe('AllExceptionsFilter', () => {
  it('returns only the generic envelope for an unhandled driver error, and logs the real text', () => {
    const { status, body, logged } = send(PG_ERROR);
    assert.equal(status, 500);
    assert.deepEqual(Object.keys(body).sort(), ['error', 'message', 'meta', 'success']);
    assert.deepEqual(body.error, { code: 'INTERNAL_ERROR' });
    assert.equal(body.message, new AppError('INTERNAL_ERROR').message);
    const serialised = JSON.stringify(body);
    for (const leak of ['transactions', 'fk_transactions_account', 'account_id', 'stack', 'at ']) {
      assert.ok(!serialised.includes(leak), `response leaked ${leak}`);
    }
    assert.ok(logged[0]?.includes('fk_transactions_account'));
  });

  it('logs the content of a thrown non-Error', () => {
    const { status, body, logged } = send({ reason: 'probe-thrown-object' });
    assert.equal(status, 500);
    assert.equal(body.error.code, 'INTERNAL_ERROR');
    assert.ok(logged[0]?.includes('probe-thrown-object'));
  });

  it('replaces framework text that quotes the request body', () => {
    const { status, body } = send(new BadRequestException('Unexpected token } in JSON at position 12: {"password":"x"}'));
    assert.equal(status, 400);
    assert.equal(body.error.code, 'VALIDATION_FAILED');
    assert.equal(body.message, new AppError('VALIDATION_FAILED').message);
  });

  it('never returns the text of a 5xx HttpException', () => {
    const { status, body } = send(new HttpException('upstream said: db host 10.0.0.5 unreachable', 502));
    assert.equal(status, 502);
    assert.equal(body.error.code, 'INTERNAL_ERROR');
    assert.ok(!body.message.includes('10.0.0.5'));
  });

  it('reports an unmatched route as ROUTE_NOT_FOUND, not a server fault or a missing wallet', () => {
    const { status, body } = send(new NotFoundException('Cannot GET /api/v1/nope?token=x'));
    assert.equal(status, 404);
    assert.deepEqual(body.error, { code: 'ROUTE_NOT_FOUND' });
    assert.ok(!body.message.includes('token'));
  });

  it('passes an unmapped 4xx message through with its real status', () => {
    const { status, body } = send(new HttpException('Payload too large', 413));
    assert.equal(status, 413);
    assert.equal(body.message, 'Payload too large');
  });

  it('maps a ZodError to 422 with field messages and no input values', () => {
    const parsed = z.object({ amount: z.string().min(1, 'Amount is required') }).safeParse({ amount: '' });
    assert.equal(parsed.success, false);
    const { status, body } = send(parsed.error);
    assert.equal(status, 422);
    assert.deepEqual(body.error, { code: 'VALIDATION_FAILED', fields: { amount: ['Amount is required'] } });
  });

  it('passes an AppError through with its own code and message', () => {
    const { status, body } = send(new AppError('WALLET_NOT_FOUND'));
    assert.equal(status, 404);
    assert.deepEqual(body.error, { code: 'WALLET_NOT_FOUND' });
    assert.equal(body.message, 'Wallet not found');
  });
});
