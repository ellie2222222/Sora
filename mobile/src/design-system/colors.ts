/**
 * Semantic colour tokens and 100/300/600/900 palette ramps for every theme in `THEME_NAMES`.
 *
 * Each theme palette (Obsidian, Quartz, Sage, Terracotta, Violet) supports both
 * Light Mode and Dark Mode, adhering to the 60-30-10 rule:
 * - 60% dominant neutral background
 * - 30% surface cards, containers, and secondary text
 * - 10% accent color (the `600` slot in Light mode, `300` in Dark mode)
 *
 * Ramp keys name a role, not an exact shade: a slot holds whichever shade meets contrast for it.
 */

import { mixHex } from './contrast.ts';

export const THEME_NAMES = ['obsidian', 'quartz', 'sage', 'terracotta', 'violet'] as const;
export type ThemeName = (typeof THEME_NAMES)[number];

export const THEME_MODES = ['dark', 'light'] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

export interface PaletteRamp {
  100: string;
  300: string;
  600: string;
  900: string;
}

export const PALETTE_RAMPS: Record<ThemeName, PaletteRamp> = {
  obsidian: {
    100: '#DBEAFE',
    300: '#93C5FD',
    600: '#2563EB',
    900: '#1E3A8A',
  },
  quartz: {
    100: '#E0E7FF',
    300: '#A5B4FC',
    600: '#4F46E5',
    900: '#312E81',
  },
  sage: {
    100: '#CCFBF1',
    300: '#5EEAD4',
    600: '#0F766E', // teal-700: white on teal-600 is under 4.5:1
    900: '#134E4A',
  },
  terracotta: {
    100: '#FFEDD5',
    300: '#FDBA74',
    600: '#C2410C', // orange-700: white on orange-600 is under 4.5:1
    900: '#7C2D12',
  },
  violet: {
    100: '#EDE9FE',
    300: '#C4B5FD',
    600: '#7C3AED',
    900: '#4C1D95',
  },
};

export interface ColorTokens {
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceMuted: string;
  border: string;
  borderStrong: string;
  /** Boundary of an interactive control (input, field, checkbox, switch track): ≥3:1 on every surface. */
  borderControl: string;
  /** Pressed key/cell fill: visibly distinct from `surfaceElevated`, which `surfaceMuted` is not. */
  surfacePressed: string;
  text: string;
  textMuted: string;
  textFaint: string;
  primary: string;
  primaryMuted: string;
  onPrimary: string;
  onDanger: string;
  income: string;
  incomeMuted: string;
  expense: string;
  expenseMuted: string;
  transfer: string;
  transferMuted: string;
  info: string;
  infoMuted: string;
  warning: string;
  warningMuted: string;
  danger: string;
  dangerMuted: string;
  success: string;
  successMuted: string;
  overlay: string;
  skeleton: string;
  shadow: string;

  buttonPrimaryDisabledBackground: string;
  buttonPrimaryDisabledBorder: string;
  buttonPrimaryDisabledText: string;

  buttonSecondaryDisabledBackground: string;
  buttonSecondaryDisabledBorder: string;
  buttonSecondaryDisabledText: string;

  buttonOutlineDisabledBorder: string;
  buttonOutlineDisabledText: string;

  buttonDangerDisabledBackground: string;
  buttonDangerDisabledBorder: string;
  buttonDangerDisabledText: string;
}

/**
 * Feedback colours (toasts, banners, validation) — one hex per mode, fixed across every palette.
 * Light shades are darker so icons, borders and text keep ≥4.5:1 on white surfaces.
 */
export const STATUS_COLORS = {
  dark: {
    info: '#3B82F6',
    success: '#32D583',
    warning: '#F59E0B',
    danger: '#FF5C5C',
  },
  light: {
    info: '#2563EB',
    success: '#15803D',
    warning: '#B45309',
    danger: '#B91C1C',
  },
} as const satisfies Record<ThemeMode, Record<'info' | 'success' | 'warning' | 'danger', string>>;

/** Money-direction colours, one hex per mode; light shades stay ≥4.5:1 on white and on their tints. */
export const FLOW_COLORS = {
  dark: {
    income: '#32D583',
    expense: '#FF5C5C',
    transfer: '#EC4899',
  },
  light: {
    income: '#15803D',
    expense: '#B91C1C',
    transfer: '#BE185D',
  },
} as const satisfies Record<ThemeMode, Record<'income' | 'expense' | 'transfer', string>>;

