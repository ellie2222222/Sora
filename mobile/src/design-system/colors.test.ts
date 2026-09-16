import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  THEME_MODES,
  THEME_NAMES,
  getThemeColors,
  type ColorTokens,
  type ThemeMode,
  type ThemeName,
} from './colors.ts';

function hexToRgb(hex: string): [number, number, number] {
  const cleaned = hex.replace('#', '');
  if (cleaned.length === 3) {
    const r = cleaned.charAt(0);
    const g = cleaned.charAt(1);
    const b = cleaned.charAt(2);
    return [parseInt(r + r, 16), parseInt(g + g, 16), parseInt(b + b, 16)];
  }
  return [
    parseInt(cleaned.substring(0, 2), 16),
    parseInt(cleaned.substring(2, 4), 16),
    parseInt(cleaned.substring(4, 6), 16),
  ];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const rs = toLinear(r);
  const gs = toLinear(g);
  const bs = toLinear(b);
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hexToRgb(hex1));
  const l2 = relativeLuminance(hexToRgb(hex2));
  const brighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (brighter + 0.05) / (darker + 0.05);
}

describe('Design System - Disabled Button Tokens', () => {
  const themes: ThemeName[] = [...THEME_NAMES];
  const modes: ThemeMode[] = [...THEME_MODES];

  it('provides all disabled tokens across all 5 themes in both dark and light modes', () => {
    const requiredDisabledTokens: (keyof ColorTokens)[] = [
      'buttonDisabledBackground',
      'buttonDisabledBorder',
      'buttonDisabledText',
      'buttonPrimaryDisabledBackground',
      'buttonPrimaryDisabledBorder',
      'buttonPrimaryDisabledText',
      'buttonSecondaryDisabledBackground',
      'buttonSecondaryDisabledBorder',
      'buttonSecondaryDisabledText',
      'buttonOutlineDisabledBorder',
      'buttonOutlineDisabledText',
      'buttonDangerDisabledBackground',
      'buttonDangerDisabledBorder',
      'buttonDangerDisabledText',
    ];

    for (const themeName of themes) {
      for (const mode of modes) {
        const colors = getThemeColors(themeName, mode);
        for (const token of requiredDisabledTokens) {
          const value = colors[token];
          assert.ok(
            typeof value === 'string' && value.length > 0,
            `Expected ${token} to be defined for theme=${themeName}, mode=${mode}`,
          );
          assert.ok(
            value.startsWith('#') || value.startsWith('rgba'),
            `Expected ${token} to be a valid color string, got "${value}"`,
          );
        }
      }
    }
  });

  it('preserves distinct variant semantics in disabled state', () => {
    for (const themeName of themes) {
      for (const mode of modes) {
        const colors = getThemeColors(themeName, mode);

        // Danger disabled background must match dangerMuted, retaining danger identity
        assert.equal(
          colors.buttonDangerDisabledBackground,
          colors.dangerMuted,
          `Danger disabled background should be dangerMuted in theme=${themeName}, mode=${mode}`,
        );

        // Danger disabled background must not be identical to secondary neutral background
        assert.notEqual(
          colors.buttonDangerDisabledBackground,
          colors.buttonSecondaryDisabledBackground,
          `Danger disabled background should differ from secondary in theme=${themeName}, mode=${mode}`,
        );

        // Danger disabled text should be red-tinted, not generic textMuted
        assert.notEqual(
          colors.buttonDangerDisabledText,
          colors.textMuted,
          `Danger disabled text should be red-tinted in theme=${themeName}, mode=${mode}`,
        );

        // Primary disabled background must not be completely transparent
        assert.notEqual(
          colors.buttonPrimaryDisabledBackground,
          'transparent',
          `Primary disabled background should not be transparent in theme=${themeName}, mode=${mode}`,
        );

        // Secondary disabled background must not be completely transparent
        assert.notEqual(
          colors.buttonSecondaryDisabledBackground,
          'transparent',
          `Secondary disabled background should not be transparent in theme=${themeName}, mode=${mode}`,
        );

        // Borders must be present and visible
        assert.notEqual(
          colors.buttonPrimaryDisabledBorder,
          'transparent',
          `Primary disabled border should not be transparent in theme=${themeName}, mode=${mode}`,
        );
        assert.notEqual(
          colors.buttonSecondaryDisabledBorder,
          'transparent',
          `Secondary disabled border should not be transparent in theme=${themeName}, mode=${mode}`,
        );
        assert.notEqual(
          colors.buttonOutlineDisabledBorder,
          'transparent',
          `Outline disabled border should not be transparent in theme=${themeName}, mode=${mode}`,
        );
        assert.notEqual(
          colors.buttonDangerDisabledBorder,
          'transparent',
          `Danger disabled border should not be transparent in theme=${themeName}, mode=${mode}`,
        );
      }
    }
  });

  it('ensures disabled text maintains readable contrast against disabled background (>= 3.0:1)', () => {
    for (const themeName of themes) {
      for (const mode of modes) {
        const colors = getThemeColors(themeName, mode);

        // Primary disabled text vs Primary disabled background
        const primaryContrast = contrastRatio(
          colors.buttonPrimaryDisabledText,
          colors.buttonPrimaryDisabledBackground,
        );
        assert.ok(
          primaryContrast >= 3.0,
          `Primary disabled contrast too low (${primaryContrast.toFixed(2)}:1) for theme=${themeName}, mode=${mode}`,
        );

        // Secondary disabled text vs Secondary disabled background
        const secondaryContrast = contrastRatio(
          colors.buttonSecondaryDisabledText,
          colors.buttonSecondaryDisabledBackground,
        );
        assert.ok(
          secondaryContrast >= 3.0,
          `Secondary disabled contrast too low (${secondaryContrast.toFixed(2)}:1) for theme=${themeName}, mode=${mode}`,
        );

        // Danger disabled text vs Danger disabled background
        const dangerContrast = contrastRatio(
          colors.buttonDangerDisabledText,
          colors.buttonDangerDisabledBackground,
        );
        assert.ok(
          dangerContrast >= 3.0,
          `Danger disabled contrast too low (${dangerContrast.toFixed(2)}:1) for theme=${themeName}, mode=${mode}`,
        );

        // Outline disabled text vs Surface
        const outlineContrast = contrastRatio(
          colors.buttonOutlineDisabledText,
          colors.surface,
        );
        assert.ok(
          outlineContrast >= 3.0,
          `Outline disabled contrast too low (${outlineContrast.toFixed(2)}:1) for theme=${themeName}, mode=${mode}`,
        );
      }
    }
  });
});
