import { ActivityIndicator, Pressable, StyleSheet, type PressableProps } from 'react-native';

import { useTheme } from '../app/providers/ThemeProvider.tsx';
import { Text } from './Text.tsx';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<PressableProps, 'children'> {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  testID?: string;
}

const SIZE_HEIGHT: Record<ButtonSize, number> = { sm: 36, md: 48, lg: 56 };

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  testID,
  style,
  ...pressableProps
}: ButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled === true || loading;

  const backgroundColor = {
    primary: theme.colors.primary,
    secondary: theme.colors.surfaceElevated,
    danger: theme.colors.danger,
    ghost: 'transparent',
  }[variant];

  const textTone = variant === 'primary' || variant === 'danger' ? 'onPrimary' : 'default';

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
          paddingHorizontal: theme.spacing.lg,
          opacity: isDisabled ? 0.5 : state.pressed ? 0.85 : 1,
          borderWidth: variant === 'ghost' ? 1 : 0,
          borderColor: theme.colors.border,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        typeof style === 'function' ? style(state) : style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? theme.colors.onPrimary : theme.colors.primary} />
      ) : (
        <Text variant="label" weight="semibold" tone={textTone}>
          {label}
        </Text>
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
