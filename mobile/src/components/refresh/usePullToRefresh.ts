import { useCallback, useEffect, useRef } from 'react';
import type { GestureResponderEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import {
  calculateIndicatorTranslateY,
  calculatePullDistanceWithResistance,
  calculatePullProgress,
  calculatePullRotation,
  DEFAULT_PULL_THRESHOLD,
} from './pullMath.ts';

export interface UsePullToRefreshOptions {
  refreshing: boolean;
  onRefresh: () => Promise<void> | void;
  threshold?: number;
  disabled?: boolean;
}

export function usePullToRefresh({
  refreshing,
  onRefresh,
  threshold = DEFAULT_PULL_THRESHOLD,
  disabled = false,
}: UsePullToRefreshOptions) {
  const pullDistance = useSharedValue(0);
  const spinRotation = useSharedValue(0);
  const isSpinning = useSharedValue(false);

  const isAtTop = useRef(true);
  const touchStartY = useRef<number | null>(null);
  const touchStartX = useRef<number | null>(null);
  const isDragging = useRef(false);
  const wasRefreshing = useRef(refreshing);

  const triggerRefresh = useCallback(() => {
    if (disabled) return;
    try {
      void onRefresh();
    } catch {
      // The caller's own query/loading state already surfaces the failure;
      // swallowed here so a synchronous throw can't crash the gesture handler.
    }
  }, [disabled, onRefresh]);

  useEffect(() => {
    if (refreshing && !wasRefreshing.current) {
      isSpinning.value = true;
      pullDistance.value = withSpring(threshold, { damping: 14, stiffness: 160, mass: 0.8 });
      spinRotation.value = 0;
      spinRotation.value = withRepeat(
        withTiming(360, { duration: 750, easing: Easing.linear }),
        -1,
        false
      );
    } else if (!refreshing && wasRefreshing.current) {
      isSpinning.value = false;
      pullDistance.value = withTiming(0, { duration: 240, easing: Easing.out(Easing.cubic) });
      cancelAnimation(spinRotation);
      spinRotation.value = 0;
    }
    wasRefreshing.current = refreshing;
  }, [refreshing, isSpinning, pullDistance, spinRotation, threshold]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      isAtTop.current = y <= 1;

      // Handle iOS native overscroll (negative contentOffset.y)
      if (y < 0 && !disabled && !refreshing) {
        const rawDistance = Math.abs(y);
        pullDistance.value = calculatePullDistanceWithResistance(rawDistance, threshold);
      }
    },
    [disabled, refreshing, threshold, pullDistance]
  );

  const handleScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      if (y < 0 && !disabled && !refreshing) {
        if (Math.abs(y) >= threshold) {
          pullDistance.value = withSpring(threshold, { damping: 14, stiffness: 160, mass: 0.8 });
          triggerRefresh();
        } else {
          pullDistance.value = withSpring(0, { damping: 16, stiffness: 180 });
        }
      }
    },
    [disabled, refreshing, threshold, triggerRefresh, pullDistance]
  );

  // Touch handlers for Android and non-overscrolling environments
  const handleTouchStart = useCallback(
    (e: GestureResponderEvent) => {
      if (disabled || refreshing) return;
      touchStartY.current = e.nativeEvent.pageY;
      touchStartX.current = e.nativeEvent.pageX;
      isDragging.current = false;
    },
    [disabled, refreshing]
  );

  const handleTouchMove = useCallback(
    (e: GestureResponderEvent) => {
      if (disabled || refreshing || touchStartY.current === null) return;
      if (!isAtTop.current) return;

      const dy = e.nativeEvent.pageY - touchStartY.current;
      const dx = e.nativeEvent.pageX - (touchStartX.current ?? e.nativeEvent.pageX);

      // Only pull down when vertical drag exceeds deadband and dominates horizontal movement
      if (dy > 6 && dy > Math.abs(dx)) {
        isDragging.current = true;
        pullDistance.value = calculatePullDistanceWithResistance(dy, threshold);
      }
    },
    [disabled, refreshing, threshold, pullDistance]
  );

  const handleTouchEnd = useCallback(() => {
    if (disabled || refreshing) return;
    if (isDragging.current) {
      isDragging.current = false;
      if (pullDistance.value >= threshold) {
        pullDistance.value = withSpring(threshold, { damping: 14, stiffness: 160, mass: 0.8 });
        triggerRefresh();
      } else {
        pullDistance.value = withSpring(0, { damping: 16, stiffness: 180 });
      }
    }
    touchStartY.current = null;
    touchStartX.current = null;
  }, [disabled, refreshing, threshold, triggerRefresh, pullDistance]);

  const animatedIndicatorStyle = useAnimatedStyle(() => {
    const distance = pullDistance.value;
    const progress = calculatePullProgress(distance, threshold);
    const translateY = calculateIndicatorTranslateY(distance, threshold);
    const opacity = interpolate(progress, [0, 0.15, 1], [0, 0.9, 1], Extrapolation.CLAMP);
    const scale = interpolate(progress, [0, 0.35, 1], [0.6, 0.9, 1], Extrapolation.CLAMP);

    return {
      transform: [
        { translateY },
        { scale: isSpinning.value ? 1 : scale },
      ],
      opacity: isSpinning.value ? 1 : opacity,
    };
  });

  const animatedIconStyle = useAnimatedStyle(() => {
    if (isSpinning.value) {
      return {
        transform: [{ rotate: `${spinRotation.value}deg` }],
      };
    }
    const distance = pullDistance.value;
    const rotation = calculatePullRotation(distance, threshold);
    return {
      transform: [{ rotate: `${rotation}deg` }],
    };
  });

  return {
    pullDistance,
    isSpinning,
    triggerRefresh,
    handleScroll,
    handleScrollEndDrag,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    animatedIndicatorStyle,
    animatedIconStyle,
  };
}
