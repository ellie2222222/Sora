import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { after, before, describe, it } from 'node:test';

import { NestFactory } from '@nestjs/core';
import { API_PREFIX, ROUTES } from '@sora/contracts';

import { AppModule } from '../src/app.module.ts';

/**
 * Every path in ROUTES must resolve to a handler the running app actually
 * mounted.
 *
 * check-contract-parity.mjs compares ROUTES against the specification as text, so it
 * passes with a missing controller or an unimported module; only a booted DI graph can tell.
 */

/** Param names differ per controller (`:id` vs `:accountId`), so compare shapes. */
function normalize(path: string): string {
  return path.replace(/:[A-Za-z0-9_]+/g, '*');
}

function declaredRoutes(node: unknown, out = new Set<string>()): Set<string> {
  if (typeof node === 'function') {
    const params = Array.from({ length: node.length }, (_unused, index) => `:p${index}`);
    out.add(normalize((node as (...args: string[]) => string)(...params)));
    return out;
  }

  if (typeof node === 'object' && node !== null) {
    for (const value of Object.values(node)) declaredRoutes(value, out);
  }

  return out;
}

interface ExpressLayer {
  route?: { path: string | string[] };
}

function mountedRoutes(instance: { router?: unknown; _router?: unknown }): Set<string> {
  // Express 5 exposes `router`; Express 4 exposed `_router`. Nest registers
  // every route on the one top-level router, so a flat walk is complete.
  const router = (instance.router ?? instance._router) as { stack?: ExpressLayer[] } | undefined;
  assert.ok(router?.stack, 'could not read the HTTP adapter route table');

  const mounted = new Set<string>();
  for (const layer of router.stack) {
    if (!layer.route) continue;
    const paths = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];
    for (const path of paths) mounted.add(normalize(path));
  }

  return mounted;
}

describe('mounted routes', () => {
  let app: Awaited<ReturnType<typeof NestFactory.create>>;
  let mounted: Set<string>;

  before(async () => {
    // The app is never told to listen and no query runs, so these only have to
    // satisfy config validation at boot — they are not credentials.
    process.env.DATABASE_URL ??= 'postgresql://unused:unused@127.0.0.1:1/unused';
    process.env.JWT_SECRET ??= 'route-assertion-placeholder-secret-0123456789';
    process.env.JWT_ISSUER ??= 'sora-route-test';
    process.env.GOOGLE_CLIENT_ID ??= 'route-assertion.apps.googleusercontent.com';
    process.env.APP_VERSION ??= '0.0.0-test';
    process.env.NODE_ENV ??= 'test';

    app = await NestFactory.create(AppModule, { logger: false });
    app.setGlobalPrefix(API_PREFIX);
    await app.init();

    mounted = mountedRoutes(app.getHttpAdapter().getInstance());
  });

  after(async () => {
    await app?.close();
  });

  it('mounts every path declared in ROUTES', () => {
    const missing = [...declaredRoutes(ROUTES)]
      .filter((route) => !mounted.has(normalize(`${API_PREFIX}${route}`)))
      .sort();

    assert.deepEqual(
      missing,
      [],
      `declared in ROUTES but not mounted (a controller or its module is unwired): ${missing.join(', ')}`,
    );
  });

  it('mounts every route under the version prefix', () => {
    const unprefixed = [...mounted].filter((route) => !route.startsWith(API_PREFIX)).sort();

    assert.deepEqual(unprefixed, [], `mounted outside ${API_PREFIX}: ${unprefixed.join(', ')}`);
  });

  it('mounts at least one route per resource group', () => {
    // A module missing from AppModule takes its entire group down at once, which a
    // per-path assertion reports as a wall of noise rather than one cause.
    // Groups come from ROUTES itself, so a new resource is covered without editing this list.
    const empty = Object.entries(ROUTES)
      .filter(([, group]) => ![...declaredRoutes(group)].some((route) => mounted.has(normalize(`${API_PREFIX}${route}`))))
      .map(([name]) => name);

    assert.deepEqual(empty, [], `resource groups with no mounted route: ${empty.join(', ')}`);
  });
});
