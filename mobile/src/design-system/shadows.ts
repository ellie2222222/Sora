import { Platform, type ViewStyle } from 'react-native';

/**
 * Elevation is expressed twice because the two platforms read different
 * properties: iOS honours the shadow* family, Android only `elevation`.
 */
function elevate(level: number, shadowColor: string): ViewStyle {
  return Platform.select<ViewStyle>({
    android: { elevation: level, shadowColor },
    default: {
      shadowColor,
      shadowOpacity: 0.18 + level * 0.01,
      shadowRadius: level * 1.6,
      shadowOffset: { width: 0, height: Math.max(1, Math.round(level / 2)) },
    },
  }) as ViewStyle;
}

export function buildShadows(shadowColor: string) {
  return {
    none: {} as ViewStyle,
    sm: elevate(2, shadowColor),
    md: elevate(6, shadowColor),
    lg: elevate(12, shadowColor),
  } as const;
}

export type Shadows = ReturnType<typeof buildShadows>;
