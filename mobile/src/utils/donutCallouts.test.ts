import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { groupDonutSlices, layoutDonutCallouts, type DonutCalloutGeometry } from './donutCallouts.ts';

const GEOMETRY: DonutCalloutGeometry = {
  width: 300,
  minHeight: 200,
  ringOuter: 80,
  radial: 8,
  column: 110,
  labelHeight: 36,
};

describe('layoutDonutCallouts', () => {
  it('points each callout at its slice middle, on the side the slice sits', () => {
    const {
      height,
      callouts: [right, left],
    } = layoutDonutCallouts(
      [
        { id: 'a', percentage: 50 },
        { id: 'b', percentage: 50 },
      ],
      GEOMETRY,
    );
    assert.equal(height, 200);
    assert.equal(right!.id, 'a');
    assert.equal(right!.side, 'right');
    // a's middle is three o'clock, b's nine o'clock.
    assert.ok(Math.abs(right!.tip.x - 230) < 1e-9 && Math.abs(right!.tip.y - 100) < 1e-9);
    assert.equal(right!.end.x, 260);
    assert.equal(left!.id, 'b');
    assert.equal(left!.side, 'left');
    assert.ok(Math.abs(left!.tip.x - 70) < 1e-9);
    assert.equal(left!.end.x, 40);
  });

  it('labels every slice however small, skipping only a zero one', () => {
    const { callouts } = layoutDonutCallouts(
      [
        { id: 'tiny', percentage: 1 },
        { id: 'none', percentage: 0 },
        { id: 'big', percentage: 99 },
      ],
      GEOMETRY,
    );
    assert.deepEqual(callouts.map((callout) => callout.id).sort(), ['big', 'tiny']);
  });

  it('grows the canvas so every label fits, apart and inside it', () => {
    const slices = Array.from({ length: 20 }, (_, index) => ({ id: `s${index}`, percentage: 5 }));
    const { height, callouts } = layoutDonutCallouts(slices, GEOMETRY);
    assert.equal(callouts.length, 20);
    assert.ok(height > GEOMETRY.minHeight);
    for (const side of ['left', 'right'] as const) {
      const ys = callouts
        .filter((callout) => callout.side === side)
        .map((callout) => callout.end.y)
        .sort((a, b) => a - b);
      for (let index = 1; index < ys.length; index += 1) assert.ok(ys[index]! - ys[index - 1]! >= GEOMETRY.labelHeight - 1e-9);
      for (const y of ys) assert.ok(y >= GEOMETRY.labelHeight / 2 - 1e-9 && y <= height - GEOMETRY.labelHeight / 2 + 1e-9);
    }
  });
});

describe('groupDonutSlices', () => {
  const slice = (id: string, percentage: number) => ({ id, percentage });

  it('keeps the largest three, biggest first, and sums the rest as others', () => {
    const { top, othersPercentage } = groupDonutSlices(
      [slice('a', 5), slice('b', 40), slice('c', 10), slice('d', 30), slice('e', 15)],
      3,
    );
    assert.deepEqual(top.map((entry) => entry.id), ['b', 'd', 'e']);
    assert.equal(othersPercentage, 15);
  });

  it('keeps a lone leftover under its own name rather than an Others of one', () => {
    const { top, othersPercentage } = groupDonutSlices([slice('a', 50), slice('b', 30), slice('c', 15), slice('d', 5)], 3);
    assert.deepEqual(top.map((entry) => entry.id), ['a', 'b', 'c', 'd']);
    assert.equal(othersPercentage, 0);
  });
});
