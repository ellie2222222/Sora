import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { borderWidth } from './sizes.ts';
import { concentricRadius, radius } from './radius.ts';
import { spacing } from './spacing.ts';

describe('concentricRadius', () => {
  it('subtracts the border width from the outer radius', () => {
    assert.equal(concentricRadius(12, 2), 10);
  });

  it('subtracts border and padding together, as a segmented control nests its segments', () => {
    assert.equal(concentricRadius(radius.md, borderWidth.thin, spacing.xxs), 7);
  });

  it('is the outer radius when nothing sits between the two shapes', () => {
    assert.equal(concentricRadius(radius.lg), radius.lg);
  });

  it('floors at 0 rather than going negative', () => {
    assert.equal(concentricRadius(radius.xs, spacing.md), 0);
  });
});
