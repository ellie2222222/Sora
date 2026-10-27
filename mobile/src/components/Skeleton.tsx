import { useEffect, useRef } from 'react';
import { Animated, Platform, View, type DimensionValue } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { useTheme } from '@/app/providers';
import { ThemedView } from './Themed.tsx';

export interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
}

// The native animated module doesn't exist on web, which warns if asked for it there.
const NATIVE_DRIVER_ENABLED = Platform.OS !== 'web';

export function Skeleton({ width = '100%', height, radius }: SkeletonProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: NATIVE_DRIVER_ENABLED }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: NATIVE_DRIVER_ENABLED }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, reduceMotion]);

  return (
    <Animated.View style={{ opacity }}>
      <ThemedView
        style={{
          width,
          height: height ?? theme.sizes.skeletonLine.body,
          borderRadius: radius ?? theme.radius.sm,
          backgroundColor: theme.colors.skeleton,
        }}
      />
    </Animated.View>
  );
}

/** A stack of skeleton rows, for a list still loading its first page. */
export function SkeletonList({ rows = 6, rowHeight: rowHeightProp }: { rows?: number; rowHeight?: number }) {
  const theme = useTheme();
  const rowHeight = rowHeightProp ?? theme.sizes.listRowMinHeight;
  return (
    <View style={{ padding: theme.spacing.md, gap: theme.spacing.sm }}>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} height={rowHeight} radius={theme.radius.md} />
      ))}
    </View>
  );
}
