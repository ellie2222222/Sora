import { View } from 'react-native';

import { useTheme } from '@/app/providers';

export interface ProgressBarProps {
  /** 0-100+; values above 100 render as a full, danger-coloured bar. */
  percentage: number;
  tone?: 'primary' | 'income' | 'expense';
  danger?: boolean;
  height?: number;
}

/**
 * `percentage` is allowed to exceed 100 — a budget that's over must be able to
 * say so (CLAUDE.md: "you are 400,000 over" is the figure that matters). The
 * bar itself still visually caps at full width; `danger` is what actually
 * signals the overspend, not a bar that would overflow its own track.
 */
export function ProgressBar({ percentage, tone = 'primary', danger = false, height = 8 }: ProgressBarProps) {
  const theme = useTheme();
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
        borderRadius: height / 2,
        backgroundColor: theme.colors.surfaceMuted,
      }}
    >
      <View
        className="h-full"
        style={{
          width: `${clamped}%`,
          borderRadius: height / 2,
          backgroundColor: fillColor,
        }}
      />
    </View>
  );
}
