import type { LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, type PressableProps } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/app/providers';
import { Text } from './Text.tsx';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'danger-outline' | 'danger-soft' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<PressableProps, 'children'> {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingLabel?: string;
  fullWidth?: boolean;
  icon?: LucideIcon;
  testID?: string;
}

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  loadingLabel,
  fullWidth = false,
  icon: Icon,
  disabled,
  testID,
  style,
  onPressIn,
  onPressOut,
  hitSlop,
  ...pressableProps
}: ButtonProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const sizeHeight: Record<ButtonSize, number> = {
    sm: theme.sizes.badge.sm,
    md: theme.sizes.touchTarget,
    lg: theme.sizes.controlHeight,
  };
  // `sm` stays visually compact; the slop brings its touch area to the 44pt minimum.
  const sizeHitSlop: Record<ButtonSize, number> = {
    sm: (theme.sizes.touchTarget - sizeHeight.sm) / 2,
    md: 0,
    lg: 0,
  };
  const sizePaddingVertical: Record<ButtonSize, number> = { sm: theme.spacing.xs, md: theme.spacing.xs, lg: theme.spacing.sm };
  const sizePaddingHorizontal: Record<ButtonSize, number> = { sm: theme.spacing.md, md: theme.spacing.lg, lg: theme.spacing.xl };
  const isDisabled = disabled === true || loading;
  const [pressed, setPressed] = useState(false);

  const enabledBackgroundColor = {
    primary: theme.colors.primary,
    secondary: theme.colors.surfaceMuted,
    outline: 'transparent',
    danger: theme.colors.danger,
    'danger-outline': theme.colors.dangerMuted,
    'danger-soft': theme.colors.dangerMuted,
    ghost: 'transparent',
  }[variant];

  const disabledBackgroundColor = {
    primary: theme.colors.buttonPrimaryDisabledBackground,
    secondary: theme.colors.buttonSecondaryDisabledBackground,
    outline: 'transparent',
    danger: theme.colors.buttonDangerDisabledBackground,
    'danger-outline': theme.colors.buttonDangerDisabledBackground,
    'danger-soft': theme.colors.buttonDangerDisabledBackground,
    ghost: 'transparent',
  }[variant];

  const enabledBorderColor = {
    primary: theme.colors.primary,
    secondary: theme.colors.borderStrong,
    outline: theme.colors.borderStrong,
    danger: theme.colors.danger,
    'danger-outline': theme.colors.danger,
    'danger-soft': 'transparent',
    ghost: theme.colors.borderStrong,
  }[variant];

  const disabledBorderColor = {
    primary: theme.colors.buttonPrimaryDisabledBorder,
    secondary: theme.colors.buttonSecondaryDisabledBorder,
    outline: theme.colors.buttonOutlineDisabledBorder,
    danger: theme.colors.buttonDangerDisabledBorder,
    'danger-outline': theme.colors.buttonDangerDisabledBorder,
    'danger-soft': 'transparent',
    ghost: theme.colors.buttonOutlineDisabledBorder,
  }[variant];

  const enabledTextColor = {
    primary: theme.colors.onPrimary,
    secondary: theme.colors.text,
    outline: theme.colors.text,
    danger: theme.colors.onDanger,
    'danger-outline': theme.colors.danger,
    'danger-soft': theme.colors.danger,
    ghost: theme.colors.text,
  }[variant];

  const disabledTextColor = {
    primary: theme.colors.buttonPrimaryDisabledText,
    secondary: theme.colors.buttonSecondaryDisabledText,
    outline: theme.colors.buttonOutlineDisabledText,
    danger: theme.colors.buttonDangerDisabledText,
    'danger-outline': theme.colors.buttonDangerDisabledText,
    'danger-soft': theme.colors.buttonDangerDisabledText,
    ghost: theme.colors.buttonOutlineDisabledText,
  }[variant];

  const backgroundColor = isDisabled ? disabledBackgroundColor : enabledBackgroundColor;
  const borderColor = isDisabled ? disabledBorderColor : enabledBorderColor;
  const textColor = isDisabled ? disabledTextColor : enabledTextColor;
  const iconColor = textColor;
  const iconSize = size === 'sm' ? theme.iconSize.sm : size === 'lg' ? theme.iconSize.lg : theme.iconSize.md;
  const borderWidth = variant === 'danger-soft' || variant === 'ghost' ? 0 : theme.borderWidth.thin;

  return (
    <Pressable
      {...pressableProps}
      testID={testID}
      hitSlop={hitSlop ?? sizeHitSlop[size]}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPressIn={(e) => {
        setPressed(true);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        onPressOut?.(e);
      }}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor,
          height: sizeHeight[size],
          borderRadius: theme.radius.md,
          paddingVertical: sizePaddingVertical[size],
          paddingHorizontal: sizePaddingHorizontal[size],
          opacity: pressed && !isDisabled ? theme.opacity.pressed : 1,
          borderWidth,
          borderColor,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        // Resolved to a plain object/array here so the Pressable below never receives a function
        // `style` — see CLAUDE.md Part 7 rule 15.
        typeof style === 'function' ? style({ pressed, hovered: false }) : style,
      ]}
    >
      {loading ? (
        <>
          <ActivityIndicator
            size="small"
            color={
              isDisabled
                ? textColor
                : variant === 'primary'
                  ? theme.colors.onPrimary
                  : variant === 'danger'
                    ? theme.colors.onDanger
                    : textColor
            }
            style={{ marginRight: theme.spacing.sm }}
          />
          <Text variant="label" weight="semibold" style={{ color: textColor }}>
            {loadingLabel ?? t('common.loading', 'Loading…')}
          </Text>
        </>
      ) : (
        <>
          {Icon !== undefined ? <Icon size={iconSize} color={iconColor} style={{ marginRight: theme.spacing.sm }} /> : null}
          <Text variant="label" weight="semibold" style={{ color: textColor }}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}
