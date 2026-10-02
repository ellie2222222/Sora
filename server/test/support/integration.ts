/**
 * Boots the real app against a real Postgres for HTTP-level integration tests.
 *
 * Runs only against a database whose name marks it disposable (`sora_test` in CI, a
 * `scratch_*` one locally): every test writes probe users and wallets and never cleans
 * them up, so pointing this at a dev database would fill it with fixtures. In CI a
 * missing or non-disposable database is a failure, not a skip, so the suite can't go
 * green having tested nothing (rule 8).
 */

import 'reflect-metadata';
import { request as httpRequest } from 'node:http';
import type { AddressInfo } from 'node:net';

import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { API_PREFIX } from '@sora/contracts';
import pg from 'pg';

import { AppModule } from '../../src/app.module.ts';
import type { ApiCaller } from './probe-data.ts';

const DISPOSABLE_NAME = /(^|[_-])(test|scratch|ci)([_-]|$)/i;

function databaseName(url: string): string | null {
  try {
    return decodeURIComponent(new URL(url).pathname.replace(/^\//, '')) || null;
  } catch {
    return null;
  }
}

/** `false` when the suite may run, otherwise why it is skipped. Throws in CI instead of skipping. */
export function integrationSkipReason(): string | false {
  const url = process.env.DATABASE_URL;
  const name = url ? databaseName(url) : null;
  const reason =
    name === null
      ? 'DATABASE_URL is not set'
      : DISPOSABLE_NAME.test(name)
        ? false
        : `database "${name}" does not look disposable (needs test, scratch or ci in its name)`;
  if (reason && process.env.CI === 'true') throw new Error(`Integration tests cannot run in CI: ${reason}`);
  // node --test counts a skipped suite as "skipped 0", so a local run would otherwise look complete.
  if (reason) console.warn(`[integration] SKIPPED — ${reason}. Set DATABASE_URL to a scratch database to run it.`);
  return reason;
}

export interface TestApi extends ApiCaller {
  sql<T = any>(text: string, values?: unknown[]): Promise<T[]>;
  /** The booted DI container, for the few checks that must run inside a service call. */
  app: INestApplication;
  close(): Promise<void>;
}

export async function startTestApi(): Promise<TestApi> {
  process.env.JWT_SECRET ??= 'integration-test-secret-not-a-credential-0000';
  process.env.JWT_ISSUER ??= 'sora-integration-test';
  process.env.GOOGLE_CLIENT_ID ??= 'integration-test.apps.googleusercontent.com';
  process.env.NODE_ENV ??= 'test';
  process.env.APP_VERSION ??= '0.0.0-test';
  // Tests register many users from one IP; the per-IP limit has its own unit test.
  process.env.AUTH_RATE_LIMIT_PER_MINUTE = '100000';
  process.env.EXCHANGE_RATE_API_URL ??= 'http://127.0.0.1:9/integration-no-network';

  const app: INestApplication = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix(API_PREFIX);
  await app.listen(0, '127.0.0.1');
  const port = (app.getHttpServer().address() as AddressInfo).port;
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });

  return {
    app,
    call(method, path, options = {}) {
      const payload = options.body === undefined ? undefined : JSON.stringify(options.body);
      return new Promise((resolve, reject) => {
        const req = httpRequest(
          {
            host: '127.0.0.1',
            port,
            method,
            path: `${API_PREFIX}${path}`,
            headers: {
              ...(payload ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } : {}),
              ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
              ...options.headers,
            },
          },
          (res) => {
            let raw = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => (raw += chunk));
            res.on('end', () => {
              resolve({ status: res.statusCode ?? 0, headers: res.headers, body: raw ? JSON.parse(raw) : null });
            });
          },
        );
        req.on('error', reject);
        if (payload) req.write(payload);
        req.end();
      });
    },
    async sql(text, values = []) {
      return (await pool.query(text, values)).rows;
    },
    async close() {
      await pool.end();
      await app.close();
    },
  };
}

export { addMember, categoryOf, createAccount, nowIso, registerProbeUser, type ApiResponse, type ProbeUser } from './probe-data.ts';
