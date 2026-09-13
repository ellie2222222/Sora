import { getThemeColors, type ColorTokens, type ThemeMode, type ThemeName } from './colors.ts';
import { radius, type Radius } from './radius.ts';
import { buildShadows, type Shadows } from './shadows.ts';
import { spacing, type Spacing } from './spacing.ts';
import { fontFamily, fontSize, fontWeight, numericFontVariant, type FontFamily, type FontSize, type FontWeight } from './typography.ts';

export interface Theme {
  name: ThemeName;
  mode: ThemeMode;
  colors: ColorTokens;
  spacing: Spacing;
  radius: Radius;
  fontSize: FontSize;
  fontWeight: FontWeight;
  fontFamily: FontFamily;
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
    shadows: buildShadows(colors.shadow),
    numericFontVariant,
  };
}

export * from './colors.ts';
export * from './radius.ts';
export * from './shadows.ts';
export * from './spacing.ts';
export * from './typography.ts';
