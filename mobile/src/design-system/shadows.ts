import { Platform, type ViewStyle } from 'react-native';

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const value = parseInt(normalized, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Elevation is expressed three ways because each platform reads a different
 * property: Android only `elevation`, iOS the shadow* family, and web the
 * `shadow*` props are deprecated in favour of the CSS `boxShadow` shorthand.
 */
function elevate(level: number, shadowColor: string): ViewStyle {
  const opacity = 0.18 + level * 0.01;
  const radius = level * 1.6;
  const offsetY = Math.max(1, Math.round(level / 2));

  return Platform.select({
    android: { elevation: level, shadowColor },
    web: { boxShadow: `0px ${offsetY}px ${radius}px ${hexToRgba(shadowColor, opacity)}` },
    default: {
      shadowColor,
      shadowOpacity: opacity,
      shadowRadius: radius,
      shadowOffset: { width: 0, height: offsetY },
    },
  }) as ViewStyle;
}

export function buildShadows(shadowColor: string) {
  return {
    none: {} as ViewStyle,
    xs: elevate(1, shadowColor),
    sm: elevate(2, shadowColor),
    md: elevate(6, shadowColor),
    lg: elevate(12, shadowColor),
  } as const;
}

export type Shadows = ReturnType<typeof buildShadows>;
