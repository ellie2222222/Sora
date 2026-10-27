import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { accountTintIndex } from './accountTint.ts';
import { assignCardSkins } from './cardSkins.ts';

const account = (id: string, day: number) => ({ id, createdAt: `2026-01-${String(day).padStart(2, '0')}T00:00:00.000Z` });

/** Ids whose hash lands on the same skin, so a collision is guaranteed rather than hoped for. */
function collidingIds(count: number, skinCount: number): string[] {
  const ids: string[] = [];
  for (let n = 0; ids.length < count; n++) {
    const id = `acc-${n}`;
    if (accountTintIndex(id, skinCount) === 0) ids.push(id);
  }
  return ids;
}

describe('assignCardSkins', () => {
  it('gives every account its own skin even when their ids hash to the same one', () => {
    const accounts = collidingIds(5, 10).map((id, index) => account(id, index + 1));
    const skins = assignCardSkins(accounts, 10);
    assert.equal(new Set(skins.values()).size, 5);
  });

  it('never recolours an older card when a newer account arrives', () => {
    const [first, second, third] = collidingIds(3, 10);
    const before = assignCardSkins([account(first!, 1), account(second!, 2)], 10);
    const after = assignCardSkins([account(third!, 3), account(second!, 2), account(first!, 1)], 10);
    assert.equal(after.get(first!), before.get(first!));
    assert.equal(after.get(second!), before.get(second!));
    assert.notEqual(after.get(third!), after.get(first!));
  });

  it('is the same whatever order the list arrives in', () => {
    const accounts = collidingIds(4, 10).map((id, index) => account(id, index + 1));
    assert.deepEqual(assignCardSkins(accounts, 10), assignCardSkins([...accounts].reverse(), 10));
  });

  it('repeats skins only once there are more accounts than skins', () => {
    const accounts = collidingIds(4, 3).map((id, index) => account(id, index + 1));
    const skins = assignCardSkins(accounts, 3);
    assert.equal(skins.size, 4);
    assert.equal(new Set(skins.values()).size, 3);
    assert.equal(assignCardSkins(accounts, 0).size, 0);
  });
});
