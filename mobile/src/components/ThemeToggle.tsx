import { useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Moon, Sun } from 'lucide-react-native';

import { useTheme } from '@/app/providers';
import { concentricRadius } from '@/design-system';

export interface ThemeToggleProps {
  testID?: string;
  value: boolean;
  onValueChange: (isDark: boolean) => void;
  size?: 'sm' | 'md' | 'lg';
}

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
  const toggle = theme.sizes.toggle[size];
  const iconSize = { sm: theme.iconSize.xs, md: theme.iconSize.sm, lg: theme.iconSize.lg }[size];
  // RN padding sits inside the border, so the thumb's gap to the outer edge is border + padding.
  const thumbInset = (toggle.trackHeight - toggle.thumb) / 2;
  const dim = {
    trackWidth: toggle.trackWidth,
    trackHeight: toggle.trackHeight,
    thumbSize: toggle.thumb,
    padding: thumbInset - theme.borderWidth.thin,
    iconSize,
  };
  const verticalSlop = Math.max(0, (theme.sizes.touchTarget - dim.trackHeight) / 2);
  const { t } = useTranslation();
  const travelDistance = dim.trackWidth - dim.thumbSize - thumbInset * 2;

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
          borderWidth: theme.borderWidth.thin,
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
              borderRadius: concentricRadius(dim.trackHeight / 2, thumbInset),
              backgroundColor: theme.colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
              ...theme.shadows.sm,
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
              strokeWidth={theme.iconStroke.bold}
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
              strokeWidth={theme.iconStroke.bold}
            />
          </Animated.View>
        </Animated.View>
      </View>
    </Pressable>
  );
}
