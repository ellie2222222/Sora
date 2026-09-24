import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  FLOW_COLORS,
  STATUS_COLORS,
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

describe('Design System - Status and flow colours', () => {
  it('uses the mode\'s one hex per status and flow colour in every palette', () => {
    for (const themeName of THEME_NAMES) {
      for (const mode of THEME_MODES) {
        const colors = getThemeColors(themeName, mode);
        for (const [token, hex] of Object.entries({ ...STATUS_COLORS[mode], ...FLOW_COLORS[mode] })) {
          assert.equal(colors[token as keyof ColorTokens], hex, `${token} drifted in theme=${themeName}, mode=${mode}`);
        }
      }
    }
  });
});

/** Every foreground/background pair a control actually renders — text 4.5:1, graphics 3:1 (WCAG 1.4.3 / 1.4.11). */
const RENDERED_PAIRS: { label: string; fg: keyof ColorTokens; bg: keyof ColorTokens; min: number }[] = [
  { label: 'primary button label', fg: 'onPrimary', bg: 'primary', min: 4.5 },
  { label: 'danger button label', fg: 'onDanger', bg: 'danger', min: 4.5 },
  { label: 'danger-soft/outline button label (Clear data)', fg: 'danger', bg: 'dangerMuted', min: 4.5 },
  { label: 'secondary button label', fg: 'text', bg: 'surfaceMuted', min: 4.5 },
  { label: 'outline/ghost button label', fg: 'text', bg: 'surface', min: 4.5 },
  { label: 'primary text/tab label on surface', fg: 'primary', bg: 'surface', min: 4.5 },
  { label: 'primary text on elevated surface', fg: 'primary', bg: 'surfaceElevated', min: 4.5 },
  { label: 'primary text on background', fg: 'primary', bg: 'background', min: 4.5 },
  { label: 'selected row: primary text on tint', fg: 'primary', bg: 'primaryMuted', min: 4.5 },
  { label: 'selected row: text on tint', fg: 'text', bg: 'primaryMuted', min: 4.5 },
  { label: 'selected row: muted caption on tint', fg: 'textMuted', bg: 'primaryMuted', min: 4.5 },
  { label: 'muted caption on warning tint', fg: 'textMuted', bg: 'warningMuted', min: 4.5 },
  { label: 'info on its tint', fg: 'info', bg: 'infoMuted', min: 4.5 },
  { label: 'success on its tint', fg: 'success', bg: 'successMuted', min: 4.5 },
  { label: 'warning on its tint', fg: 'warning', bg: 'warningMuted', min: 4.5 },
  { label: 'income on its tint', fg: 'income', bg: 'incomeMuted', min: 4.5 },
  { label: 'expense on its tint', fg: 'expense', bg: 'expenseMuted', min: 4.5 },
  { label: 'transfer on its tint', fg: 'transfer', bg: 'transferMuted', min: 4.5 },
  ...(['info', 'success', 'warning', 'danger', 'income', 'expense', 'transfer'] as const).flatMap((fg) =>
    (['background', 'surface', 'surfaceElevated'] as const).map((bg) => ({
      label: `${fg} text on ${bg}`,
      fg,
      bg,
      min: 4.5,
    })),
  ),
  // textFaint is real text (placeholders, empty states, captions, inactive tab labels), not decoration.
  ...(['text', 'textMuted', 'textFaint'] as const).flatMap((fg) =>
    (['background', 'surface', 'surfaceElevated', 'surfaceMuted'] as const).map((bg) => ({
      label: `${fg} on ${bg}`,
      fg,
      bg,
      min: 4.5,
    })),
  ),
  { label: 'danger-outline border against surface', fg: 'danger', bg: 'surface', min: 3 },
];

describe('Design System - Text hierarchy', () => {
  it('keeps text > textMuted > textFaint in contrast on every surface, so the three levels stay distinct', () => {
    for (const themeName of THEME_NAMES) {
      for (const mode of THEME_MODES) {
        const colors = getThemeColors(themeName, mode);
        for (const bg of [colors.background, colors.surface, colors.surfaceElevated, colors.surfaceMuted]) {
          const text = contrastRatio(colors.text, bg);
          const muted = contrastRatio(colors.textMuted, bg);
          const faint = contrastRatio(colors.textFaint, bg);
          assert.ok(text > muted && muted > faint, `hierarchy collapsed on ${bg}, theme=${themeName}, mode=${mode}`);
        }
      }
    }
  });
});

describe('Design System - Rendered contrast', () => {
  for (const pair of RENDERED_PAIRS) {
    it(`${pair.label} meets ${pair.min}:1 in every palette and mode`, () => {
      for (const themeName of THEME_NAMES) {
        for (const mode of THEME_MODES) {
          const colors = getThemeColors(themeName, mode);
          const ratio = contrastRatio(colors[pair.fg], colors[pair.bg]);
          assert.ok(
            ratio >= pair.min,
            `${pair.fg} ${colors[pair.fg]} on ${pair.bg} ${colors[pair.bg]} = ${ratio.toFixed(2)}:1, theme=${themeName}, mode=${mode}`,
          );
        }
      }
    });
  }
});
