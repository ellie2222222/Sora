import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { CategorySpendSlice } from '@sora/contracts';

import { useTheme } from '@/app/providers';
import { Text } from './Text.tsx';

export interface DonutChartProps {
  slices: CategorySpendSlice[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerSublabel?: string;
}

/** Static SVG donut via stroke-dasharray segments. `percentage` is server-computed (BR-05); this only lays it out. */
export function DonutChart({ slices, size: sizeProp, strokeWidth: strokeWidthProp, centerLabel, centerSublabel }: DonutChartProps) {
  const theme = useTheme();
  const size = sizeProp ?? theme.sizes.chart.largeHeight;
  const strokeWidth = strokeWidthProp ?? theme.sizes.chart.ringWidth;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let cumulativeLength = 0;

  return (
    <View className="items-center justify-center" style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={theme.colors.surfaceMuted} strokeWidth={strokeWidth} fill="none" />
        {slices.map((slice) => {
          const arcLength = (Math.max(slice.percentage, 0) / 100) * circumference;
          const dashOffset = -cumulativeLength;
          cumulativeLength += arcLength;
          return (
            <Circle
              key={slice.categoryId}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={slice.color ?? theme.colors.primary}
              strokeWidth={strokeWidth}
              strokeDasharray={`${arcLength} ${circumference - arcLength}`}
              strokeDashoffset={dashOffset}
              fill="none"
            />
          );
        })}
      </Svg>
      {centerLabel !== undefined || centerSublabel !== undefined ? (
        <View className="absolute items-center">
          {centerLabel !== undefined ? (
            <Text variant="title" weight="bold">
              {centerLabel}
            </Text>
          ) : null}
          {centerSublabel !== undefined ? (
            <Text variant="caption" tone="muted">
              {centerSublabel}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