/** Tinted backgrounds behind each semantic colour (chips, icon circles, soft buttons). */
const SEMANTIC_MUTED_DARK = {
  incomeMuted: '#0F2A1F',
  expenseMuted: '#2E1219',
  transferMuted: '#3A1230',
  infoMuted: '#101B33',
  successMuted: '#0F2A1F',
  warningMuted: '#2E2210',
  dangerMuted: '#33121A',
} as const;

const SEMANTIC_MUTED_LIGHT = {
  incomeMuted: '#F0FDF4',
  expenseMuted: '#FEF2F2',
  transferMuted: '#FDF2F8',
  infoMuted: '#EFF6FF',
  successMuted: '#F0FDF4',
  warningMuted: '#FFFBEB',
  dangerMuted: '#FEF2F2',
} as const;

// Selected rows put muted captions on the primary tint; the raw 100/900 shades are too saturated
// for 4.5:1 there, so the tint sits halfway toward the surface.
const PRIMARY_TINT_TOWARD_SURFACE = 0.5;

const DARK_SURFACE = '#141417';
const LIGHT_SURFACE = '#FFFFFF';

export function getThemeColors(name: ThemeName, mode: ThemeMode = 'dark'): ColorTokens {
  const ramp = PALETTE_RAMPS[name];
  const isDark = mode === 'dark';

  if (isDark) {
    return {
      background: '#09090B',
      surface: DARK_SURFACE,
      surfaceElevated: '#1C1C21',
      surfaceMuted: '#1B1B20',
      border: '#27272A',
      borderStrong: '#3F3F46',
      borderControl: '#6B6B74',
      surfacePressed: '#3F3F46',
      text: '#FAFAFA',
      textMuted: '#A1A1AA',
      textFaint: '#84848D',
      primary: ramp[300],
      primaryMuted: mixHex(ramp[900], DARK_SURFACE, PRIMARY_TINT_TOWARD_SURFACE),
      onPrimary: '#0B1220',
      onDanger: '#0B1220',
      ...FLOW_COLORS.dark,
      ...STATUS_COLORS.dark,
      ...SEMANTIC_MUTED_DARK,
      overlay: 'rgba(3, 6, 10, 0.72)',
      skeleton: '#1E2833',
      shadow: '#000000',

      buttonPrimaryDisabledBackground: ramp[900],
      buttonPrimaryDisabledBorder: '#3F3F46',
      buttonPrimaryDisabledText: '#A1A1AA',

      buttonSecondaryDisabledBackground: '#1B1B20',
      buttonSecondaryDisabledBorder: '#3F3F46',
      buttonSecondaryDisabledText: '#A1A1AA',

      buttonOutlineDisabledBorder: '#3F3F46',
      buttonOutlineDisabledText: '#A1A1AA',

      buttonDangerDisabledBackground: SEMANTIC_MUTED_DARK.dangerMuted,
      buttonDangerDisabledBorder: '#541C24',
      buttonDangerDisabledText: '#F87171',
    };
  }

  return {
    background: '#F8FAFC',
    surface: LIGHT_SURFACE,
    surfaceElevated: LIGHT_SURFACE,
    surfaceMuted: '#F1F5F9',
    border: '#E2E8F0',
    borderStrong: '#CBD5E1',
    borderControl: '#7C8799',
    surfacePressed: '#CBD5E1',
    text: '#0F172A',
    textMuted: '#475569',
    textFaint: '#627085',
    primary: ramp[600],
    primaryMuted: mixHex(ramp[100], LIGHT_SURFACE, PRIMARY_TINT_TOWARD_SURFACE),
    onPrimary: '#FFFFFF',
    onDanger: '#FFFFFF',
    ...FLOW_COLORS.light,
    ...STATUS_COLORS.light,
    ...SEMANTIC_MUTED_LIGHT,
    overlay: 'rgba(15, 23, 42, 0.45)',
    skeleton: '#E2E8F0',
    shadow: '#0F172A',

    buttonPrimaryDisabledBackground: ramp[100],
    buttonPrimaryDisabledBorder: ramp[300],
    buttonPrimaryDisabledText: ramp[900],

    buttonSecondaryDisabledBackground: '#F1F5F9',
    buttonSecondaryDisabledBorder: '#CBD5E1',
    buttonSecondaryDisabledText: '#64748B',

    buttonOutlineDisabledBorder: '#CBD5E1',
    buttonOutlineDisabledText: '#64748B',

    buttonDangerDisabledBackground: SEMANTIC_MUTED_LIGHT.dangerMuted,
    buttonDangerDisabledBorder: '#FECDD3',
    buttonDangerDisabledText: '#E11D48',
  };
}

