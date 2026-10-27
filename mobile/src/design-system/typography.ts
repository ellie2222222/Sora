import type { TextStyle } from 'react-native';

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  display: 36,
  hero: 44,
} as const;

/** Line heights for multi-line copy that needs more room than the platform default. */
export const lineHeight = {
  sm: 20,
  md: 22,
  lg: 24,
} as const;

export const letterSpacing = {
  /** Dialog titles and body copy, opened up slightly for legibility. */
  wide: 0.2,
  /** Upper-case section labels. */
  caps: 1,
} as const;

export const fontWeight: Record<
  'regular' | 'medium' | 'semibold' | 'bold',
  NonNullable<TextStyle['fontWeight']>
> = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
};

/**
 * Mulish ships one static font file per weight (`@expo-google-fonts/mulish`),
 * so Android renders weight correctly only when `fontFamily` names the exact
 * weight — a single variable family plus numeric `fontWeight` silently falls
 * back to the platform default there.
 */
export const fontFamily: Record<'regular' | 'medium' | 'semibold' | 'bold', string> = {
  regular: 'Mulish_400Regular',
  medium: 'Mulish_500Medium',
  semibold: 'Mulish_600SemiBold',
  bold: 'Mulish_700Bold',
};

/**
 * Monetary figures are tabular-aligned so a column of amounts does not jitter
 * as digits change width.
 */
export const numericFontVariant: NonNullable<TextStyle['fontVariant']> = ['tabular-nums'];

export type FontSize = typeof fontSize;
export type LineHeight = typeof lineHeight;
export type LetterSpacing = typeof letterSpacing;
export type FontWeight = typeof fontWeight;
export type FontFamily = typeof fontFamily;
