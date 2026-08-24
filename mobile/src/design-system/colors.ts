/**
 * Semantic colour tokens, five full themes.
 *
 * `income` and `expense` are separate tokens from `success` and `danger` on
 * purpose: an expense is not an error, and a green figure that means "money
 * arrived" must not be reused for "the save worked". `transfer` is a third
 * neutral-but-distinct hue because a transfer is neither — the product's most
 * consequential rule is that it counts as neither income nor spending.
 *
 * The five base semantic hues (income/expense/transfer/warning/danger/success)
 * are the SAME literal value in every theme — a theme changes the app's
 * atmosphere, not what "this was money out" looks like. Only their `*Muted`
 * chip-background variants differ, and only by two sets (one for Obsidian's
 * dark surfaces, one shared by the four light themes) rather than per-theme,
 * since a muted pill only needs to sit legibly on its own surface, not express
 * a distinct personality.
 */

export const THEME_NAMES = ['obsidian', 'quartz', 'sage', 'terracotta', 'violet'] as const;
export type ThemeName = (typeof THEME_NAMES)[number];

export const THEME_MODES = ['dark', 'light'] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

/** Obsidian is the only dark theme; the other four are light. */
export const THEME_MODE_OF: Record<ThemeName, ThemeMode> = {
  obsidian: 'dark',
  quartz: 'light',
  sage: 'light',
  terracotta: 'light',
  violet: 'light',
};

export const THEME_LABELS: Record<ThemeName, string> = {
  obsidian: 'Obsidian',
  quartz: 'Quartz',
  sage: 'Sage',
  terracotta: 'Terracotta',
  violet: 'Violet',
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

/** Same hue everywhere — see the module comment. Shared across all five themes. */
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

export const colorsByTheme: Record<ThemeName, ColorTokens> = {
  obsidian: {
    background: '#09090B',
    surface: '#141417',
    surfaceElevated: '#1C1C21',
    surfaceMuted: '#17171B',
    border: '#27272A',
    borderStrong: '#3F3F46',
    text: '#FAFAFA',
    textMuted: '#A1A1AA',
    textFaint: '#71717A',
    primary: '#60A5FA',
    primaryMuted: '#172554',
    onPrimary: '#0B1220',
    ...SEMANTIC_BASE,
    ...SEMANTIC_MUTED_DARK,
    overlay: 'rgba(3, 6, 10, 0.72)',
    skeleton: '#1E2833',
    shadow: '#000000',
  },
  quartz: {
    background: '#F7F8FA',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    surfaceMuted: '#F1F3F8',
    border: '#E5E7EB',
    borderStrong: '#D1D5DB',
    text: '#111827',
    textMuted: '#667085',
    textFaint: '#98A2B3',
    primary: '#4F46E5',
    primaryMuted: '#E0E7FF',
    onPrimary: '#FFFFFF',
    ...SEMANTIC_BASE,
    ...SEMANTIC_MUTED_LIGHT,
    overlay: 'rgba(17, 24, 39, 0.45)',
    skeleton: '#E3E9F1',
    shadow: '#0B1520',
  },
  sage: {
    background: '#F5F8F5',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    surfaceMuted: '#EAF2EC',
    border: '#DCE6DE',
    borderStrong: '#C3D2C7',
    text: '#17211B',
    textMuted: '#64746A',
    textFaint: '#8FA095',
    primary: '#0F766E',
    primaryMuted: '#CCFBF1',
    onPrimary: '#FFFFFF',
    ...SEMANTIC_BASE,
    ...SEMANTIC_MUTED_LIGHT,
    overlay: 'rgba(23, 33, 27, 0.45)',
    skeleton: '#E3ECE6',
    shadow: '#0E1A14',
  },
  terracotta: {
    background: '#F8F5F0',
    surface: '#FFFDF9',
    surfaceElevated: '#FFFDF9',
    surfaceMuted: '#F1EBE3',
    border: '#E7E0D8',
    borderStrong: '#D6CBBD',
    text: '#292524',
    textMuted: '#78716C',
    textFaint: '#A69C93',
    primary: '#C2410C',
    primaryMuted: '#FFEDD5',
    onPrimary: '#FFFFFF',
    ...SEMANTIC_BASE,
    ...SEMANTIC_MUTED_LIGHT,
    overlay: 'rgba(41, 37, 36, 0.45)',
    skeleton: '#EFE7DC',
    shadow: '#1F1A14',
  },
  violet: {
    background: '#F8F7FC',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    surfaceMuted: '#F1EEFA',
    border: '#E4E0EC',
    borderStrong: '#CFC7DE',
    text: '#18181B',
    textMuted: '#71717A',
    textFaint: '#A1A1AA',
    primary: '#7C3AED',
    primaryMuted: '#EDE9FE',
    onPrimary: '#FFFFFF',
    ...SEMANTIC_BASE,
    ...SEMANTIC_MUTED_LIGHT,
    overlay: 'rgba(24, 24, 27, 0.45)',
    skeleton: '#ECE9F5',
    shadow: '#14121B',
  },
};
