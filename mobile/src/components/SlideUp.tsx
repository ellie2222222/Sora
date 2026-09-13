import { useEffect, type ReactNode } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

export interface SlideUpProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  distance?: number;
  duration?: number;
  delay?: number;
  testID?: string;
}

export function SlideUp({
  children,
  style,
  distance = 20,
  duration = 300,
  delay = 0,
  testID,
}: SlideUpProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(distance);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration }));
    translateY.value = withDelay(
      delay,
      withSpring(0, { damping: 18, stiffness: 220 })
    );
  }, [delay, distance, duration, opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View testID={testID} style={[animatedStyle, style]}>{children}</Animated.View>;
}
