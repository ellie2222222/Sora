/**
 * Semantic colour tokens and 300/600/900 palette ramps across five themes.
 *
 * Each theme palette (Obsidian, Quartz, Sage, Terracotta, Violet) supports both
 * Light Mode and Dark Mode, adhering to the 60-30-10 rule:
 * - 60% dominant neutral background
 * - 30% surface cards, containers, and secondary text
 * - 10% accent color (600 in Light mode, 300 in Dark mode)
 */

export const THEME_NAMES = ['obsidian', 'quartz', 'sage', 'terracotta', 'violet'] as const;
export type ThemeName = (typeof THEME_NAMES)[number];

export const THEME_MODES = ['dark', 'light'] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

export const THEME_LABELS: Record<ThemeName, string> = {
  obsidian: 'Obsidian',
  quartz: 'Quartz',
  sage: 'Sage',
  terracotta: 'Terracotta',
  violet: 'Violet',
};

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
    600: '#0D9488',
    900: '#134E4A',
  },
  terracotta: {
    100: '#FFEDD5',
    300: '#FDBA74',
    600: '#EA580C',
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
  text: string;
  textMuted: string;
  textFaint: string;
  primary: string;
  primaryMuted: string;
  onPrimary: string;
  income: string;
  incomeMuted: string;
  expense: string;
  expenseMuted: string;
  transfer: string;
  transferMuted: string;
  warning: string;
  warningMuted: string;
  danger: string;
  dangerMuted: string;
  success: string;
  overlay: string;
  skeleton: string;
  shadow: string;
}

const SEMANTIC_BASE = {
  income: '#22C55E',
  expense: '#EF4444',
  transfer: '#EC4899',
  warning: '#F59E0B',
  danger: '#EF4444',
  success: '#22C55E',
} as const;

const SEMANTIC_MUTED_DARK = {
  incomeMuted: '#0F2A1F',
  expenseMuted: '#2E1219',
  transferMuted: '#3A1230',
  warningMuted: '#2E2210',
  dangerMuted: '#33121A',
} as const;

const SEMANTIC_MUTED_LIGHT = {
  incomeMuted: '#E1F6EB',
  expenseMuted: '#FDE7EB',
  transferMuted: '#FCE7F3',
  warningMuted: '#FCF1DC',
  dangerMuted: '#FBE3E7',
} as const;

export function getThemeColors(name: ThemeName, mode: ThemeMode = 'dark'): ColorTokens {
  const ramp = PALETTE_RAMPS[name];
  const isDark = mode === 'dark';

  if (isDark) {
    return {
      background: '#09090B',
      surface: '#141417',
      surfaceElevated: '#1C1C21',
      surfaceMuted: '#1B1B20',
      border: '#27272A',
      borderStrong: '#3F3F46',
      text: '#FAFAFA',
      textMuted: '#A1A1AA',
      textFaint: '#71717A',
      primary: ramp[300],
      primaryMuted: ramp[900],
      onPrimary: '#0B1220',
      ...SEMANTIC_BASE,
      ...SEMANTIC_MUTED_DARK,
      overlay: 'rgba(3, 6, 10, 0.72)',
      skeleton: '#1E2833',
      shadow: '#000000',
    };
  }

  return {
    background: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    surfaceMuted: '#F1F5F9',
    border: '#E2E8F0',
    borderStrong: '#CBD5E1',
    text: '#0F172A',
    textMuted: '#64748B',
    textFaint: '#94A3B8',
    primary: ramp[600],
    primaryMuted: ramp[100],
    onPrimary: '#FFFFFF',
    ...SEMANTIC_BASE,
    ...SEMANTIC_MUTED_LIGHT,
    overlay: 'rgba(15, 23, 42, 0.45)',
    skeleton: '#E2E8F0',
    shadow: '#0F172A',
  };
}

export const colorsByTheme: Record<ThemeName, ColorTokens> = {
  obsidian: getThemeColors('obsidian', 'dark'),
  quartz: getThemeColors('quartz', 'light'),
  sage: getThemeColors('sage', 'light'),
  terracotta: getThemeColors('terracotta', 'light'),
  violet: getThemeColors('violet', 'light'),
};

