import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/app/providers';
import { KeyboardDockProvider } from './KeyboardDockProvider.tsx';
import { Text } from './Text';

// The native animated module doesn't exist on web, which warns if asked for it there.
const NATIVE_DRIVER_ENABLED = Platform.OS !== 'web';

// The sheet's bottom edge is pulled this far below the screen (the zero-gap skirt), so it must travel this much further to leave it.
const SKIRT = 30;
const DEFAULT_DISMISS_THRESHOLD = 0.3;
const DEFAULT_DISMISS_VELOCITY = 0.5;
const RETURN_SPRING = { tension: 75, friction: 9 } as const;

type SheetPhase = 'idle' | 'dragging' | 'dismissing';

export interface BottomSheetModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Points, not a percentage: the wrapper around the sheet is content-sized, so a percentage resolves against nothing. */
  maxHeight?: number;
  /** Fraction of the sheet's height a release must be dragged past to dismiss. */
  dismissThreshold?: number;
  /** Release speed (px/ms) that dismisses regardless of distance — a flick. */
  dismissVelocity?: number;
  testID?: string;
}

export function BottomSheetModal({
  visible,
  onClose,
  title,
  children,
  maxHeight,
  dismissThreshold = DEFAULT_DISMISS_THRESHOLD,
  dismissVelocity = DEFAULT_DISMISS_VELOCITY,
  testID,
}: BottomSheetModalProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const safeBottom = Math.max(insets.bottom, 16);

  const windowHeight = Dimensions.get('window').height;
  const availableHeight = windowHeight - insets.top - theme.spacing.lg;
  const sheetMaxHeight = maxHeight === undefined ? availableHeight : Math.min(maxHeight, availableHeight);
  const initialTranslateY = windowHeight > 0 ? windowHeight : 600;

  const translateYAnim = useRef(new Animated.Value(initialTranslateY)).current;
  const [sheetHeight, setSheetHeight] = useState(initialTranslateY);
  const phase = useRef<SheetPhase>('idle');

  // Derived from the sheet's position, not animated separately: the backdrop clears exactly as the
  // sheet leaves the screen, and the sheet itself never fades.
  const backdropOpacity = useMemo(
    () =>
      translateYAnim.interpolate({
        inputRange: [0, Math.max(sheetHeight + SKIRT, 1)],
        outputRange: [1, 0],
        extrapolate: 'clamp',
      }),
    [translateYAnim, sheetHeight],
  );

  const finishDismiss = useCallback(() => {
    phase.current = 'idle';
    onClose();
  }, [onClose]);

  const dismissModal = useCallback(() => {
    if (phase.current === 'dismissing') return;
    phase.current = 'dismissing';
    Animated.timing(translateYAnim, {
      toValue: sheetHeight + SKIRT,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: NATIVE_DRIVER_ENABLED,
    }).start(({ finished }) => finished && finishDismiss());
  }, [translateYAnim, sheetHeight, finishDismiss]);

  // A gesture release carries the finger's velocity into the slide-out, so the motion continues the drag.
  const dismissFromRelease = useCallback(
    (velocity: number) => {
      phase.current = 'dismissing';
      Animated.spring(translateYAnim, {
        toValue: sheetHeight + SKIRT,
        velocity,
        ...RETURN_SPRING,
        overshootClamping: true,
        useNativeDriver: NATIVE_DRIVER_ENABLED,
      }).start(({ finished }) => finished && finishDismiss());
    },
    [translateYAnim, sheetHeight, finishDismiss],
  );

  const springBack = useCallback(
    (velocity: number) => {
      phase.current = 'idle';
      Animated.spring(translateYAnim, {
        toValue: 0,
        velocity,
        ...RETURN_SPRING,
        useNativeDriver: NATIVE_DRIVER_ENABLED,
      }).start();
    },
    [translateYAnim],
  );

  useEffect(() => {
    if (visible) {
      phase.current = 'idle';
      translateYAnim.setValue(initialTranslateY);
      Animated.spring(translateYAnim, {
        toValue: 0,
        ...RETURN_SPRING,
        useNativeDriver: NATIVE_DRIVER_ENABLED,
      }).start();
    }
  }, [visible, initialTranslateY, translateYAnim]);

  // The PanResponder is created once, so it reads the latest thresholds and handlers through a ref.
  const gesture = useRef({ sheetHeight, dismissThreshold, dismissVelocity, dismissFromRelease, springBack });
  gesture.current = { sheetHeight, dismissThreshold, dismissVelocity, dismissFromRelease, springBack };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => phase.current !== 'dismissing',
      onMoveShouldSetPanResponder: (_, gestureState) => phase.current !== 'dismissing' && gestureState.dy > 5,
      onPanResponderGrant: () => {
        phase.current = 'dragging';
        translateYAnim.stopAnimation();
      },
      onPanResponderMove: (_, gestureState) => {
        translateYAnim.setValue(Math.max(gestureState.dy, 0));
      },
      onPanResponderRelease: (_, gestureState) => {
        const current = gesture.current;
        const pastThreshold = gestureState.dy >= current.sheetHeight * current.dismissThreshold;
        const flicked = gestureState.vy >= current.dismissVelocity;
        if (pastThreshold || flicked) current.dismissFromRelease(Math.max(gestureState.vy, 0));
        else current.springBack(gestureState.vy);
      },
      onPanResponderTerminate: (_, gestureState) => gesture.current.springBack(gestureState.vy),
    })
  ).current;

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      statusBarTranslucent
      onRequestClose={() => dismissModal()}
      testID={testID}
    >
      <View style={{ flex: 1 }}>
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.overlay, opacity: backdropOpacity }]}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1 justify-end"
        >
          <Pressable className="flex-1" onPress={() => dismissModal()} />
          <Pressable onPress={(e) => e.stopPropagation()}>
            <Animated.View
              onLayout={(event) => setSheetHeight(event.nativeEvent.layout.height)}
              style={{
                transform: [{ translateY: translateYAnim }],
                maxHeight: sheetMaxHeight,
                width: '100%',
              }}
            >
              <View
                className="rounded-bl-none rounded-br-none border border-b-0"
                style={{
                  backgroundColor: theme.colors.surfaceElevated,
                  borderTopLeftRadius: theme.radius.xl,
                  borderTopRightRadius: theme.radius.xl,
                  paddingTop: theme.spacing.sm,
                  paddingHorizontal: theme.spacing.lg,
                  marginBottom: -SKIRT,
                  paddingBottom: safeBottom + SKIRT,
                  borderColor: theme.colors.border,
                  // flexShrink/minHeight: 0 so this actually shrinks to the ancestor's `maxHeight`
                  // on web (CSS flexbox defaults a flex item's min-height to `auto`, refusing to
                  // shrink below content size — Yoga on native doesn't have that quirk).
                  flexShrink: 1,
                  minHeight: 0,
                  ...(theme.shadows.md as object),
                }}
              >
                <View
                  {...panResponder.panHandlers}
                  className="items-center"
                  style={{
                    paddingVertical: theme.spacing.xs,
                    marginBottom: theme.spacing.xs,
                  }}
                >
                  <View
                    className="w-[38px] h-[4px] rounded-[2px] opacity-80"
                    style={{
                      backgroundColor: theme.colors.borderStrong,
                    }}
                  />
                </View>

                {title !== undefined ? (
                  <Text variant="title" style={{ marginBottom: theme.spacing.sm }}>
                    {title}
                  </Text>
                ) : null}

                <KeyboardDockProvider applySafeArea={false}>{children}</KeyboardDockProvider>
              </View>
            </Animated.View>
          </Pressable>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
