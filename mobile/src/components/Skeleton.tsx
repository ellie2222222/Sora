import { useEffect, useRef } from 'react';
import { Animated, Platform, View, type DimensionValue } from 'react-native';

import { useTheme } from '@/app/providers';

export interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
}

// The native animated module doesn't exist on web, which warns if asked for it there.
const NATIVE_DRIVER_ENABLED = Platform.OS !== 'web';

export function Skeleton({ width = '100%', height = 16, radius }: SkeletonProps) {
  const theme = useTheme();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: NATIVE_DRIVER_ENABLED }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: NATIVE_DRIVER_ENABLED }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={{
        width,
        height,
        borderRadius: radius ?? theme.radius.sm,
        backgroundColor: theme.colors.skeleton,
        opacity,
      }}
    />
  );
}

/** A stack of skeleton rows, for a list still loading its first page. */
export function SkeletonList({ rows = 6, rowHeight = 64 }: { rows?: number; rowHeight?: number }) {
  const theme = useTheme();
  return (
    <View style={{ padding: theme.spacing.md, gap: theme.spacing.sm }}>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} height={rowHeight} radius={theme.radius.md} />
      ))}
    </View>
  );
}
