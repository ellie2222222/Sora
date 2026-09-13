import { type ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

export interface AnimatedPressableProps extends Omit<PressableProps, 'style'> {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  activeOpacity?: number;
  disabled?: boolean | null;
}

export function AnimatedPressable({
  children,
  style,
  scaleTo = 0.96,
  activeOpacity = 0.85,
  disabled,
  onPressIn,
  onPressOut,
  ...rest
}: AnimatedPressableProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn: PressableProps['onPressIn'] = (e) => {
    if (!disabled) {
      scale.value = withSpring(scaleTo, { damping: 15, stiffness: 300 });
      opacity.value = withSpring(activeOpacity, { damping: 15, stiffness: 300 });
    }
    onPressIn?.(e);
  };

  const handlePressOut: PressableProps['onPressOut'] = (e) => {
    if (!disabled) {
      scale.value = withSpring(1, { damping: 15, stiffness: 300 });
      opacity.value = withSpring(1, { damping: 15, stiffness: 300 });
    }
    onPressOut?.(e);
  };

  return (
    <AnimatedPressableBase
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, animatedStyle]}
      {...rest}
    >
      {children}
    </AnimatedPressableBase>
  );
}
