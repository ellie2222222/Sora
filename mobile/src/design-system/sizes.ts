/**
 * Component dimensions, icon sizes, border widths and opacities. Spacing, radius and type keep their
 * own scales; these are the remaining design values a component would otherwise hardcode.
 */
export const sizes = {
  /** Smallest comfortable hit area for anything tappable (DESIGN_GUIDELINES, Touch targets). */
  touchTarget: 44,
  /** Single-line form controls and keypad keys. */
  controlHeight: 48,
  /** Square or round holders for an icon, initials or a calendar day. */
  badge: { sm: 32, md: 36, lg: 40 },
  /** Status, legend and colour dots. */
  dot: { sm: 6, md: 8, lg: 10 },
  checkbox: 20,
  /** A transaction row keeps one height whether or not it has a second line. */
  listRowMinHeight: 58,
  /** Fits a three-letter currency code at the body font size. */
  currencyField: 88,
  /** Holds a sheet header's Cancel or Save so the title stays centred. */
  sheetHeaderAction: 64,
  sheetHandle: { width: 38, height: 4 },
  /** Keeps a detail sheet from resizing while its content loads. */
  sheetBodyMinHeight: 400,
  /** Floating create button; a list under it pads its end by `fabListPaddingBottom`. */
  fab: 48,
  tabBar: { height: 56, indicatorWidth: 36 },
  /** Track thickness: `sm` for a comparison row, `md` in a list card, `lg` in a detail sheet. */
  progressBar: { sm: 6, md: 8, lg: 12 },
  /** The guest upload's progress ring; `glow` is the square its soft halo is drawn in. */
  syncRing: { size: 128, stroke: 3, glow: 224 },
  /** Revealed action under a swiped row: a short label on one line under its icon. */
  swipeAction: 76,
  /** Scrolling lists inside sheets and dialogs stop growing here and scroll instead. */
  listMaxHeight: { sm: 220, md: 360, lg: 420 },
  /** A label in a compact chip truncates past this. */
  chipLabelMaxWidth: 120,
  /** Centred explanatory copy wraps here instead of running the full width. */
  readableWidth: 260,
  /** `minBarHeight` keeps a zero or tiny value visible as a sliver. */
  chart: { height: 140, largeHeight: 160, barWidth: 6, minBarHeight: 2, ringWidth: 20 },
  /** Theme palette preview in Appearance settings. */
  swatch: { width: 32, height: 24 },
  /** The light/dark switch, one entry per `ThemeToggle` size. */
  toggle: {
    sm: { trackWidth: 48, trackHeight: 26, thumb: 20 },
    md: { trackWidth: 58, trackHeight: 30, thumb: 24 },
    lg: { trackWidth: 70, trackHeight: 36, thumb: 30 },
  },
  /** Placeholder line heights, named after the `Text` variant each stands in for. */
  skeletonLine: { caption: 12, label: 14, body: 16, title: 20, heading: 24, display: 32 },
  /** Placeholder widths, from a short word to a long label. */
  skeletonWidth: { xxs: 20, xs: 40, sm: 60, md: 80, lg: 100, xl: 120, xxl: 140 },
  /** Placeholder heights for a whole card or panel rather than one line. */
  skeletonBlock: { sm: 80, md: 200, lg: 240 },
  /** Extra touch area around a small control, added on every side. */
  hitSlop: { sm: 4, md: 8, lg: 12 },
} as const;

export const iconSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 22,
  /** The single large glyph of an empty, error or invitation screen. */
  hero: 40,
} as const;

/** Lucide's own default is `regular`, so an icon that passes no `strokeWidth` already uses it. */
export const iconStroke = {
  thin: 1.5,
  regular: 2,
  bold: 2.5,
} as const;

export const borderWidth = {
  thin: 1,
  /** A focused or invalid field, and a checkbox outline. */
  medium: 1.5,
  /** A coloured accent edge or indicator bar. */
  thick: 3,
} as const;

export const opacity = {
  pressed: 0.85,
  /** A secondary figure shown beside the main one, e.g. a goal's target next to its progress. */
  muted: 0.6,
  disabled: 0.5,
} as const;

export type Sizes = typeof sizes;
export type IconSize = typeof iconSize;
export type IconStroke = typeof iconStroke;
export type BorderWidth = typeof borderWidth;
export type Opacity = typeof opacity;
