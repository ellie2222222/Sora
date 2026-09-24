import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  calculateIndicatorTranslateY,
  calculatePullRotation,
  DEFAULT_MAX_PULL_FACTOR,
  DEFAULT_PULL_THRESHOLD,
  rawPullFor,
  rubberBandPull,
} from './pullMath.ts';

const MAX = DEFAULT_PULL_THRESHOLD * DEFAULT_MAX_PULL_FACTOR;

describe('rubberBandPull', () => {
  it('tracks the finger closely at the start of the drag', () => {
    assert.ok(Math.abs(rubberBandPull(10, MAX) - 10) < 0.25);
  });

  it('keeps growing past the threshold but never reaches the maximum', () => {
    const atThreshold = rubberBandPull(rawPullFor(DEFAULT_PULL_THRESHOLD, MAX), MAX);
    const farther = rubberBandPull(rawPullFor(DEFAULT_PULL_THRESHOLD, MAX) + 200, MAX);
    assert.ok(farther > atThreshold);
    assert.ok(rubberBandPull(10_000, MAX) < MAX);
  });

  it('has no negative pull', () => {
    assert.equal(rubberBandPull(-20, MAX), 0);
  });
});

describe('rawPullFor', () => {
  it('inverts rubberBandPull, so a drag grabbed mid spring-back resumes where it is', () => {
    for (const distance of [5, 60, DEFAULT_PULL_THRESHOLD, 200]) {
      assert.ok(Math.abs(rubberBandPull(rawPullFor(distance, MAX), MAX) - distance) < 1e-6);
    }
  });
});

describe('indicator motion', () => {
  it('keeps moving and rotating past the threshold instead of stopping there', () => {
    const past = DEFAULT_PULL_THRESHOLD + 60;
    assert.ok(calculateIndicatorTranslateY(past) > calculateIndicatorTranslateY(DEFAULT_PULL_THRESHOLD));
    assert.ok(calculatePullRotation(past) > calculatePullRotation(DEFAULT_PULL_THRESHOLD));
  });

  it('completes exactly one turn at the threshold', () => {
    assert.equal(calculatePullRotation(DEFAULT_PULL_THRESHOLD), 360);
  });
});
