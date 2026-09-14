import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, type PressableProps } from 'react-native';

import { useTheme } from '../app/providers/ThemeProvider.tsx';
import { Text } from './Text.tsx';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'danger-outline' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<PressableProps, 'children'> {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: LucideIcon;
  testID?: string;
}

const SIZE_HEIGHT: Record<ButtonSize, number> = { sm: 30, md: 38, lg: 46 };
const SIZE_PADDING_VERTICAL: Record<ButtonSize, number> = { sm: 4, md: 6, lg: 8 };
const SIZE_PADDING_HORIZONTAL: Record<ButtonSize, number> = { sm: 12, md: 16, lg: 20 };

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  icon: Icon,
  disabled,
  testID,
  style,
  ...pressableProps
}: ButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled === true || loading;

  const rawBackgroundColor = {
    primary: theme.colors.primary,
    secondary: theme.colors.surfaceMuted,
    danger: theme.colors.danger,
    'danger-outline': theme.colors.dangerMuted,
    ghost: 'transparent',
  }[variant];

  const backgroundColor = isDisabled && (variant === 'primary' || variant === 'danger') ? theme.colors.surfaceMuted : rawBackgroundColor;
  const textTone = isDisabled ? 'muted' : variant === 'primary' || variant === 'danger' ? 'onPrimary' : variant === 'danger-outline' ? 'danger' : 'default';
  const iconColor = isDisabled ? theme.colors.textMuted : variant === 'primary' || variant === 'danger' ? theme.colors.onPrimary : variant === 'danger-outline' ? theme.colors.danger : theme.colors.text;
  const iconSize = size === 'sm' ? 14 : size === 'lg' ? 18 : 16;
  const borderWidth = variant === 'ghost' || variant === 'danger-outline' || variant === 'secondary' ? 1 : 0;
  // `border` barely differs from `surface` in dark mode; `borderStrong` keeps
  // buttons visible on an already-`surface`-coloured card.
  const borderColor = isDisabled ? theme.colors.border : variant === 'danger-outline' ? theme.colors.danger : theme.colors.borderStrong;

  return (
    <Pressable
      {...pressableProps}
      testID={testID}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={(state) => [
        styles.base,
        {
          backgroundColor,
          height: SIZE_HEIGHT[size],
          borderRadius: theme.radius.md,
          paddingVertical: SIZE_PADDING_VERTICAL[size],
          paddingHorizontal: SIZE_PADDING_HORIZONTAL[size],
          opacity: isDisabled ? 0.7 : state.pressed ? 0.85 : 1,
          borderWidth,
          borderColor,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        typeof style === 'function' ? style(state) : style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? theme.colors.onPrimary : theme.colors.primary} />
      ) : (
        <>
          {Icon !== undefined ? <Icon size={iconSize} color={iconColor} style={{ marginRight: theme.spacing.xs }} /> : null}
          <Text variant="label" weight="semibold" tone={textTone}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
