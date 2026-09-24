/**
 * Math helpers for pull-to-refresh interactions.
 * Kept pure and framework-independent for robust unit testing.
 */

export const DEFAULT_PULL_THRESHOLD = 110; // px of visible pull that commits a refresh on release
/** How far the pull can travel, as a multiple of the threshold — the rubber band's asymptote. */
export const DEFAULT_MAX_PULL_FACTOR = 2.5;
const HIDDEN_TRANSLATE_Y = -52; // resting hidden offset above screen
const RESTING_TRANSLATE_Y = 37; // resting visible position while refreshing
/** Past the threshold the indicator keeps following the pull, at this fraction of its travel. */
const OVERPULL_INDICATOR_RATIO = 0.5;

export function clamp(value: number, min: number, max: number): number {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

export function calculatePullProgress(pullDistance: number, threshold = DEFAULT_PULL_THRESHOLD): number {
  'worklet';
  if (threshold <= 0) return 0;
  return clamp(pullDistance / threshold, 0, 1);
}

/** One full turn at the threshold, and it keeps turning with any pull beyond it. */
export function calculatePullRotation(pullDistance: number, threshold = DEFAULT_PULL_THRESHOLD): number {
  'worklet';
  if (threshold <= 0) return 0;
  return (Math.max(pullDistance, 0) / threshold) * 360;
}

/**
 * Rubber-band resistance: 1:1 at the start of the drag, easing smoothly toward `maxDistance`
 * without ever reaching it — no kink at the threshold, and no hard stop.
 */
export function rubberBandPull(rawDistance: number, maxDistance: number): number {
  'worklet';
  if (rawDistance <= 0 || maxDistance <= 0) return 0;
  return maxDistance * (1 - Math.exp(-rawDistance / maxDistance));
}

/** Inverse of `rubberBandPull`: the finger travel that produces a given visible pull. */
export function rawPullFor(distance: number, maxDistance: number): number {
  'worklet';
  if (distance <= 0 || maxDistance <= 0) return 0;
  return -maxDistance * Math.log(1 - Math.min(distance, maxDistance * 0.999) / maxDistance);
}

/** Moves from `HIDDEN_TRANSLATE_Y` to `RESTING_TRANSLATE_Y` as the pull reaches `threshold`, then keeps following it. */
export function calculateIndicatorTranslateY(
  distance: number,
  threshold = DEFAULT_PULL_THRESHOLD,
): number {
  'worklet';
  if (distance <= 0) return HIDDEN_TRANSLATE_Y;
  const progress = calculatePullProgress(distance, threshold);
  const overpull = Math.max(distance - threshold, 0) * OVERPULL_INDICATOR_RATIO;
  return HIDDEN_TRANSLATE_Y + (RESTING_TRANSLATE_Y - HIDDEN_TRANSLATE_Y) * progress + overpull;
}
