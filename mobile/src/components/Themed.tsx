import { forwardRef, useEffect, useState, type ComponentType } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type PressableProps,
  type ScrollViewProps,
  type StyleProp,
  type TextInputProps,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import type { LucideProps } from 'lucide-react-native';
import { cssInterop } from 'nativewind';
import Animated from 'react-native-reanimated';

import { useTheme } from '@/app/providers';

/*
 * Theme colours are plain style values, so a theme switch changes them in one render. These are the same host
 * components as Reanimated ones carrying the theme's colour transition, so the UI thread eases each colour from its
 * old value to its new one. Own component types, registered for `className` on their own: registering
 * `Animated.View` itself would run every animated style in the app through NativeWind's style handling.
 */
const AnimatedThemedView = Animated.createAnimatedComponent(View);
const AnimatedThemedPressable = Animated.createAnimatedComponent(Pressable);
const AnimatedThemedScrollView = Animated.createAnimatedComponent(ScrollView);
const AnimatedThemedTextInput = Animated.createAnimatedComponent(TextInput);
cssInterop(AnimatedThemedView, { className: 'style' });
cssInterop(AnimatedThemedPressable, { className: 'style' });
cssInterop(AnimatedThemedScrollView, { className: 'style', contentContainerClassName: 'contentContainerStyle' });
cssInterop(AnimatedThemedTextInput, { className: { target: 'style', nativeStyleToProp: { textAlign: true } } });

export function ThemedView({ style, ...props }: ViewProps) {
  const theme = useTheme();
  return <AnimatedThemedView {...props} style={[style, theme.motion.colorTransition]} />;
}

export interface ThemedPressableProps extends Omit<PressableProps, 'style'> {
  /** A plain style, never a function: see CLAUDE.md Part 7 rule 15. */
  style?: StyleProp<ViewStyle>;
}

export function ThemedPressable({ style, ...props }: ThemedPressableProps) {
  const theme = useTheme();
  return <AnimatedThemedPressable {...props} style={[style, theme.motion.colorTransition]} />;
}

export function ThemedScrollView({ style, ...props }: ScrollViewProps) {
  const theme = useTheme();
  return <AnimatedThemedScrollView {...props} style={[style, theme.motion.colorTransition]} />;
}

/** The ref reaches the `TextInput` itself, so `focus()`/`blur()` work as on a plain one. */
export const ThemedTextInput = forwardRef<TextInput, TextInputProps>(function ThemedTextInput({ style, ...props }, ref) {
  const theme = useTheme();
  return <AnimatedThemedTextInput {...props} ref={ref} style={[style, theme.motion.colorTransition]} />;
});

const FADE_OUT = { from: { opacity: 1 }, to: { opacity: 0 } };
const LUCIDE_DEFAULT_SIZE = 24;

export interface ThemedIconProps extends Omit<LucideProps, 'color' | 'size'> {
  /** A lucide icon, or any icon component drawn at a size in one colour. */
  icon: ComponentType<{ size: number; color: string }>;
  color: string;
  size?: number;
}

/**
 * A lucide icon whose colour eases like the rest of the theme. Lucide writes the colour onto every path, so it cannot
 * be transitioned from outside; instead the icon in its old colour is laid over the new one and faded out, which
 * blends the two colours over the same strokes exactly as an interpolation would.
 */
export function ThemedIcon({ icon: Icon, color, style, size, ...rest }: ThemedIconProps) {
  const theme = useTheme();
  const durationMs = theme.motion.colorTransitionMs;
  const [shown, setShown] = useState(color);
  const [fading, setFading] = useState<{ color: string; key: number } | null>(null);

  if (shown !== color) {
    setShown(color);
    if (durationMs > 0) setFading((previous) => ({ color: shown, key: (previous?.key ?? 0) + 1 }));
  }

  useEffect(() => {
    if (fading === null) return;
    const done = setTimeout(() => setFading(null), durationMs);
    return () => clearTimeout(done);
  }, [fading, durationMs]);

  const box = size ?? LUCIDE_DEFAULT_SIZE;
  return (
    <View style={[{ width: box, height: box }, style]}>
      <Icon {...rest} size={box} color={color} />
      {fading !== null && (
        <Animated.View
          key={fading.key}
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { animationName: FADE_OUT, animationDuration: durationMs, animationTimingFunction: 'ease-in-out', animationFillMode: 'forwards' },
          ]}
        >
          <Icon {...rest} size={box} color={fading.color} />
        </Animated.View>
      )}
    </View>
  );
}
