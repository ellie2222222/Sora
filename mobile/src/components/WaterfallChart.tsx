import { View } from 'react-native';

import { useTheme } from '@/app/providers';
import { Text } from './Text.tsx';

export interface WaterfallPoint {
  label: string;
  /**
   * The step's size in any one consistent unit the caller chooses — a share of
   * some common denominator, computed in scaled-bigint space (never a money
   * figure widened into a JS number, rule 1). Always positive; `kind` carries
   * the direction.
   */
  value: number;
  /**
   * `start`/`end` are absolute totals drawn from the baseline; `increase` and
   * `decrease` are the steps between them and float at the running total.
   */
  kind: 'start' | 'increase' | 'decrease' | 'end';
}

export interface WaterfallChartProps {
  points: WaterfallPoint[];
  height?: number;
  testID?: string;
}

interface Bar {
  point: WaterfallPoint;
  /** Both in the caller's unit, `low` <= `high`. */
  low: number;
  high: number;
}

/**
 * Opening balance → income → expense → transfers → closing balance, as floating
 * bars.
 *
 * Plain Views rather than a chart library, matching `TrendBarChart` — a
 * waterfall is rectangles at computed offsets, which is not worth a dependency.
 * The vertical scale is derived from the running total's own range rather than
 * from the largest single step, so a series whose running total overshoots any
 * one step still fits inside the plot.
 */
export function WaterfallChart({ points, height = 160, testID }: WaterfallChartProps) {
  const theme = useTheme();
  const plotHeight = height - 22;

  const bars: Bar[] = [];
  let running = 0;
  for (const point of points) {
    if (point.kind === 'start' || point.kind === 'end') {
      const total = point.kind === 'start' ? point.value : running;
      bars.push({ point, low: Math.min(0, total), high: Math.max(0, total) });
      if (point.kind === 'start') running = total;
      continue;
    }
    const next = point.kind === 'increase' ? running + point.value : running - point.value;
    bars.push({ point, low: Math.min(running, next), high: Math.max(running, next) });
    running = next;
  }

  // The baseline is included so a series that never crosses zero still draws
  // against it rather than floating in an arbitrary window.
  const lowest = Math.min(0, ...bars.map((bar) => bar.low));
  const highest = Math.max(0, ...bars.map((bar) => bar.high));
  const span = highest - lowest || 1;
  const toOffset = (value: number) => ((value - lowest) / span) * plotHeight;

  const colorFor = (kind: WaterfallPoint['kind']) =>
    kind === 'increase'
      ? theme.colors.income
      : kind === 'decrease'
        ? theme.colors.expense
        : theme.colors.primary;

  return (
    <View testID={testID} className="flex-row items-end" style={{ height, gap: theme.spacing.xs }}>
      {bars.map((bar) => (
        <View key={bar.point.label} className="flex-1 items-center" style={{ gap: theme.spacing.xs }}>
          <View className="w-full" style={{ height: plotHeight, justifyContent: 'flex-end' }}>
            <View
              className="w-full"
              style={{
                // A zero-size step still draws a hairline: "nothing moved" is a
                // reading, and an invisible bar looks like missing data.
                height: Math.max(2, toOffset(bar.high) - toOffset(bar.low)),
                marginBottom: toOffset(bar.low),
                backgroundColor: colorFor(bar.point.kind),
                borderRadius: theme.radius.sm,
                opacity: bar.point.kind === 'start' || bar.point.kind === 'end' ? 0.55 : 1,
              }}
            />
          </View>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {bar.point.label}
          </Text>
        </View>
      ))}
    </View>
  );
}
