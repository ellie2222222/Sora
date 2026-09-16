/**
 * Only layout-shaped tokens (spacing, radius, font size) are wired here.
 * Colour is deliberately absent: `theme.colors` is picked at runtime by
 * ThemeProvider — one of 5 named palettes (obsidian/quartz/sage/terracotta/
 * violet) x 2 modes, switchable in Settings — not a fixed build-time palette
 * a Tailwind class can resolve to. Colour (and anything else runtime-computed:
 * animated/reanimated styles, per-item tints) stays as inline `style`; layout
 * that is identical across every theme becomes a className. Keep this file
 * and mobile/src/design-system/{spacing,radius,typography}.ts in sync by hand
 * — there is no generator, so a token added to one and not the other silently
 * drifts.
 *
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  content: ['./index.js', './App.tsx', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      spacing: {
        none: '0px',
        xxs: '2px',
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
        xxl: '32px',
        huge: '48px',
      },
      borderRadius: {
        none: '0px',
        sm: '6px',
        md: '10px',
        lg: '14px',
        xl: '20px',
        xxl: '28px',
        pill: '999px',
      },
      fontSize: {
        xs: '11px',
        sm: '13px',
        md: '15px',
        lg: '17px',
        xl: '20px',
        xxl: '26px',
        display: '34px',
        hero: '42px',
      },
    },
  },
  plugins: [],
};
