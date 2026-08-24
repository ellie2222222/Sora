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
 * Monetary figures are tabular-aligned so a column of amounts does not jitter
 * as digits change width.
 */
export const numericFontVariant: NonNullable<TextStyle['fontVariant']> = ['tabular-nums'];

export type FontSize = typeof fontSize;
export type FontWeight = typeof fontWeight;
