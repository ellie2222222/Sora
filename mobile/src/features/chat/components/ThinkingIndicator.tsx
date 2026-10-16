import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components';
import { useTheme } from '@/app/providers';
import { ChatBubble } from './ChatMessageItem.tsx';

const DOTS = [0, 1, 2] as const;
const PULSE_MS = 360;
const STAGGER_MS = 140;

/** Pulses only while a request is out (it unmounts when the request ends); still under Reduce Motion. */
export function ThinkingIndicator({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <View testID="ai-thinking" accessibilityRole="progressbar" accessibilityLabel={label} accessibilityLiveRegion="polite" style={{ alignItems: 'flex-start' }}>
      <ChatBubble fromUser={false}>
        <View className="flex-row items-center" style={{ gap: theme.spacing.sm }}>
          <View className="flex-row" style={{ gap: theme.spacing.xxs }}>
            {DOTS.map((index) => (
              <Dot key={index} index={index} />
            ))}
          </View>
          <Text variant="caption" tone="muted">
            {label}
          </Text>
        </View>
      </ChatBubble>
    </View>
  );
}

function Dot({ index }: { index: number }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);
  const dim = theme.opacity.disabled;

  useEffect(() => {
    if (reduceMotion) return;
    opacity.value = withDelay(
      index * STAGGER_MS,
      withRepeat(
        withSequence(
          withTiming(dim, { duration: PULSE_MS, easing: Easing.in(Easing.quad) }),
          withTiming(1, { duration: PULSE_MS, easing: Easing.out(Easing.quad) }),
        ),
        -1,
      ),
    );
    return () => cancelAnimation(opacity);
  }, [dim, index, opacity, reduceMotion]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      style={[{ width: theme.sizes.dot.sm, height: theme.sizes.dot.sm, borderRadius: theme.radius.pill, backgroundColor: theme.colors.primary }, style]}
    />
  );
}
