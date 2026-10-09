import { Fragment, useLayoutEffect, useRef, type ReactNode } from 'react';
import { useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';

export interface SlideSwapProps {
  /**
   * Identity *and* order of whatever is currently shown — a segment's ordinal,
   * a calendar day. Moving forward slides the new pane in from the right, back
   * from the left, so the direction tracks which way the switcher moved.
   */
  swapKey: string | number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Travel, in px. Defaults to a fraction of the screen width — see `TRAVEL_RATIO`. */
  distance?: number;
  testID?: string;
}

/**
 * Far enough that the eye reads travel rather than a jump, short of a full-width
 * slide, which over this duration would have to move fast enough to read as a flick.
 */
const TRAVEL_RATIO = 0.45;

/**
 * Slides its children in whenever `swapKey` changes, for a pane that would
 * otherwise be swapped instantly. Horizontal only: no fade, and a pane inside it
 * wants `entrance="none"` on its own animations, or the two transforms compose
 * into a diagonal.
 *
 * The subtree is keyed on `swapKey` so each pane mounts fresh: two panes that
 * happen to render the same component (two `StateView`s, say) would otherwise be
 * reconciled into one instance carrying the previous pane's state.
 */
export function SlideSwap({ swapKey, children, style, distance, testID }: SlideSwapProps) {
  const translateX = useSwapOffset(swapKey, distance);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Animated.View testID={testID} style={[animatedStyle, style]}>
      <Fragment key={swapKey}>{children}</Fragment>
    </Animated.View>
  );
}

/**
 * SlideSwap's horizontal offset on its own, for content no single view can wrap — a list's rows
 * scrolling under a header that must stay put. Each piece applies it as `translateX`.
 */
export function useSwapOffset(swapKey: string | number, distance?: number): SharedValue<number> {
  const { width } = useWindowDimensions();
  const travel = distance ?? Math.round(width * TRAVEL_RATIO);
  const previousKey = useRef(swapKey);
  const translateX = useSharedValue(0);

  // The offset must be committed before the frame is drawn: applied after paint,
  // the pane shows once at rest, then jumps aside, which reads as the wrong direction.
  useLayoutEffect(() => {
    if (previousKey.current === swapKey) return;

    const from = swapKey > previousKey.current ? travel : -travel;
    previousKey.current = swapKey;

    translateX.value = from;
    // Timing, not a spring: it decelerates into place and stops dead, where even
    // a critically damped spring keeps creeping toward its target.
    translateX.value = withTiming(0, { duration: 260, easing: Easing.out(Easing.cubic) });
  }, [swapKey, travel, translateX]);

  return translateX;
}
