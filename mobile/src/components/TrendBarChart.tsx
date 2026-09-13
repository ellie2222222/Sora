import { View } from 'react-native';

import { useTheme } from '../app/providers/ThemeProvider.tsx';
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
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height, gap: theme.spacing.xs }}>
      {points.map((point) => (
        <View key={point.label} style={{ flex: 1, alignItems: 'center', gap: theme.spacing.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: barAreaHeight }}>
            <View
              style={{
                width: 6,
                borderRadius: theme.radius.pill,
                backgroundColor: theme.colors.income,
                height: Math.max(2, (point.income / max) * barAreaHeight),
              }}
            />
            <View
              style={{
                width: 6,
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
