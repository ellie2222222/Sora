import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Platform, type StyleProp, type ViewStyle } from 'react-native';
import { useIsFocused } from '@react-navigation/native';

export interface AnimatedScreenProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  slideDistance?: number;
  duration?: number;
  testID?: string;
}

// `useIsFocused` re-fires this on every tab switch and stack pop back to this
// screen, not just on mount, so the animation replays each time it's shown.
export function AnimatedScreen({
  children,
  style,
  slideDistance = 20,
  duration = 280,
  testID,
}: AnimatedScreenProps) {
  const isFocused = useIsFocused();
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(slideDistance)).current;
  // The native animated module doesn't exist on web, which warns if asked for it there.
  const nativeDriverEnabled = Platform.OS !== 'web';

  useEffect(() => {
    if (isFocused) {
      opacityAnim.setValue(0);
      translateYAnim.setValue(slideDistance);

      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration,
          useNativeDriver: nativeDriverEnabled,
        }),
        Animated.spring(translateYAnim, {
          toValue: 0,
          tension: 70,
          friction: 8,
          useNativeDriver: nativeDriverEnabled,
        }),
      ]).start();
    } else {
      opacityAnim.setValue(0);
      translateYAnim.setValue(slideDistance);
    }
  }, [isFocused, duration, slideDistance]);

  return (
    <Animated.View
      testID={testID}
      style={[
        { flex: 1, opacity: opacityAnim, transform: [{ translateY: translateYAnim }] },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}
