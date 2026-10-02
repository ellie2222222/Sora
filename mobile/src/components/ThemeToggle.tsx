import { useEffect, useRef } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Moon, Sun } from 'lucide-react-native';

import { useTheme } from '@/app/providers';

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

const MIN_TOUCH_TARGET = 44;

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
  const theme = useTheme();
  const dim = DIMENSIONS[size];
  const verticalSlop = Math.max(0, (MIN_TOUCH_TARGET - dim.trackHeight) / 2);
  const { t } = useTranslation();
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

  const thumbAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideProgress.value * travelDistance }],
  }));

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
      accessibilityLabel={t('settings.darkMode', 'Dark Theme')}
      hitSlop={{ top: verticalSlop, bottom: verticalSlop }}
      style={{ borderRadius: dim.trackHeight / 2 }}
    >
      <View
        style={{
          width: dim.trackWidth,
          height: dim.trackHeight,
          borderRadius: dim.trackHeight / 2,
          borderWidth: 1,
          padding: dim.padding,
          justifyContent: 'center',
          // Track and thumb follow the theme, which flips in the same tick as `value`.
          backgroundColor: theme.colors.surfaceMuted,
          borderColor: theme.colors.borderControl,
        }}
      >
        <Animated.View
          style={[
            {
              width: dim.thumbSize,
              height: dim.thumbSize,
              borderRadius: dim.thumbSize / 2,
              backgroundColor: theme.colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
              ...Platform.select({
                web: { boxShadow: `0px 2px 3px ${theme.colors.shadow}` }, // roughly matches opacity 0.2
                default: {
                  shadowColor: theme.colors.shadow,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.2,
                  shadowRadius: 3,
                  elevation: 3,
                },
              }),
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
              color={theme.colors.onPrimary}
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
              color={theme.colors.onPrimary}
              strokeWidth={2.5}
            />
          </Animated.View>
        </Animated.View>
      </View>
    </Pressable>
  );
}
