import { colorsByTheme, THEME_MODE_OF, type ColorTokens, type ThemeMode, type ThemeName } from './colors.ts';
import { radius, type Radius } from './radius.ts';
import { buildShadows, type Shadows } from './shadows.ts';
import { spacing, type Spacing } from './spacing.ts';
import { fontSize, fontWeight, numericFontVariant, type FontSize, type FontWeight } from './typography.ts';

export interface Theme {
  name: ThemeName;
  /** Derived from `name` (Obsidian is dark, the other four are light) — only for choices that genuinely need dark-vs-light, e.g. the status bar style. */
  mode: ThemeMode;
  colors: ColorTokens;
  spacing: Spacing;
  radius: Radius;
  fontSize: FontSize;
  fontWeight: FontWeight;
  shadows: Shadows;
  numericFontVariant: typeof numericFontVariant;
}

export function buildTheme(name: ThemeName): Theme {
  const colors = colorsByTheme[name];
  return {
    name,
    mode: THEME_MODE_OF[name],
    colors,
    spacing,
    radius,
    fontSize,
    fontWeight,
    shadows: buildShadows(colors.shadow),
    numericFontVariant,
  };
}

export * from './colors.ts';
export * from './radius.ts';
export * from './shadows.ts';
export * from './spacing.ts';
export * from './typography.ts';
