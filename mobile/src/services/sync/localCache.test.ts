import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { cacheKeyOf, LocalCache, maskEmail, MAX_CACHED_RESPONSES, memoryLocalCacheDb, savesForCacheEntry } from './localCache.ts';

describe('cacheKeyOf', () => {
  it('ignores argument key order and undefined fields, so a read and a patch agree', () => {
    assert.equal(cacheKeyOf('listTransactions', { walletId: 'w', accountId: undefined, type: 'EXPENSE' }, 1),
      cacheKeyOf('listTransactions', { type: 'EXPENSE', walletId: 'w' }, 1));
  });

  it('separates endpoints, arguments and pages', () => {
    const keys = new Set([
      cacheKeyOf('listWallets', undefined),
      cacheKeyOf('getWallet', 'w1'),
      cacheKeyOf('getWallet', 'w2'),
      cacheKeyOf('listTransactions', { walletId: 'w1' }, 1),
      cacheKeyOf('listTransactions', { walletId: 'w1' }, 2),
    ]);
    assert.equal(keys.size, 5);
  });
});

describe('LocalCache', () => {
  it("returns only the current account's saved responses", async () => {
    const cache = new LocalCache(memoryLocalCacheDb());
    cache.setOwner('user-a');
    await cache.save('k', { balance: '10.0000' });

    cache.setOwner('user-b');
    assert.equal(await cache.load('k'), undefined);

    cache.setOwner('user-a');
    assert.deepEqual(await cache.load('k'), { balance: '10.0000' });
  });

  it('saves a read under the account that started it, even if another signs in meanwhile', async () => {
    const cache = new LocalCache(memoryLocalCacheDb());
    cache.setOwner('user-a');
    const inFlight = cache.entry<string>('k');

    cache.setOwner('user-b');
    await inFlight.save("a's response");
    assert.equal(await cache.load('k'), undefined);

    cache.setOwner('user-a');
    assert.equal(await cache.load('k'), "a's response");
  });

  it('reports the oldest saved copy on screen until each read is answered fresh', async () => {
    let now = '2026-09-25T08:00:00.000Z';
    const cache = new LocalCache(memoryLocalCacheDb(), () => now);
    cache.setOwner('user-a');
    await cache.entry('accounts').save(['saved at 8']);
    now = '2026-09-25T09:00:00.000Z';
    await cache.entry('dashboard').save({ saved: 9 });
    let notified = 0;
    cache.subscribe(() => (notified += 1));

    await cache.entry('dashboard').load();
    await cache.entry('accounts').load();
    assert.equal(cache.oldestShownSavedAt(), '2026-09-25T08:00:00.000Z');

    await cache.entry('accounts').save(['fresh']);
    assert.equal(cache.oldestShownSavedAt(), '2026-09-25T09:00:00.000Z');
    await cache.entry('dashboard').save({ fresh: true });
    assert.equal(cache.oldestShownSavedAt(), null);
    assert.equal(notified, 4);
  });

  it('forgets what was on screen when the account changes or everything is refetched', async () => {
    const cache = new LocalCache(memoryLocalCacheDb());
    cache.setOwner('user-a');
    await cache.entry('k').save(1);
    await cache.entry('k').load();
    cache.setOwner('user-b');
    assert.equal(cache.oldestShownSavedAt(), null);

    cache.setOwner('user-a');
    await cache.entry('k').load();
    cache.clearShownSavedCopies();
    assert.equal(cache.oldestShownSavedAt(), null);
  });

  it('keeps nothing and reads nothing while signed out', async () => {
    const db = memoryLocalCacheDb();
    const cache = new LocalCache(db);
    await cache.save('k', 1);
    assert.equal(await cache.load('k'), undefined);
    assert.deepEqual(await db.ownersWithCache(), []);
  });

  it('drops the oldest responses beyond the cap', async () => {
    let tick = 0;
    const cache = new LocalCache(memoryLocalCacheDb(), () => new Date(1_800_000_000_000 + tick++).toISOString());
    cache.setOwner('user-a');
    for (let i = 0; i <= MAX_CACHED_RESPONSES; i++) await cache.save(`k${i}`, i);
    assert.equal(await cache.load('k0'), undefined);
    assert.equal(await cache.load(`k${MAX_CACHED_RESPONSES}`), MAX_CACHED_RESPONSES);
  });

  it('names other accounts that still have saved reads or unsynced writes here', async () => {
    const cache = new LocalCache(memoryLocalCacheDb());
    await cache.rememberAccount({ userId: 'user-a', email: 'alice@example.invalid' });
    await cache.rememberAccount({ userId: 'user-b', email: 'bob@example.invalid' });
    await cache.rememberAccount({ userId: 'user-c', email: 'carol@example.invalid' });
    cache.setOwner('user-a');
    await cache.save('k', 1);

    const others = await cache.otherAccountsWithData('user-b', ['user-c']);
    assert.deepEqual(others.map((account) => account.userId).sort(), ['user-a', 'user-c']);
    assert.deepEqual(await cache.otherAccountsWithData('user-a', []), []);
  });
});

describe('savesForCacheEntry', () => {
  it('saves each loaded page of an infinite query under its page key', () => {
    const saves = savesForCacheEntry({
      endpointName: 'listTransactions',
      originalArgs: { walletId: 'w' },
      data: { pages: [{ items: [1] }, { items: [2] }], pageParams: [1, 2] },
    });
    assert.deepEqual(saves.map((save) => save.key), [
      cacheKeyOf('listTransactions', { walletId: 'w' }, 1),
      cacheKeyOf('listTransactions', { walletId: 'w' }, 2),
    ]);
  });

  it('saves a plain query once and skips an entry with no data', () => {
    assert.deepEqual(savesForCacheEntry({ endpointName: 'listAccounts', originalArgs: { walletId: 'w' }, data: [] }), [
      { key: cacheKeyOf('listAccounts', { walletId: 'w' }), value: [] },
    ]);
    assert.deepEqual(savesForCacheEntry({ endpointName: 'listAccounts', originalArgs: {} }), []);
  });
});

describe('maskEmail', () => {
  it('keeps the first letter and the domain', () => {
    assert.equal(maskEmail('alice@example.invalid'), 'a•••@example.invalid');
    assert.equal(maskEmail('broken'), '•••');
  });
});
