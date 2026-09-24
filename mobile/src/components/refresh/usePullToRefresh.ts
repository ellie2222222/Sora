import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import {
  calculateIndicatorTranslateY,
  calculatePullProgress,
  calculatePullRotation,
  DEFAULT_MAX_PULL_FACTOR,
  DEFAULT_PULL_THRESHOLD,
  rawPullFor,
  rubberBandPull,
} from './pullMath.ts';

export interface UsePullToRefreshOptions {
  refreshing: boolean;
  onRefresh: () => Promise<void> | void;
  /** Visible pull (px) that commits a refresh on release. */
  threshold?: number;
  /** How far the pull can travel (px); defaults to `threshold * DEFAULT_MAX_PULL_FACTOR`. */
  maxPullDistance?: number;
  disabled?: boolean;
}

/**
 * IDLE → PULLING ⇄ TRIGGERED (past the threshold) → release → REFRESHING → IDLE.
 * Releasing while PULLING springs straight back to IDLE.
 */
export const PullPhase = { IDLE: 0, PULLING: 1, TRIGGERED: 2, REFRESHING: 3 } as const;

const RETURN_SPRING = { damping: 18, stiffness: 180, mass: 0.9 } as const;
const ICON_TO_SPINNER_MS = 180;
const RETRACT_MS = 240;
const DRAG_DEADBAND_PX = 6;
/** Sideways travel that marks the touch as a horizontal swipe, never a pull. */
const HORIZONTAL_FAIL_PX = 14;
const AT_TOP_EPSILON_PX = 1;

/**
 * Drives only the indicator overlay — the list underneath is never transformed. The pan runs
 * alongside the list's native scroll gesture, so the list scrolls normally and the pull only
 * counts from the moment the list is at its top.
 */
