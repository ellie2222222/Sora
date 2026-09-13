import { useEffect } from 'react';
import type { LucideIcon, LucideProps } from 'lucide-react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';

export type IconAnimationType = 'none' | 'spin' | 'pulse' | 'bounce' | 'float';

export interface AnimatedIconProps extends LucideProps {
  icon: LucideIcon;
  animation?: IconAnimationType;
  duration?: number;
}

export function AnimatedIcon({
  icon: IconComponent,
  animation = 'none',
  duration = 1200,
  size = 24,
  color,
  strokeWidth = 2,
  style,
  ...rest
}: AnimatedIconProps) {
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    switch (animation) {
      case 'spin':
        rotation.value = 0;
        rotation.value = withRepeat(
          withTiming(360, { duration, easing: Easing.linear }),
          -1,
          false
        );
        break;

      case 'pulse':
        scale.value = 1;
        opacity.value = 1;
        scale.value = withRepeat(
          withSequence(
            withTiming(1.15, { duration: duration / 2 }),
            withTiming(1, { duration: duration / 2 })
          ),
          -1,
          true
        );
        opacity.value = withRepeat(
          withSequence(
            withTiming(0.6, { duration: duration / 2 }),
            withTiming(1, { duration: duration / 2 })
          ),
          -1,
          true
        );
        break;

      case 'bounce':
        translateY.value = 0;
        translateY.value = withRepeat(
          withSequence(
            withSpring(-6, { damping: 4, stiffness: 200 }),
            withSpring(0, { damping: 6, stiffness: 200 })
          ),
          -1,
          true
        );
        break;

      case 'float':
        translateY.value = 0;
        translateY.value = withRepeat(
          withSequence(
            withTiming(-4, { duration: duration / 2, easing: Easing.inOut(Easing.ease) }),
            withTiming(4, { duration: duration / 2, easing: Easing.inOut(Easing.ease) })
          ),
          -1,
          true
        );
        break;

      case 'none':
      default:
        rotation.value = 0;
        scale.value = 1;
        translateY.value = 0;
        opacity.value = 1;
        break;
    }
  }, [animation, duration, rotation, scale, translateY, opacity]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { rotate: `${rotation.value}deg` },
        { scale: scale.value },
        { translateY: translateY.value },
      ],
      opacity: opacity.value,
    };
  });

  return (
    <Animated.View style={[animatedStyle, style]}>
      <IconComponent size={size} color={color} strokeWidth={strokeWidth} {...rest} />
    </Animated.View>
  );
}
