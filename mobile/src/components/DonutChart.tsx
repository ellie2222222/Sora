import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, G, Polyline } from 'react-native-svg';
import type { CategorySpendSlice } from '@sora/contracts';

import { useTheme } from '@/app/providers';
import { groupDonutSlices, layoutDonutCallouts } from '@/utils';
import { Text } from './Text.tsx';

export interface DonutChartProps {
  slices: CategorySpendSlice[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerSublabel?: string;
  /** Label slices beside the ring with a leader line to each; the chart then takes its container's full width. */
  callouts?: boolean;
}

/** The ring answers "where did most of it go", so only the largest few get their own arc and label. */
const SLICES_SHOWN = 3;
const OTHERS_ID = 'others';

interface DrawnSlice {
  id: string;
  name: string;
  color: string;
  percentage: number;
}

/** Static SVG donut via stroke-dasharray segments. `percentage` is server-computed (BR-05); this only lays it out. */
export function DonutChart({ slices, size: sizeProp, strokeWidth: strokeWidthProp, centerLabel, centerSublabel, callouts = false }: DonutChartProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [containerWidth, setContainerWidth] = useState(0);
  const size = sizeProp ?? theme.sizes.chart.largeHeight;
  const strokeWidth = strokeWidthProp ?? theme.sizes.chart.ringWidth;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const { top, othersPercentage } = groupDonutSlices(slices, SLICES_SHOWN);
  const drawn: DrawnSlice[] = top.map((slice) => ({
    id: slice.categoryId,
    name: slice.categoryName,
    color: slice.color ?? theme.colors.primary,
    percentage: slice.percentage,
  }));
  if (othersPercentage > 0) {
    drawn.push({ id: OTHERS_ID, name: t('dashboard.otherCategories'), color: theme.colors.borderStrong, percentage: othersPercentage });
  }

  const width = callouts ? containerWidth : size;
  const ringOuter = size / 2;
  const labelHeight = theme.lineHeight.sm * 2;
  const labelGap = theme.spacing.xs;
  const column = ringOuter + theme.spacing.md + theme.spacing.sm;
  const labelWidth = Math.max(width / 2 - column - labelGap, 0);
  const layout = callouts
    ? layoutDonutCallouts(drawn, {
        width,
        minHeight: size + theme.spacing.xl * 2,
        ringOuter: ringOuter + theme.spacing.xxs,
        radial: theme.spacing.md,
        column,
        labelHeight,
      })
    : { height: size, callouts: [] };
  const height = layout.height;
  const placed = containerWidth > 0 ? layout.callouts : [];
  const cx = width / 2;
  const cy = height / 2;
  const drawnById = new Map(drawn.map((slice) => [slice.id, slice]));
  let cumulativeLength = 0;

  return (
    <View
      onLayout={callouts ? (event) => setContainerWidth(event.nativeEvent.layout.width) : undefined}
      className="items-center justify-center"
      style={callouts ? { alignSelf: 'stretch', height } : { width: size, height: size }}
    >
      {width > 0 ? (
        <Svg width={width} height={height}>
          <G rotation={-90} origin={`${cx}, ${cy}`}>
            <Circle cx={cx} cy={cy} r={radius} stroke={theme.colors.surfaceMuted} strokeWidth={strokeWidth} fill="none" />
            {drawn.map((slice) => {
              const arcLength = (Math.max(slice.percentage, 0) / 100) * circumference;
              const dashOffset = -cumulativeLength;
              cumulativeLength += arcLength;
              return (
                <Circle
                  key={slice.id}
                  cx={cx}
                  cy={cy}
                  r={radius}
                  stroke={slice.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${arcLength} ${circumference - arcLength}`}
                  strokeDashoffset={dashOffset}
                  fill="none"
                />
              );
            })}
          </G>
          {placed.map((callout) => (
            <Polyline
              key={callout.id}
              points={`${callout.tip.x},${callout.tip.y} ${callout.elbow.x},${callout.elbow.y} ${callout.end.x},${callout.end.y}`}
              stroke={drawnById.get(callout.id)?.color ?? theme.colors.primary}
              strokeWidth={theme.borderWidth.thin}
              fill="none"
            />
          ))}
        </Svg>
      ) : null}

      {placed.map((callout) => {
        const slice = drawnById.get(callout.id);
        if (slice === undefined) return null;
        const right = callout.side === 'right';
        return (
          <View
            key={callout.id}
            pointerEvents="none"
            testID={`donut-callout-${callout.id}`}
            style={{
              position: 'absolute',
              top: callout.end.y - labelHeight / 2,
              width: labelWidth,
              height: labelHeight,
              justifyContent: 'center',
              ...(right ? { left: callout.end.x + labelGap } : { right: width - callout.end.x + labelGap }),
            }}
          >
            <Text variant="caption" numberOfLines={1} style={{ lineHeight: theme.lineHeight.sm, textAlign: right ? 'left' : 'right' }}>
              {slice.name}
            </Text>
            <Text variant="caption" weight="bold" style={{ lineHeight: theme.lineHeight.sm, textAlign: right ? 'left' : 'right' }}>
              {t('common.percent', { percent: slice.percentage.toFixed(0) })}
            </Text>
          </View>
        );
      })}

      {centerLabel !== undefined || centerSublabel !== undefined ? (
        <View className="absolute items-center" pointerEvents="none">
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
