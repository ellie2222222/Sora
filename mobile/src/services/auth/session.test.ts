import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import type { AuthTokens } from '@finance/contracts';

import {
  SessionManager,
  type SessionPersistence,
  type StoredSession,
} from './session.ts';

function memoryPersistence(initial: StoredSession | null = null): SessionPersistence & {
  saved: StoredSession[];
  clears: number;
} {
  let current = initial;
  const saved: StoredSession[] = [];
  let clears = 0;

  return {
    saved,
    get clears() {
      return clears;
    },
    async load() {
      return current;
    },
    async save(session) {
      current = session;
      saved.push(session);
    },
    async clear() {
      current = null;
      clears += 1;
    },
  };
}

function tokens(suffix: string, expiresIn = 900): AuthTokens {
  return {
    accessToken: `access-${suffix}`,
    refreshToken: `refresh-${suffix}`,
    expiresIn,
  };
}

/** A refresh that never settles until released, so overlap is observable. */
function deferredRefresh() {
  let calls = 0;
  let release: ((value: AuthTokens) => void) | undefined;
  let fail: ((reason: Error) => void) | undefined;

  const refresh = (): Promise<AuthTokens> => {
    calls += 1;
    return new Promise<AuthTokens>((resolve, reject) => {
      release = resolve;
      fail = reject;
    });
  };

  return {
    refresh,
    get calls() {
      return calls;
    },
    resolve(suffix: string) {
      release?.(tokens(suffix));
    },
    reject(message: string) {
      fail?.(new Error(message));
    },
  };
}

const FIXED_NOW = 1_800_000_000_000;

describe('SessionManager.adopt', () => {
  it('derives an absolute expiry from the relative expiresIn', async () => {
    const persistence = memoryPersistence();
    const manager = new SessionManager({
      persistence,
      refresh: async () => tokens('unused'),
      now: () => FIXED_NOW,
    });

    const stored = await manager.adopt(tokens('a', 900));

    assert.equal(stored.expiresAt, FIXED_NOW + 900_000);
    assert.equal(manager.getAccessToken(), 'access-a');
    assert.equal(persistence.saved.length, 1);
  });

  it('treats a token as expired before it truly lapses', async () => {
    let clock = FIXED_NOW;
    const manager = new SessionManager({
      persistence: memoryPersistence(),
      refresh: async () => tokens('unused'),
      now: () => clock,
    });

    await manager.adopt(tokens('a', 60));
    assert.equal(manager.isAccessTokenFresh(), true);

    // 40s in: 20s of real life left, but inside the 30s skew, so already stale.
    clock = FIXED_NOW + 40_000;
    assert.equal(
      manager.isAccessTokenFresh(),
      false,
      'the skew must retire a token before it can lapse mid-flight',
    );
  });
});

