import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { inlineAccounts, overflowsScopeRow } from './accountScope.ts';

const accounts = (count: number) => Array.from({ length: count }, (_, index) => ({ id: `a${index + 1}` }));
const ids = (items: { id: string }[]) => items.map((item) => item.id);

describe('inlineAccounts', () => {
  it('shows every account while they fit, with no overflow', () => {
    assert.equal(overflowsScopeRow(3), false);
    assert.deepEqual(ids(inlineAccounts(accounts(3), 'a3')), ['a1', 'a2', 'a3']);
  });

  it('keeps the first two once there are more', () => {
    assert.equal(overflowsScopeRow(4), true);
    assert.deepEqual(ids(inlineAccounts(accounts(7), null)), ['a1', 'a2']);
    assert.deepEqual(ids(inlineAccounts(accounts(7), 'a2')), ['a1', 'a2']);
  });

  it('puts a selection from the overflow in the last slot', () => {
    assert.deepEqual(ids(inlineAccounts(accounts(7), 'a5')), ['a1', 'a5']);
  });

  it('ignores a selection that is not in the list, such as an archived account', () => {
    assert.deepEqual(ids(inlineAccounts(accounts(7), 'gone')), ['a1', 'a2']);
  });
});
