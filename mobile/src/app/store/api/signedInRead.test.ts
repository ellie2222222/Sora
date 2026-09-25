import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { readSignedIn } from './signedInRead.ts';

const networkFailure = Object.assign(new Error('Network Error'), { network: true });
const isNetwork = (error: unknown) => (error as { network?: boolean }).network === true;

describe('readSignedIn', () => {
  it('returns the API result and marks the device online', async () => {
    const flags: boolean[] = [];
    assert.equal(await readSignedIn(async () => 'server', (v) => flags.push(v), isNetwork), 'server');
    assert.deepEqual(flags, [true]);
  });

  it('rethrows a network failure after marking the device offline, never reading elsewhere', async () => {
    const flags: boolean[] = [];
    await assert.rejects(readSignedIn(async () => { throw networkFailure; }, (v) => flags.push(v), isNetwork), networkFailure);
    assert.deepEqual(flags, [false]);
  });

  it('rethrows a server error without touching the online flag', async () => {
    const flags: boolean[] = [];
    const serverError = new Error('500');
    await assert.rejects(readSignedIn(async () => { throw serverError; }, (v) => flags.push(v), isNetwork), serverError);
    assert.deepEqual(flags, []);
  });
});

describe('readSignedIn with a saved copy', () => {
  function memoryCache<T>(initial?: T) {
    let value = initial;
    return {
      async load() {
        return value;
      },
      async save(next: T) {
        value = next;
      },
    };
  }

  it('saves every successful response', async () => {
    const cache = memoryCache<string>();
    await readSignedIn(async () => 'fresh', () => undefined, isNetwork, cache);
    assert.equal(await cache.load(), 'fresh');
  });

  it('answers a network failure from the saved copy', async () => {
    const cache = memoryCache('saved');
    assert.equal(await readSignedIn(async () => { throw networkFailure; }, () => undefined, isNetwork, cache), 'saved');
  });

  it('still rethrows a server error even when a saved copy exists', async () => {
    const cache = memoryCache('saved');
    const serverError = new Error('500');
    await assert.rejects(readSignedIn(async () => { throw serverError; }, () => undefined, isNetwork, cache), serverError);
  });

  it('returns the response even if saving it fails', async () => {
    const cache = { load: async () => undefined, save: async () => { throw new Error('disk full'); } };
    assert.equal(await readSignedIn(async () => 'fresh', () => undefined, isNetwork, cache), 'fresh');
  });
});
