/** The colour properties a theme switch changes, interpolated by Reanimated's native CSS transitions. */
const THEMED_COLOR_PROPERTIES = [
  'backgroundColor',
  'borderColor',
  'borderTopColor',
  'borderBottomColor',
  'borderLeftColor',
  'borderRightColor',
  'color',
  'shadowColor',
] as const;

export const COLOR_TRANSITION_MS = 200;

/**
 * Spread into the style of a Reanimated component so its colours ease to new values instead of jumping, on a theme
 * switch or any other colour change. Plain `View`/`Text` ignore these keys, which is why the themed primitives exist.
 */
export interface ColorTransition {
  transitionProperty: (typeof THEMED_COLOR_PROPERTIES)[number][];
  transitionDuration: number;
  transitionTimingFunction: 'ease-in-out';
}

export function buildColorTransition(durationMs: number): ColorTransition {
  return {
    transitionProperty: [...THEMED_COLOR_PROPERTIES],
    transitionDuration: durationMs,
    transitionTimingFunction: 'ease-in-out',
  };
}

export interface Motion {
  colorTransition: ColorTransition;
  colorTransitionMs: number;
}

export function buildMotion(reduceMotion: boolean): Motion {
  const colorTransitionMs = reduceMotion ? 0 : COLOR_TRANSITION_MS;
  return { colorTransition: buildColorTransition(colorTransitionMs), colorTransitionMs };
}
