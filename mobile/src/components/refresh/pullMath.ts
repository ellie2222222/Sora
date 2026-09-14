/**
 * Math helpers for pull-to-refresh interactions.
 * Kept pure and framework-independent for robust unit testing.
 */

export const DEFAULT_PULL_THRESHOLD = 110; // px (generous pull length to reach trigger & 360° rotation)
export const RESISTANCE_FACTOR = 0.5; // damping ratio past threshold
export const HIDDEN_TRANSLATE_Y = -52; // resting hidden offset above screen
export const RESTING_TRANSLATE_Y = 37; // resting visible position while refreshing

/**
 * Clamps a number between min and max bounds.
 */
export function clamp(value: number, min: number, max: number): number {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

/**
 * Calculates normalized pull progress [0, 1] based on drag distance and threshold.
 */
export function calculatePullProgress(pullDistance: number, threshold = DEFAULT_PULL_THRESHOLD): number {
  'worklet';
  if (threshold <= 0) return 0;
  return clamp(pullDistance / threshold, 0, 1);
}

/**
 * Calculates icon rotation in degrees (0° to 360°).
 * - Rotates continuously as user pulls down from 0 to threshold.
 * - Stops spinning at max length (360° at threshold).
 */
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

/**
 * Calculates vertical translation (translateY) for the indicator:
 * - Moves smoothly from HIDDEN_TRANSLATE_Y (-52px) to RESTING_TRANSLATE_Y (32px).
 * - Reaches RESTING_TRANSLATE_Y at max drag length (threshold).
 */
export function calculateIndicatorTranslateY(
  distance: number,
  threshold = DEFAULT_PULL_THRESHOLD,
): number {
  'worklet';
  if (distance <= 0) return HIDDEN_TRANSLATE_Y;
  const progress = calculatePullProgress(distance, threshold);
  return HIDDEN_TRANSLATE_Y + (RESTING_TRANSLATE_Y - HIDDEN_TRANSLATE_Y) * progress;
}
