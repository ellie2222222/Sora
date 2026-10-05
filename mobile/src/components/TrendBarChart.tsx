import { View } from 'react-native';

import { useTheme } from '@/app/providers';
import { Text } from './Text.tsx';

export interface TrendBarChartPoint {
  label: string;
  income: number;
  expense: number;
}

export interface TrendBarChartProps {
  points: TrendBarChartPoint[];
  height?: number;
}

/** Income/expense bars per period — plain Views, no chart library needed for straight bars. */
export function TrendBarChart({ points, height: heightProp }: TrendBarChartProps) {
  const theme = useTheme();
  const height = heightProp ?? theme.sizes.chart.height;
  // Leaves one line of label text under the bars.
  const barAreaHeight = height - theme.lineHeight.md;
  const max = Math.max(1, ...points.flatMap((point) => [point.income, point.expense]));
  const scale = (value: number) => Math.max(theme.sizes.chart.minBarHeight, (value / max) * barAreaHeight);

  const bar = (kind: 'income' | 'expense', value: number) => (
    <View
      key={kind}
      style={{
        width: theme.sizes.chart.barWidth,
        borderRadius: theme.radius.pill,
        backgroundColor: kind === 'income' ? theme.colors.income : theme.colors.expense,
        height: scale(value),
      }}
    />
  );

  return (
    <View className="flex-row items-end" style={{ height, gap: theme.spacing.xs }}>
      {points.map((point) => (
        <View key={point.label} className="flex-1 items-center" style={{ gap: theme.spacing.xs }}>
          <View
            className="flex-row items-end"
            style={{ height: barAreaHeight, justifyContent: 'flex-end', gap: theme.spacing.xxs }}
          >
            {bar('income', point.income)}
            {bar('expense', point.expense)}
          </View>
          <Text variant="caption" tone="muted">
            {point.label}
          </Text>
        </View>
      ))}
    </View>
  );
}
