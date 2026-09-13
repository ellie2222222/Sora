import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';
import { useIsFocused } from '@react-navigation/native';

export interface AnimatedScreenProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  slideDistance?: number;
  duration?: number;
}

// `useIsFocused` re-fires this on every tab switch and stack pop back to this
// screen, not just on mount, so the animation replays each time it's shown.
export function AnimatedScreen({
  children,
  style,
  slideDistance = 20,
  duration = 280,
}: AnimatedScreenProps) {
  const isFocused = useIsFocused();
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(slideDistance)).current;

  useEffect(() => {
    if (isFocused) {
      opacityAnim.setValue(0);
      translateYAnim.setValue(slideDistance);

      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration,
          useNativeDriver: true,
        }),
        Animated.spring(translateYAnim, {
          toValue: 0,
          tension: 70,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      opacityAnim.setValue(0);
      translateYAnim.setValue(slideDistance);
    }
  }, [isFocused, duration, slideDistance]);

  return (
    <Animated.View
      style={[
        { flex: 1, opacity: opacityAnim, transform: [{ translateY: translateYAnim }] },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}
