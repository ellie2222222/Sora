/**
 * Math helpers for pull-to-refresh interactions.
 * Kept pure and framework-independent for robust unit testing.
 */

export const DEFAULT_PULL_THRESHOLD = 110; // px (generous pull length to reach trigger & 360° rotation)
const RESISTANCE_FACTOR = 0.5; // damping ratio past threshold
const HIDDEN_TRANSLATE_Y = -52; // resting hidden offset above screen
const RESTING_TRANSLATE_Y = 37; // resting visible position while refreshing

export function clamp(value: number, min: number, max: number): number {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

export function calculatePullProgress(pullDistance: number, threshold = DEFAULT_PULL_THRESHOLD): number {
  'worklet';
  if (threshold <= 0) return 0;
  return clamp(pullDistance / threshold, 0, 1);
}

export function calculatePullRotation(pullDistance: number, threshold = DEFAULT_PULL_THRESHOLD): number {
  'worklet';
  const progress = calculatePullProgress(pullDistance, threshold);
  return progress * 360;
}

/**
 * Applies physical resistance to the raw drag distance:
 * - 1:1 visual movement before the threshold.
 * - Dampened movement (0.5x) past the threshold.
 */
export function calculatePullDistanceWithResistance(
  rawDistance: number,
  threshold = DEFAULT_PULL_THRESHOLD,
  resistance = RESISTANCE_FACTOR,
): number {
  'worklet';
  if (rawDistance <= 0) return 0;
  if (rawDistance <= threshold) {
    return rawDistance;
  }
  return threshold + (rawDistance - threshold) * resistance;
}

/** Moves from `HIDDEN_TRANSLATE_Y` (-52px) to `RESTING_TRANSLATE_Y` (37px) as the pull reaches `threshold`. */
export function calculateIndicatorTranslateY(
  distance: number,
  threshold = DEFAULT_PULL_THRESHOLD,
): number {
  'worklet';
  if (distance <= 0) return HIDDEN_TRANSLATE_Y;
  const progress = calculatePullProgress(distance, threshold);
  return HIDDEN_TRANSLATE_Y + (RESTING_TRANSLATE_Y - HIDDEN_TRANSLATE_Y) * progress;
}
