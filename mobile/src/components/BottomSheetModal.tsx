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

import { useTheme } from '../app/providers/ThemeProvider';
import { Text } from './Text';

export interface BottomSheetModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxHeight?: DimensionValue;
  testID?: string;
}

/**
 * Standardized slide-up bottom sheet modal component.
 * Features:
 * - 1:1 synchronized backdrop opacity fade
 * - Subtle spring bounce slide-up and settling (tension: 75, friction: 9)
 * - Flush bottom anchoring with zero gap via bottom extension skirt
 * - Safe area handling
 * - Drag handle bar & PanResponder pull-to-dismiss gesture
 * - Keyboard avoiding layout support
 */
export function BottomSheetModal({
  visible,
  onClose,
  title,
  children,
  maxHeight = '90%',
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
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacityAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
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
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
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
              useNativeDriver: true,
            }),
            Animated.timing(backdropOpacityAnim, {
              toValue: 1,
              duration: 150,
              useNativeDriver: true,
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
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
          <Pressable style={{ flex: 1 }} onPress={() => dismissModal()} />
          <Pressable onPress={(e) => e.stopPropagation()}>
            <Animated.View
              style={{
                transform: [{ translateY: translateYAnim }],
                maxHeight,
                width: '100%',
              }}
            >
              <View
                style={{
                  backgroundColor: theme.colors.surfaceElevated,
                  borderTopLeftRadius: theme.radius.xl,
                  borderTopRightRadius: theme.radius.xl,
                  borderBottomLeftRadius: 0,
                  borderBottomRightRadius: 0,
                  paddingTop: theme.spacing.sm,
                  paddingHorizontal: theme.spacing.lg,
                  paddingBottom: safeBottom + 30, // Zero-gap bottom extension skirt
                  marginBottom: -30, // Pulled offscreen below screen bottom edge
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  borderBottomWidth: 0,
                  ...(theme.shadows.md as object),
                }}
              >
                <View
                  {...panResponder.panHandlers}
                  style={{
                    alignItems: 'center',
                    paddingVertical: theme.spacing.xs,
                    marginBottom: theme.spacing.xs,
                  }}
                >
                  <View
                    style={{
                      width: 38,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: theme.colors.borderStrong,
                      opacity: 0.8,
                    }}
                  />
                </View>

                {title !== undefined ? (
                  <Text variant="title" style={{ marginBottom: theme.spacing.sm }}>
                    {title}
                  </Text>
                ) : null}

                {children}
              </View>
            </Animated.View>
          </Pressable>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}
