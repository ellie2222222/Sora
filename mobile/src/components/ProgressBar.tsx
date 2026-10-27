import { useTranslation } from 'react-i18next';

import { useTheme } from '@/app/providers';
import { ThemedView } from './Themed.tsx';

export interface ProgressBarProps {
  /** 0-100+; the bar caps at full width above 100. */
  percentage: number;
  tone?: 'primary' | 'income' | 'expense';
  danger?: boolean;
  height?: number;
  /** What the bar measures; defaults to the bare percentage. */
  accessibilityLabel?: string;
}

/**
 * `percentage` is allowed to exceed 100 — a budget that's over must be able to
 * say so (SRS FR-40: "you are 400,000 over" is the figure that matters). The
 * bar itself still visually caps at full width; `danger` is what actually
 * signals the overspend, not a bar that would overflow its own track.
 */
export function ProgressBar({ percentage, tone = 'primary', danger = false, height: heightProp, accessibilityLabel }: ProgressBarProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const height = heightProp ?? theme.sizes.progressBar.md;
  const clamped = Math.min(Math.max(percentage, 0), 100);

  const fillColor = danger
    ? theme.colors.danger
    : { primary: theme.colors.primary, income: theme.colors.income, expense: theme.colors.expense }[tone];

  return (
    <ThemedView
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel ?? t('common.percent', { percent: Math.round(percentage) })}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(percentage) }}
      className="overflow-hidden"
      style={{
        height,
        borderRadius: theme.radius.pill,
        backgroundColor: theme.colors.surfaceMuted,
      }}
    >
      <ThemedView
        className="h-full"
        style={{
          width: `${clamped}%`,
          borderRadius: theme.radius.pill,
          backgroundColor: fillColor,
        }}
      />
    </ThemedView>
  );
}
