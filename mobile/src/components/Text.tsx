import { createContext, useContext } from 'react';
import { Text as RNText, type DimensionValue, type TextProps as RNTextProps } from 'react-native';
import Animated from 'react-native-reanimated';

import { Skeleton } from './Skeleton.tsx';

import { useTheme } from '@/app/providers';
import type { FontSize, FontWeight } from '@/design-system';

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
  /** If true, renders a skeleton block matching the text's line height. */
  isLoading?: boolean;
  /** Width of the skeleton block if isLoading is true. Defaults to 100%. */
  skeletonWidth?: DimensionValue;
}

const VARIANT_SIZE: Record<TextVariant, SizeKey> = {
  body: 'md',
  label: 'sm',
  // Not xs: captions are mostly muted, and muted text needs sm or larger to stay readable (DESIGN_GUIDELINES "Type size and tone").
  caption: 'sm',
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

// A span inside another Text is laid out by its parent, so only the outermost one carries the colour transition.
const InsideText = createContext(false);

export function Text({
  variant = 'body',
  tone,
  weight,
  numeric = false,
  isLoading = false,
  skeletonWidth = '100%',
  style,
  ...props
}: TextComponentProps) {
  const theme = useTheme();
  const nested = useContext(InsideText);

  if (isLoading) {
    return <Skeleton width={skeletonWidth} height={theme.sizes.skeletonLine[variant]} radius={theme.radius.sm} />;
  }

  const color = {
    default: theme.colors.text,
    muted: theme.colors.textMuted,
    faint: theme.colors.textFaint,
    danger: theme.colors.danger,
    success: theme.colors.success,
    onPrimary: theme.colors.onPrimary,
  }[tone ?? 'default'];

  const textStyle = [
    {
      // A span with no tone of its own takes its parent's colour, so it eases along with it.
      color: nested && tone === undefined ? undefined : color,
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
  ];

  if (nested) return <RNText {...props} style={textStyle} />;
  return (
    <InsideText.Provider value>
      <Animated.Text {...props} style={[textStyle, theme.motion.colorTransition]} />
    </InsideText.Provider>
  );
}
