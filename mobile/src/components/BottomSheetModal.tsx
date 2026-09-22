import { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  View,
  type DimensionValue,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/app/providers';
import { KeyboardDockProvider } from './KeyboardDockProvider.tsx';
import { Text } from './Text';

// The native animated module doesn't exist on web, which warns if asked for it there.
const NATIVE_DRIVER_ENABLED = Platform.OS !== 'web';

export interface BottomSheetModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxHeight?: DimensionValue;
  testID?: string;
}

export function BottomSheetModal({
  visible,
  onClose,
  title,
  children,
  maxHeight = '100%',
  testID,
}: BottomSheetModalProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const safeBottom = Math.max(insets.bottom, 16);

  const windowHeight = Dimensions.get('window').height;
  const initialTranslateY = windowHeight > 0 ? windowHeight : 600;

  const translateYAnim = useRef(new Animated.Value(initialTranslateY)).current;
  const backdropOpacityAnim = useRef(new Animated.Value(0)).current;

  const dismissModal = useCallback(
    (onDone?: () => void) => {
      Animated.parallel([
        Animated.timing(translateYAnim, {
          toValue: initialTranslateY,
          duration: 180,
          useNativeDriver: NATIVE_DRIVER_ENABLED,
        }),
        Animated.timing(backdropOpacityAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: NATIVE_DRIVER_ENABLED,
        }),
      ]).start(() => {
        onClose();
        onDone?.();
      });
    },
    [initialTranslateY, translateYAnim, backdropOpacityAnim, onClose]
  );

  useEffect(() => {
    if (visible) {
      translateYAnim.setValue(initialTranslateY);
      backdropOpacityAnim.setValue(0);
      Animated.parallel([
        Animated.spring(translateYAnim, {
          toValue: 0,
          tension: 75,
          friction: 9,
          useNativeDriver: NATIVE_DRIVER_ENABLED,
        }),
        Animated.timing(backdropOpacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: NATIVE_DRIVER_ENABLED,
        }),
      ]).start();
    }
  }, [visible, initialTranslateY, translateYAnim, backdropOpacityAnim]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 5,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateYAnim.setValue(gestureState.dy);
          const opacity = Math.max(0, 1 - gestureState.dy / 350);
          backdropOpacityAnim.setValue(opacity);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 90 || gestureState.vy > 0.4) {
          dismissModal();
        } else {
          Animated.parallel([
            Animated.spring(translateYAnim, {
              toValue: 0,
              tension: 75,
              friction: 9,
              useNativeDriver: NATIVE_DRIVER_ENABLED,
            }),
            Animated.timing(backdropOpacityAnim, {
              toValue: 1,
              duration: 150,
              useNativeDriver: NATIVE_DRIVER_ENABLED,
            }),
          ]).start();
        }
      },
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
      <Animated.View
        style={{
          flex: 1,
          backgroundColor: theme.colors.overlay,
          opacity: backdropOpacityAnim,
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1 justify-end"
        >
          <Pressable className="flex-1" onPress={() => dismissModal()} />
          <Pressable onPress={(e) => e.stopPropagation()}>
            <Animated.View
              style={{
                transform: [{ translateY: translateYAnim }],
                maxHeight,
                width: '100%',
              }}
            >
              <View
                // Pulled offscreen below the screen's bottom edge, paired with the zero-gap paddingBottom skirt below
                className="rounded-bl-none rounded-br-none border border-b-0 -mb-[30px]"
                style={{
                  backgroundColor: theme.colors.surfaceElevated,
                  borderTopLeftRadius: theme.radius.xl,
                  borderTopRightRadius: theme.radius.xl,
                  paddingTop: theme.spacing.sm,
                  paddingHorizontal: theme.spacing.lg,
                  paddingBottom: safeBottom + 30, // Zero-gap bottom extension skirt
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
      </Animated.View>
    </Modal>
  );
}
