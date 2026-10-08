import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@/app/providers';
import { useSvgId } from './useSvgId.ts';

const HALO_OPACITY = 0.18;
const SHIMMER_PEAK_OPACITY = 0.45;
/** The highlight's width as a share of the track. */
const SHIMMER_SHARE = 0.3;

interface UploadProgressBarProps {
  fraction: number;
  /** The passing highlight shows only while the upload runs. */
  active: boolean;
  thickness: number;
  testID?: string;
}

export function UploadProgressBar({ fraction, active, thickness, testID }: UploadProgressBarProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const gradientId = useSvgId('uploadShimmer');
  const [trackWidth, setTrackWidth] = useState(0);
  const fill = useSharedValue(fraction);
  const sweep = useSharedValue(0);
  const shimmerWidth = trackWidth * SHIMMER_SHARE;

  useEffect(() => {
    fill.value = reduceMotion ? fraction : withTiming(fraction, { duration: 400, easing: Easing.out(Easing.cubic) });
  }, [fraction, reduceMotion]);

  useEffect(() => {
    if (!active || reduceMotion) {
      cancelAnimation(sweep);
      sweep.value = 0;
      return;
    }
    sweep.value = 0;
    sweep.value = withRepeat(withDelay(600, withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) })), -1);
  }, [active, reduceMotion]);

  const fillStyle = useAnimatedStyle(() => ({ width: trackWidth * fill.value }));
  const haloStyle = useAnimatedStyle(() => ({ width: trackWidth * fill.value }));
  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -shimmerWidth + (trackWidth * fill.value + shimmerWidth) * sweep.value }],
  }));

  return (
    <View
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.floor(fraction * 100) }}
      onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
      style={{ height: thickness, justifyContent: 'center' }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            left: 0,
            height: thickness * 2,
            borderRadius: theme.radius.pill,
            backgroundColor: theme.colors.primary,
            opacity: active ? HALO_OPACITY : 0,
          },
          haloStyle,
        ]}
      />
      <View style={{ height: thickness, borderRadius: theme.radius.pill, backgroundColor: theme.colors.border, overflow: 'hidden' }}>
        <Animated.View
          style={[
            { height: thickness, borderRadius: theme.radius.pill, backgroundColor: active ? theme.colors.primary : theme.colors.textMuted, overflow: 'hidden' },
            fillStyle,
          ]}
        >
          {active && !reduceMotion && shimmerWidth > 0 ? (
            <Animated.View style={[{ position: 'absolute', top: 0, bottom: 0, width: shimmerWidth }, shimmerStyle]}>
              <Svg width={shimmerWidth} height={thickness}>
                <Defs>
                  <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor={theme.colors.text} stopOpacity={0} />
                    <Stop offset="0.5" stopColor={theme.colors.text} stopOpacity={SHIMMER_PEAK_OPACITY} />
                    <Stop offset="1" stopColor={theme.colors.text} stopOpacity={0} />
                  </LinearGradient>
                </Defs>
                <Rect width={shimmerWidth} height={thickness} fill={`url(#${gradientId})`} />
              </Svg>
            </Animated.View>
          ) : null}
        </Animated.View>
      </View>
    </View>
  );
}
