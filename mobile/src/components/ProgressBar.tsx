import { View } from 'react-native';

import { useTheme } from '@/app/providers';

export interface ProgressBarProps {
  /** 0-100+; the bar caps at full width above 100. */
  percentage: number;
  tone?: 'primary' | 'income' | 'expense';
  danger?: boolean;
  height?: number;
}

/**
 * `percentage` is allowed to exceed 100 — a budget that's over must be able to
 * say so (SRS FR-40: "you are 400,000 over" is the figure that matters). The
 * bar itself still visually caps at full width; `danger` is what actually
 * signals the overspend, not a bar that would overflow its own track.
 */
export function ProgressBar({ percentage, tone = 'primary', danger = false, height: heightProp }: ProgressBarProps) {
  const theme = useTheme();
  const height = heightProp ?? theme.sizes.progressBar.md;
  const clamped = Math.min(Math.max(percentage, 0), 100);

  const fillColor = danger
    ? theme.colors.danger
    : { primary: theme.colors.primary, income: theme.colors.income, expense: theme.colors.expense }[tone];

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(percentage) }}
      className="overflow-hidden"
      style={{
        height,
        borderRadius: theme.radius.pill,
        backgroundColor: theme.colors.surfaceMuted,
      }}
    >
      <View
        className="h-full"
        style={{
          width: `${clamped}%`,
          borderRadius: theme.radius.pill,
          backgroundColor: fillColor,
        }}
      />
    </View>
  );
}
