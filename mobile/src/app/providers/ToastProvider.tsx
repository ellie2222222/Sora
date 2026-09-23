import { useCallback, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react-native';

// Direct path, not the `@/components` barrel: every component in there imports
// useTheme back through this directory's own barrel, and routing through both
// barrels here would close the require-cycle shape rule 14 in CLAUDE.md documents.
import { Text } from '../../components/Text';
import { ToastContext, type ToastVariant } from './ToastContext.ts';
import { useTheme } from './ThemeProvider.tsx';

const TOAST_DURATION_MS = 5000;
const ENTERING = FadeInDown.duration(220);
const EXITING = FadeOutUp.duration(180);

interface ToastEntry {
  id: number;
  message: string;
  variant: ToastVariant;
}

type IconComponent = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

const VARIANT_ICON: Record<ToastVariant, IconComponent> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  // Monotonic counter, not Date.now(): several showToast() calls fired
  // synchronously in the same tick would otherwise collide on this key.
  const nextId = useRef(0);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = 'success') => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, message, variant }]);
      setTimeout(() => dismissToast(id), TOAST_DURATION_MS);
    },
    [dismissToast],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  const variantColor: Record<ToastVariant, string> = {
    success: theme.colors.success,
    error: theme.colors.danger,
    warning: theme.colors.warning,
    info: theme.colors.primary,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}

      <View pointerEvents="box-none" style={[styles.container, { top: insets.top + theme.spacing.sm }]}>
        {toasts.map((toast) => {
          const Icon = VARIANT_ICON[toast.variant];
          const color = variantColor[toast.variant];
          return (
            <Animated.View key={toast.id} entering={ENTERING} exiting={EXITING} style={styles.toastWrapper}>
              <Pressable
                onPress={() => dismissToast(toast.id)}
                accessibilityRole="button"
                accessibilityLabel={toast.message}
                style={[
                  styles.toast,
                  {
                    backgroundColor: theme.colors.surfaceElevated,
                    borderColor: color,
                    borderRadius: theme.radius.md,
                    paddingVertical: theme.spacing.sm,
                    paddingHorizontal: theme.spacing.md,
                    gap: theme.spacing.xs,
                    ...theme.shadows.lg,
                  },
                ]}
              >
                <Icon size={18} color={color} strokeWidth={2} />
                <Text variant="label" style={styles.message}>
                  {toast.message}
                </Text>
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 99999,
  },
  toastWrapper: {
    maxWidth: '92%',
    marginBottom: 8,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  message: {
    flexShrink: 1,
  },
});
