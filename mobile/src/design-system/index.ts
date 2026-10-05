import { getThemeColors, type ColorTokens, type ThemeMode, type ThemeName } from './colors.ts';
import { radius, type Radius } from './radius.ts';
import { buildShadows, type Shadows } from './shadows.ts';
import {
  borderWidth,
  iconSize,
  iconStroke,
  opacity,
  sizes,
  type BorderWidth,
  type IconSize,
  type IconStroke,
  type Opacity,
  type Sizes,
} from './sizes.ts';
import { spacing, type Spacing } from './spacing.ts';
import {
  fontFamily,
  fontSize,
  fontWeight,
  letterSpacing,
  lineHeight,
  numericFontVariant,
  type FontFamily,
  type FontSize,
  type FontWeight,
  type LetterSpacing,
  type LineHeight,
} from './typography.ts';

export interface Theme {
  name: ThemeName;
  mode: ThemeMode;
  colors: ColorTokens;
  spacing: Spacing;
  radius: Radius;
  fontSize: FontSize;
  fontWeight: FontWeight;
  fontFamily: FontFamily;
  lineHeight: LineHeight;
  letterSpacing: LetterSpacing;
  sizes: Sizes;
  iconSize: IconSize;
  iconStroke: IconStroke;
  borderWidth: BorderWidth;
  opacity: Opacity;
  shadows: Shadows;
  numericFontVariant: typeof numericFontVariant;
}

export function buildTheme(name: ThemeName, mode: ThemeMode = 'dark'): Theme {
  const colors = getThemeColors(name, mode);
  return {
    name,
    mode,
    colors,
    spacing,
    radius,
    fontSize,
    fontWeight,
    fontFamily,
    lineHeight,
    letterSpacing,
    sizes,
    iconSize,
    iconStroke,
    borderWidth,
    opacity,
    shadows: buildShadows(colors.shadow),
    numericFontVariant,
  };
}

export * from './colors.ts';
export * from './contrast.ts';
export * from './radius.ts';
export * from './shadows.ts';
export * from './sizes.ts';
export * from './spacing.ts';
export * from './typography.ts';
