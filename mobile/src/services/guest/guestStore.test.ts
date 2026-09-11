import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { GuestStore, emptyUploadProgress, type GuestData } from './guestStore.ts';
import { memoryPersistence } from './testSupport.ts';

function walletOf(name: string) {
  return { id: 'w1', name, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' };
}

describe('GuestStore.hydrate', () => {
  it('starts empty when nothing was persisted', async () => {
    const store = new GuestStore(memoryPersistence());
    const data = await store.hydrate();

    assert.equal(data.wallet, null);
    assert.deepEqual(data.accounts, []);
    assert.equal(store.hasData(), false);
  });

  it('reads back what a previous run persisted', async () => {
    const persistence = memoryPersistence();
    const first = new GuestStore(persistence);
    await first.hydrate();
    await first.mutate((data) => ({ ...data, wallet: walletOf('Mine') }));

    const second = new GuestStore(persistence);
    const data = await second.hydrate();

    assert.equal(data.wallet?.name, 'Mine');
    assert.equal(second.hasData(), true);
  });

  it('is a no-op once hydrated, so calling it from two places is safe', async () => {
    const persistence = memoryPersistence();
    const store = new GuestStore(persistence);
    await store.hydrate();
    await store.mutate((data) => ({ ...data, wallet: walletOf('Mine') }));

    // A second hydrate must not re-read and discard the in-memory mutation.
    const data = await store.hydrate();
    assert.equal(data.wallet?.name, 'Mine');
  });

  it('falls back to empty rather than throwing on a corrupt blob', async () => {
    const store = new GuestStore(memoryPersistence('{not json'));
    const data = await store.hydrate();

    assert.equal(data.wallet, null);
    assert.equal(store.hasData(), false);
  });

  /** A blob written before a field existed must not read back as undefined. */
  it('fills in fields a persisted older shape is missing', async () => {
    const store = new GuestStore(memoryPersistence(JSON.stringify({ wallet: walletOf('Old') })));
    const data = await store.hydrate();

    assert.equal(data.wallet?.name, 'Old');
    assert.deepEqual(data.transactions, []);
    assert.deepEqual(data.goals, []);
    assert.equal(data.uploadProgress, null);
  });
});

describe('GuestStore.mutate', () => {
  it('persists on every mutation, so memory and storage cannot diverge', async () => {
    const persistence = memoryPersistence();
    const store = new GuestStore(persistence);
    await store.hydrate();

    await store.mutate((data) => ({ ...data, wallet: walletOf('One') }));
    await store.mutate((data) => ({ ...data, uploadProgress: emptyUploadProgress('target') }));

    assert.equal(persistence.saves, 2);
    const persisted = JSON.parse(persistence.raw() as string) as GuestData;
    assert.equal(persisted.wallet?.name, 'One');
    assert.equal(persisted.uploadProgress?.walletId, 'target');
  });
});

describe('GuestStore.clear', () => {
  it('empties memory and storage together', async () => {
    const persistence = memoryPersistence();
    const store = new GuestStore(persistence);
    await store.hydrate();
    await store.mutate((data) => ({ ...data, wallet: walletOf('One') }));

    await store.clear();

    assert.equal(store.hasData(), false);
    assert.equal(persistence.raw(), null);
  });

  it('leaves the store hydrated, so a later read does not resurrect the blob', async () => {
    const persistence = memoryPersistence();
    const store = new GuestStore(persistence);
    await store.hydrate();
    await store.mutate((data) => ({ ...data, wallet: walletOf('One') }));
    await store.clear();

    const data = await store.hydrate();
    assert.equal(data.wallet, null);
  });
});

describe('GuestStore.subscribe', () => {
  it('fires on hydrate, mutate and clear, and stops after unsubscribe', async () => {
    const store = new GuestStore(memoryPersistence());
    const seen: (string | null)[] = [];
    const unsubscribe = store.subscribe((data) => seen.push(data.wallet?.name ?? null));

    await store.hydrate();
    await store.mutate((data) => ({ ...data, wallet: walletOf('One') }));
    await store.clear();

    unsubscribe();
    await store.mutate((data) => ({ ...data, wallet: walletOf('After') }));

    assert.deepEqual(seen, [null, 'One', null]);
  });
});

describe('GuestStore.setPersistence', () => {
  it('returns to a pre-hydration state against the new store', async () => {
    const store = new GuestStore(memoryPersistence());
    await store.hydrate();
    await store.mutate((data) => ({ ...data, wallet: walletOf('One') }));

    store.setPersistence(memoryPersistence());
    assert.equal(store.hasData(), false);

    const data = await store.hydrate();
    assert.equal(data.wallet, null);
  });
});