export function usePullToRefresh({
  refreshing,
  onRefresh,
  threshold = DEFAULT_PULL_THRESHOLD,
  maxPullDistance = threshold * DEFAULT_MAX_PULL_FACTOR,
  disabled = false,
}: UsePullToRefreshOptions) {
  const phase = useSharedValue<number>(PullPhase.IDLE);
  /** Visible pull while dragging; parked at `threshold` (the loading position) while refreshing. */
  const pullDistance = useSharedValue(0);
  /** 0 = the refresh icon, 1 = the spinner. */
  const spinnerProgress = useSharedValue(0);
  const scrollY = useSharedValue(0);
  /** Finger translation at which the list was at its top; NaN until it gets there. */
  const pullAnchor = useSharedValue(Number.NaN);
  const rawBase = useSharedValue(0);
  const rawPull = useSharedValue(0);
  const [spinnerVisible, setSpinnerVisible] = useState(false);

  const refreshPending = useRef(false);
  const settled = useRef(false);
  const refreshingProp = useRef(refreshing);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const hideSpinner = useCallback(() => setSpinnerVisible(false), []);

  const finishRefreshing = useCallback(() => {
    phase.value = PullPhase.IDLE;
    settled.current = false;
    pullDistance.value = withTiming(0, { duration: RETRACT_MS, easing: Easing.out(Easing.cubic) }, () => {
      // Also when a new pull cuts the retraction short — it must show the icon again.
      if (phase.value === PullPhase.REFRESHING) return;
      spinnerProgress.value = 0;
      runOnJS(hideSpinner)();
    });
  }, [phase, pullDistance, spinnerProgress, hideSpinner]);

  // Completion needs the refresh done AND the indicator at its loading position, so the spinner is
  // always seen, however fast the refresh resolves.
  const finishIfSettled = useCallback(() => {
    if (
      phase.value === PullPhase.REFRESHING &&
      settled.current &&
      !refreshPending.current &&
      !refreshingProp.current
    ) {
      finishRefreshing();
    }
  }, [phase, finishRefreshing]);

  const markSettled = useCallback(() => {
    settled.current = true;
    finishIfSettled();
  }, [finishIfSettled]);

  const runRefresh = useCallback(() => {
    refreshPending.current = true;
    Promise.resolve()
      .then(() => onRefreshRef.current())
      // The caller's own query/loading state surfaces the failure; the indicator only needs to settle.
      .catch(() => {})
      .finally(() => {
        refreshPending.current = false;
        finishIfSettled();
      });
  }, [finishIfSettled]);

  const showSpinner = useCallback(() => {
    settled.current = false;
    setSpinnerVisible(true);
  }, []);

  const beginGestureRefresh = useCallback(() => {
    showSpinner();
    runRefresh();
  }, [showSpinner, runRefresh]);

  /** Icon → spinner and the settle to the loading position; runs on whichever thread calls it. */
  const animateIntoRefreshing = useCallback(
    (velocity: number) => {
      'worklet';
      phase.value = PullPhase.REFRESHING;
      spinnerProgress.value = withTiming(1, { duration: ICON_TO_SPINNER_MS, easing: Easing.out(Easing.quad) });
      pullDistance.value = withSpring(threshold, { ...RETURN_SPRING, velocity }, () => {
        runOnJS(markSettled)();
      });
    },
    [phase, spinnerProgress, pullDistance, threshold, markSettled],
  );

  const enterRefreshing = useCallback(() => {
    showSpinner();
    animateIntoRefreshing(0);
  }, [showSpinner, animateIntoRefreshing]);

  const triggerRefresh = useCallback(() => {
    if (disabled || phase.value === PullPhase.REFRESHING) return;
    enterRefreshing();
    runRefresh();
  }, [disabled, phase, enterRefreshing, runRefresh]);

  useEffect(() => {
    refreshingProp.current = refreshing;
    // A refresh started from outside the gesture still shows the spinner.
    if (refreshing && phase.value !== PullPhase.REFRESHING) enterRefreshing();
    else if (!refreshing) finishIfSettled();
  }, [refreshing, phase, enterRefreshing, finishIfSettled]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const gesture = useMemo(() => {
    const listScroll = Gesture.Native();
    const pull = Gesture.Pan()
      .enabled(!disabled)
      // A positive offset activates on a downward drag only; an upward drag stays the list's.
      .activeOffsetY(DRAG_DEADBAND_PX)
      .failOffsetX([-HORIZONTAL_FAIL_PX, HORIZONTAL_FAIL_PX])
      .simultaneousWithExternalGesture(listScroll)
      .onStart((event) => {
        if (phase.value === PullPhase.REFRESHING) return;
        // Grabbing mid spring-back picks the pull up from where it is instead of snapping to 0.
        cancelAnimation(pullDistance);
        rawBase.value = rawPullFor(pullDistance.value, maxPullDistance);
        rawPull.value = rawBase.value;
        pullAnchor.value = scrollY.value <= AT_TOP_EPSILON_PX ? event.translationY : Number.NaN;
      })
      .onUpdate((event) => {
        if (phase.value === PullPhase.REFRESHING) return;
        if (Number.isNaN(pullAnchor.value)) {
          // Still scrolling the list down to its top; the pull starts counting once it gets there.
          if (scrollY.value > AT_TOP_EPSILON_PX) return;
          pullAnchor.value = event.translationY;
        }
        const raw = Math.max(rawBase.value + event.translationY - pullAnchor.value, 0);
        const distance = rubberBandPull(raw, maxPullDistance);
        rawPull.value = raw;
        pullDistance.value = distance;
        phase.value = distance >= threshold ? PullPhase.TRIGGERED : PullPhase.PULLING;
      })
      .onEnd((event) => {
        // Finger speed scaled by the rubber band's slope, so the release keeps the visible momentum.
        const velocity = event.velocityY * Math.exp(-rawPull.value / maxPullDistance);
        if (phase.value === PullPhase.TRIGGERED) {
          animateIntoRefreshing(velocity);
          runOnJS(beginGestureRefresh)();
          return;
        }
        if (phase.value !== PullPhase.PULLING) return;
        phase.value = PullPhase.IDLE;
        pullDistance.value = withSpring(0, { ...RETURN_SPRING, velocity });
      });
    return Gesture.Simultaneous(pull, listScroll);
  }, [
    disabled,
    phase,
    pullDistance,
    scrollY,
    pullAnchor,
    rawBase,
    rawPull,
    threshold,
    maxPullDistance,
    animateIntoRefreshing,
    beginGestureRefresh,
  ]);

  const animatedIndicatorStyle = useAnimatedStyle(() => {
    const distance = pullDistance.value;
    const progress = calculatePullProgress(distance, threshold);
    return {
      transform: [
        { translateY: calculateIndicatorTranslateY(distance, threshold) },
        { scale: interpolate(progress, [0, 0.35, 1], [0.6, 0.9, 1], Extrapolation.CLAMP) },
      ],
      opacity: interpolate(progress, [0, 0.15, 1], [0, 0.9, 1], Extrapolation.CLAMP),
    };
  });

  // The fades overlap (spinner in before the icon is gone) so the crossfade never dips to empty.
  const animatedIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(spinnerProgress.value, [0.4, 1], [1, 0], Extrapolation.CLAMP),
    transform: [
      { rotate: `${calculatePullRotation(pullDistance.value, threshold)}deg` },
      { scale: interpolate(spinnerProgress.value, [0, 1], [1, 0.4]) },
    ],
  }));

  const animatedSpinnerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(spinnerProgress.value, [0, 0.6], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(spinnerProgress.value, [0, 1], [0.6, 1]) }],
  }));

  return {
    gesture,
    scrollHandler,
    spinnerVisible,
    triggerRefresh,
    animatedIndicatorStyle,
    animatedIconStyle,
    animatedSpinnerStyle,
  };
}
