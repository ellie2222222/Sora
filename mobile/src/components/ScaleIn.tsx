import { useEffect, type ReactNode } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

export interface ScaleInProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  initialScale?: number;
  duration?: number;
  delay?: number;
  testID?: string;
}

export function ScaleIn({
  children,
  style,
  initialScale = 0.85,
  duration = 250,
  delay = 0,
  testID,
}: ScaleInProps) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(initialScale);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration }));
    scale.value = withDelay(
      delay,
      withSpring(1, { damping: 15, stiffness: 250 })
    );
  }, [delay, duration, initialScale, opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return <Animated.View testID={testID} style={[animatedStyle, style]}>{children}</Animated.View>;
}
