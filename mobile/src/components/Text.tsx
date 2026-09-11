import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { useTheme } from '../app/providers/ThemeProvider.tsx';
import type { FontSize, FontWeight } from '../design-system/index.ts';

type TextVariant = 'body' | 'label' | 'caption' | 'title' | 'heading';
type TextTone = 'default' | 'muted' | 'faint' | 'danger' | 'success' | 'onPrimary';
type SizeKey = keyof FontSize;
type WeightKey = keyof FontWeight;

export interface TextComponentProps extends RNTextProps {
  variant?: TextVariant;
  tone?: TextTone;
  weight?: WeightKey;
  /** Tabular figures for anything money-shaped, so digits align in a list. */
  numeric?: boolean;
}

const VARIANT_SIZE: Record<TextVariant, SizeKey> = {
  body: 'md',
  label: 'sm',
  caption: 'xs',
  title: 'xl',
  heading: 'xxl',
};

const VARIANT_WEIGHT: Record<TextVariant, WeightKey> = {
  body: 'regular',
  label: 'medium',
  caption: 'regular',
  title: 'semibold',
  heading: 'bold',
};

export function Text({
  variant = 'body',
  tone = 'default',
  weight,
  numeric = false,
  style,
  ...props
}: TextComponentProps) {
  const theme = useTheme();

  const color = {
    default: theme.colors.text,
    muted: theme.colors.textMuted,
    faint: theme.colors.textFaint,
    danger: theme.colors.danger,
    success: theme.colors.success,
    onPrimary: theme.colors.onPrimary,
  }[tone];

  return (
    <RNText
      {...props}
      style={[
        {
          color,
          fontSize: theme.fontSize[VARIANT_SIZE[variant]],
          // No fontWeight here: Mulish ships one static file per weight, and
          // pairing a custom fontFamily with an explicit fontWeight makes
          // Android's Typeface.create() look for a bold/normal *variant* of
          // that exact family name, fail to find one, and silently fall back
          // to the system font — the weight already lives in which font file
          // this is.
          fontFamily: theme.fontFamily[weight ?? VARIANT_WEIGHT[variant]],
          fontVariant: numeric ? theme.numericFontVariant : undefined,
        },
        style,
      ]}
    />
  );
}
