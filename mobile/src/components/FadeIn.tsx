import { useEffect, type ReactNode } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

export interface FadeInProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  duration?: number;
  delay?: number;
  testID?: string;
}

export function FadeIn({ children, style, duration = 300, delay = 0, testID }: FadeInProps) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration }));
  }, [delay, duration, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return <Animated.View testID={testID} style={[animatedStyle, style]}>{children}</Animated.View>;
}
