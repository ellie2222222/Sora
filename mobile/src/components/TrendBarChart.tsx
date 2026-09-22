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
export function TrendBarChart({ points, height = 140 }: TrendBarChartProps) {
  const theme = useTheme();
  const barAreaHeight = height - 20;
  const max = Math.max(1, ...points.flatMap((point) => [point.income, point.expense]));
  const scale = (value: number) => Math.max(2, (value / max) * barAreaHeight);

  const bar = (kind: 'income' | 'expense', value: number) => (
    <View
      key={kind}
      className="w-[6px]"
      style={{
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
            className="flex-row items-end gap-[3px]"
            style={{ height: barAreaHeight, justifyContent: 'flex-end' }}
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
