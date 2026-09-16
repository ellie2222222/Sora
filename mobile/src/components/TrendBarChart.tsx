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

/** Paired income/expense bars per period — plain Views, no chart library needed for straight bars. */
export function TrendBarChart({ points, height = 140 }: TrendBarChartProps) {
  const theme = useTheme();
  const barAreaHeight = height - 20;
  const max = Math.max(1, ...points.flatMap((point) => [point.income, point.expense]));

  return (
    <View className="flex-row items-end" style={{ height, gap: theme.spacing.xs }}>
      {points.map((point) => (
        <View key={point.label} className="flex-1 items-center" style={{ gap: theme.spacing.xs }}>
          <View className="flex-row items-end gap-[3px]" style={{ height: barAreaHeight }}>
            <View
              className="w-[6px]"
              style={{
                borderRadius: theme.radius.pill,
                backgroundColor: theme.colors.income,
                height: Math.max(2, (point.income / max) * barAreaHeight),
              }}
            />
            <View
              className="w-[6px]"
              style={{
                borderRadius: theme.radius.pill,
                backgroundColor: theme.colors.expense,
                height: Math.max(2, (point.expense / max) * barAreaHeight),
              }}
            />
          </View>
          <Text variant="caption" tone="muted">
            {point.label}
          </Text>
        </View>
      ))}
    </View>
  );
}
