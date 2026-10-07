import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { THEME_MODES, THEME_NAMES, getThemeColors } from './colors.ts';
import { contrastRatio, ensureContrast, isHexColor, mixHex } from './contrast.ts';

// The starter category colours (packages/contracts/src/starter-categories.ts).
const STARTER_CATEGORY_COLORS = [
  '#F97316', '#0EA5E9', '#A855F7', '#EF4444', '#8B5CF6', '#F59E0B', '#F43F5E', '#EC4899', '#6366F1',
  '#14B8A6', '#8B5A2B', '#475569', '#D97706', '#CA8A04', '#DB2777', '#0D9488', '#B45309', '#57534E',
  '#BE185D', '#C2410C', '#0891B2', '#7C3AED', '#64748B', '#22C55E', '#10B981', '#059669', '#84CC16',
  '#16A34A', '#15803D', '#65A30D', '#4D7C0F', '#A16207', '#78716C',
];

describe('contrastRatio', () => {
  it('matches the WCAG reference values', () => {
    assert.equal(contrastRatio('#000000', '#FFFFFF'), 21);
    assert.equal(contrastRatio('#FFFFFF', '#FFFFFF'), 1);
    assert.equal(contrastRatio('#777777', '#FFFFFF').toFixed(2), '4.48');
  });

  it('is symmetric and accepts the 3-digit form', () => {
    assert.equal(contrastRatio('#FFF', '#000'), contrastRatio('#000000', '#ffffff'));
  });
});

describe('mixHex', () => {
  it('returns each endpoint at 0 and 1, and the midpoint at 0.5', () => {
    assert.equal(mixHex('#000000', '#FFFFFF', 0), '#000000');
    assert.equal(mixHex('#000000', '#FFFFFF', 1), '#FFFFFF');
    assert.equal(mixHex('#000000', '#FFFFFF', 0.5), '#808080');
  });
});

describe('isHexColor', () => {
  it('accepts #RGB and #RRGGBB only', () => {
    assert.ok(isHexColor('#abc'));
    assert.ok(isHexColor('#A1B2C3'));
    assert.ok(!isHexColor('red'));
    assert.ok(!isHexColor('#A1B2C3FF'));
    assert.ok(!isHexColor('A1B2C3'));
  });
});

describe('ensureContrast', () => {
  it('leaves a colour that already meets the ratio unchanged', () => {
    assert.equal(ensureContrast('#0f172a', '#FFFFFF', 4.5, '#000000'), '#0F172A');
  });

  it('blends toward the target until the ratio is met', () => {
    const adjusted = ensureContrast('#F59E0B', '#F1F5F9', 3, '#0F172A');
    assert.notEqual(adjusted, '#F59E0B');
    assert.ok(contrastRatio(adjusted, '#F1F5F9') >= 3);
  });

  it('falls back to the target for a value it cannot measure', () => {
    assert.equal(ensureContrast('tomato', '#FFFFFF', 3, '#0F172A'), '#0F172A');
  });

  it('makes every starter category colour readable on surfaceMuted in every palette and mode', () => {
    for (const themeName of THEME_NAMES) {
      for (const mode of THEME_MODES) {
        const { surfaceMuted, text } = getThemeColors(themeName, mode);
        for (const color of STARTER_CATEGORY_COLORS) {
          for (const min of [3, 4.5]) {
            const ratio = contrastRatio(ensureContrast(color, surfaceMuted, min, text), surfaceMuted);
            assert.ok(ratio >= min, `${color} on ${surfaceMuted} = ${ratio.toFixed(2)}:1 < ${min}, theme=${themeName}, mode=${mode}`);
          }
        }
      }
    }
  });
});
