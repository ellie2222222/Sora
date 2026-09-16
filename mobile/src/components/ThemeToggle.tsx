import { useEffect, useRef } from 'react';
import { Pressable } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Moon, Sun } from 'lucide-react-native';

export interface ThemeToggleProps {
  testID?: string;
  value: boolean;
  onValueChange: (isDark: boolean) => void;
  size?: 'sm' | 'md' | 'lg';
}

const DIMENSIONS = {
  sm: { trackWidth: 48, trackHeight: 26, thumbSize: 20, padding: 3, iconSize: 13 },
  md: { trackWidth: 58, trackHeight: 30, thumbSize: 24, padding: 3, iconSize: 15 },
  lg: { trackWidth: 70, trackHeight: 36, thumbSize: 30, padding: 3, iconSize: 18 },
};

const TIMING_CONFIG = {
  duration: 380,
  easing: Easing.bezier(0.4, 0, 0.2, 1),
};

export function ThemeToggle({
  testID,
  value,
  onValueChange,
  size = 'md',
}: ThemeToggleProps) {
  const dim = DIMENSIONS[size];
  const travelDistance = dim.trackWidth - dim.thumbSize - dim.padding * 2;

  const slideProgress = useSharedValue(value ? 1 : 0);
  // Which end `slideProgress` is animating toward. Guards against the `value` prop's
  // confirming update (arriving a render later, once the parent's state/context settles)
  // restarting an animation `onPress` already started this same tick.
  const animatedTarget = useRef(value ? 1 : 0);

  const animateTo = (target: 0 | 1) => {
    if (animatedTarget.current === target) return;
    animatedTarget.current = target;
    slideProgress.value = withTiming(target, TIMING_CONFIG);
  };

  useEffect(() => {
    animateTo(value ? 1 : 0);
  }, [value]);

  // Track colors update synchronously with the app's theme change
  const trackStyle = {
    backgroundColor: value ? '#1E293B' : '#E2E8F0',
    borderColor: value ? '#334155' : '#CBD5E1',
  };
  const trackAnimatedStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      slideProgress.value,
      [0, 1],
      ['#E2E8F0', '#1E293B'],
    );
    const borderColor = interpolateColor(
      slideProgress.value,
      [0, 1],
      ['#CBD5E1', '#334155'],
    );
    return {
      backgroundColor,
      borderColor,
    };
  });

  const thumbAnimatedStyle = useAnimatedStyle(() => {
    const translateX = slideProgress.value * travelDistance;
    const backgroundColor = interpolateColor(
      slideProgress.value,
      [0, 1],
      ['#FFFFFF', '#312E81'],
    );
    return {
      transform: [{ translateX }],
      backgroundColor,
    };
  });

  const sunAnimatedStyle = useAnimatedStyle(() => {
    const rotate = `${slideProgress.value * 90}deg`;
    return {
      opacity: 1 - slideProgress.value,
      transform: [
        { scale: 1 - slideProgress.value * 0.4 },
        { rotate },
      ],
    };
  });

  const moonAnimatedStyle = useAnimatedStyle(() => {
    const rotate = `${(1 - slideProgress.value) * -90}deg`;
    return {
      opacity: slideProgress.value,
      transform: [
        { scale: 0.6 + slideProgress.value * 0.4 },
        { rotate },
      ],
    };
  });

  return (
    <Pressable
      testID={testID}
      onPress={() => {
        const next = !value;
        animateTo(next ? 1 : 0);
        onValueChange(next);
      }}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel="Toggle night mode"
      style={{ borderRadius: dim.trackHeight / 2 }}
    >
      <Animated.View
        style={[
          {
            width: dim.trackWidth,
            height: dim.trackHeight,
            borderRadius: dim.trackHeight / 2,
            borderWidth: 1,
            padding: dim.padding,
            justifyContent: 'center',
          },
          trackStyle,
          trackAnimatedStyle,
        ]}
      >
        <Animated.View
          style={[
            {
              width: dim.thumbSize,
              height: dim.thumbSize,
              borderRadius: dim.thumbSize / 2,
              backgroundColor: value ? '#312E81' : '#FFFFFF',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 3,
              elevation: 3,
            },
            thumbAnimatedStyle,
          ]}
        >
          <Animated.View
            style={[
              {
                position: 'absolute',
                alignItems: 'center',
                justifyContent: 'center',
              },
              sunAnimatedStyle,
            ]}
          >
            <Sun
              size={dim.iconSize}
              color="#D97706"
              strokeWidth={2.5}
            />
          </Animated.View>

          <Animated.View
            style={[
              {
                position: 'absolute',
                alignItems: 'center',
                justifyContent: 'center',
              },
              moonAnimatedStyle,
            ]}
          >
            <Moon
              size={dim.iconSize}
              color="#C084FC"
              strokeWidth={2.5}
            />
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}
