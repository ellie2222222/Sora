import { strict as assert } from 'node:assert';
import { beforeEach, describe, it } from 'node:test';

import { claimOpenSwipeRow, closeOpenSwipeRow, isOpenSwipeRow, releaseOpenSwipeRow, type SwipeRowHandle } from './openSwipeRow.ts';

function row() {
  const handle = { closed: 0, close: () => undefined } as SwipeRowHandle & { closed: number };
  handle.close = () => {
    handle.closed += 1;
  };
  return handle;
}

describe('openSwipeRow', () => {
  beforeEach(() => closeOpenSwipeRow());

  it('closes the previously open row when another opens', () => {
    const first = row();
    const second = row();

    claimOpenSwipeRow(first);
    claimOpenSwipeRow(second);

    assert.equal(first.closed, 1);
    assert.equal(second.closed, 0);
    assert.equal(isOpenSwipeRow(second), true);
  });

  it('does not close a row that re-claims itself', () => {
    const only = row();

    claimOpenSwipeRow(only);
    claimOpenSwipeRow(only);

    assert.equal(only.closed, 0);
  });

  it('a late release from an older row keeps the newer claim', () => {
    const first = row();
    const second = row();

    claimOpenSwipeRow(first);
    claimOpenSwipeRow(second);
    releaseOpenSwipeRow(first);

    assert.equal(isOpenSwipeRow(second), true);
  });

  it('closeOpenSwipeRow closes the open row once and forgets it', () => {
    const only = row();

    claimOpenSwipeRow(only);
    closeOpenSwipeRow();
    closeOpenSwipeRow();

    assert.equal(only.closed, 1);
    assert.equal(isOpenSwipeRow(only), false);
  });
});
