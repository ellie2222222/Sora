import type { TextStyle } from 'react-native';

export const fontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 26,
  display: 34,
  hero: 42,
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
export type FontWeight = typeof fontWeight;
export type FontFamily = typeof fontFamily;
