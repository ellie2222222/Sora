import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { isCurrentlyOnline, onOnlineChange, setCurrentlyOnline } from './networkState.ts';

describe('networkState', () => {
  it('tells listeners about each change once, never about a repeat', () => {
    const seen: boolean[] = [];
    const unsubscribe = onOnlineChange((online) => seen.push(online));
    setCurrentlyOnline(true);
    setCurrentlyOnline(false);
    setCurrentlyOnline(false);
    setCurrentlyOnline(true);
    unsubscribe();
    setCurrentlyOnline(false);
    assert.deepEqual(seen, [false, true]);
    assert.equal(isCurrentlyOnline(), false);
    setCurrentlyOnline(true);
  });
});