describe('SessionManager.refreshTokens — single flight', () => {
  it('sends ONE refresh for many concurrent callers', async () => {
    const deferred = deferredRefresh();
    const manager = new SessionManager({
      persistence: memoryPersistence(),
      refresh: deferred.refresh,
      now: () => FIXED_NOW,
    });
    await manager.adopt(tokens('a'));

    const waiters = [
      manager.refreshTokens(),
      manager.refreshTokens(),
      manager.refreshTokens(),
      manager.refreshTokens(),
      manager.refreshTokens(),
    ];

    // The whole point: the API revokes the entire token family when a
    // single-use refresh token is replayed, so a second request here would sign
    // the user out of every device.
    assert.equal(deferred.calls, 1, 'five concurrent 401s must produce one refresh');

    deferred.resolve('b');
    const results = await Promise.all(waiters);

    for (const result of results) {
      assert.equal(result?.accessToken, 'access-b');
    }
    assert.equal(deferred.calls, 1);
  });

  it('hands every concurrent caller the identical session object', async () => {
    const deferred = deferredRefresh();
    const manager = new SessionManager({
      persistence: memoryPersistence(),
      refresh: deferred.refresh,
      now: () => FIXED_NOW,
    });
    await manager.adopt(tokens('a'));

    const first = manager.refreshTokens();
    const second = manager.refreshTokens();
    deferred.resolve('b');

    assert.equal(await first, await second);
  });

  it('releases the latch so a later 401 can refresh again', async () => {
    const deferred = deferredRefresh();
    const manager = new SessionManager({
      persistence: memoryPersistence(),
      refresh: deferred.refresh,
      now: () => FIXED_NOW,
    });
    await manager.adopt(tokens('a'));

    const first = manager.refreshTokens();
    deferred.resolve('b');
    await first;

    void manager.refreshTokens();
    assert.equal(deferred.calls, 2, 'a settled latch must not answer future refreshes');
  });

  it('releases the latch after a FAILED refresh too', async () => {
    const deferred = deferredRefresh();
    const manager = new SessionManager({
      persistence: memoryPersistence(),
      refresh: deferred.refresh,
      now: () => FIXED_NOW,
    });
    await manager.adopt(tokens('a'));

    const first = manager.refreshTokens();
    deferred.reject('refresh rejected');
    assert.equal(await first, null);

    // A rejected promise left in the latch would answer every future refresh
    // forever, stranding the app signed-out-but-not-cleared.
    await manager.adopt(tokens('c'));
    void manager.refreshTokens();
    assert.equal(deferred.calls, 2);
  });

  it('clears the session when the refresh fails, so the app can send the user to login', async () => {
    const persistence = memoryPersistence();
    const manager = new SessionManager({
      persistence,
      refresh: async () => {
        throw new Error('token replayed');
      },
      now: () => FIXED_NOW,
    });
    await manager.adopt(tokens('a'));

    assert.equal(await manager.refreshTokens(), null);
    assert.equal(manager.current(), null);
    assert.equal(manager.getAccessToken(), null);
    assert.equal(persistence.clears, 1);
  });

  it('does not attempt a refresh with no session at all', async () => {
    const deferred = deferredRefresh();
    const manager = new SessionManager({
      persistence: memoryPersistence(),
      refresh: deferred.refresh,
      now: () => FIXED_NOW,
    });

    assert.equal(await manager.refreshTokens(), null);
    assert.equal(deferred.calls, 0, 'there is no refresh token to send');
  });
});

describe('SessionManager.restore', () => {
  it('reads a persisted session so a relaunch stays signed in', async () => {
    const persisted: StoredSession = {
      accessToken: 'access-stored',
      refreshToken: 'refresh-stored',
      expiresAt: FIXED_NOW + 600_000,
    };
    const manager = new SessionManager({
      persistence: memoryPersistence(persisted),
      refresh: async () => tokens('unused'),
      now: () => FIXED_NOW,
    });

    assert.equal(await manager.restore(), persisted);
    assert.equal(manager.getAccessToken(), 'access-stored');
    assert.equal(manager.isAccessTokenFresh(), true);
  });

  it('restores an already-expired session as not fresh rather than discarding it', async () => {
    const manager = new SessionManager({
      persistence: memoryPersistence({
        accessToken: 'access-old',
        refreshToken: 'refresh-old',
        expiresAt: FIXED_NOW - 1,
      }),
      refresh: async () => tokens('unused'),
      now: () => FIXED_NOW,
    });

    await manager.restore();
    assert.equal(manager.isAccessTokenFresh(), false);
    // The refresh token may well still be valid, so the session is kept and the
    // interceptor gets its chance to exchange it.
    assert.notEqual(manager.current(), null);
  });
});

describe('SessionManager.subscribe', () => {
  it('notifies on adopt and on clear, and stops after unsubscribe', async () => {
    const manager = new SessionManager({
      persistence: memoryPersistence(),
      refresh: async () => tokens('unused'),
      now: () => FIXED_NOW,
    });

    const seen: (string | null)[] = [];
    const unsubscribe = manager.subscribe((s) => seen.push(s?.accessToken ?? null));

    await manager.adopt(tokens('a'));
    await manager.clear();
    unsubscribe();
    await manager.adopt(tokens('b'));

    assert.deepEqual(seen, ['access-a', null]);
  });
});
