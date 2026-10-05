import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react-native';

// Direct path, not the `@/components` barrel: every component in there imports
// useTheme back through this directory's own barrel, and routing through both
// barrels here would close the require-cycle shape rule 14 in CLAUDE.md documents.
import { Text } from '../../components/Text';
import { spacing } from '@/design-system';
import { ToastContext, type ToastVariant } from './ToastContext.ts';
import { useTheme } from './ThemeProvider.tsx';

const TOAST_DURATION_MS = 5000;
// Toasts beyond this wait in the queue rather than evicting a visible one mid-animation.
const MAX_VISIBLE_TOASTS = 3;
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
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  // Monotonic counter, not Date.now(): several showToast() calls fired
  // synchronously in the same tick would otherwise collide on this key.
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismissToast = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message: string, variant: ToastVariant = 'success') => {
    const id = nextId.current++;
    setToasts((current) => [...current, { id, message, variant }]);
  }, []);

  const visibleToasts = toasts.slice(0, MAX_VISIBLE_TOASTS);

  // The countdown starts once a toast is on screen, so a queued one still gets its full duration.
  // Errors never auto-dismiss (DESIGN_GUIDELINES.md → Toasts).
  useEffect(() => {
    for (const toast of visibleToasts) {
      if (toast.variant === 'error' || timers.current.has(toast.id)) continue;
      timers.current.set(
        toast.id,
        setTimeout(() => dismissToast(toast.id), TOAST_DURATION_MS),
      );
    }
  });

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  const variantColor: Record<ToastVariant, string> = {
    success: theme.colors.success,
    error: theme.colors.danger,
    warning: theme.colors.warning,
    info: theme.colors.info,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}

      <View style={[styles.container, { top: insets.top + theme.spacing.sm, pointerEvents: 'box-none' }]}>
        {visibleToasts.map((toast) => {
          const Icon = VARIANT_ICON[toast.variant];
          const color = variantColor[toast.variant];
          return (
            <Animated.View key={toast.id} entering={ENTERING} exiting={EXITING} style={styles.toastWrapper}>
              <Pressable
                onPress={() => dismissToast(toast.id)}
                accessibilityRole="alert"
                accessibilityLabel={toast.message}
                accessibilityHint={t('toast.dismissHint')}
                accessibilityLiveRegion={toast.variant === 'error' ? 'assertive' : 'polite'}
                style={[
                  styles.toast,
                  {
                    backgroundColor: theme.colors.surfaceElevated,
                    borderColor: theme.colors.border,
                    borderWidth: theme.borderWidth.thin,
                    borderRadius: theme.radius.md,
                    paddingVertical: theme.spacing.sm,
                    paddingHorizontal: theme.spacing.lg,
                    gap: theme.spacing.sm,
                    ...theme.shadows.lg,
                  },
                ]}
              >
                {/* An inset bar, not a left border: a one-sided border cannot follow rounded corners. */}
                <View
                  style={{
                    alignSelf: 'stretch',
                    width: theme.borderWidth.thick,
                    borderRadius: theme.radius.pill,
                    backgroundColor: color,
                  }}
                />
                <Icon size={theme.iconSize.lg} color={color} />
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
    marginBottom: spacing.sm,
  },
  toast: {
    flexDirection: 'row',
    // A wrapped message keeps its icon beside the first line, not centred on the block.
    alignItems: 'flex-start',
  },
  message: {
    flexShrink: 1,
  },
});
