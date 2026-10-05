export const radius = {
  none: 0,
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  xxl: 28,
  pill: 999,
} as const;

export type Radius = typeof radius;

/**
 * Radius of a shape nested in a rounded one, so the two curves stay concentric: the outer radius
 * minus every border and padding between them, floored at 0 (DESIGN_GUIDELINES, Radius).
 */
export function concentricRadius(outer: number, ...insets: number[]): number {
  return Math.max(radius.none, insets.reduce((remaining, inset) => remaining - inset, outer));
}
