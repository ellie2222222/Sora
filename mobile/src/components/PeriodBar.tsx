import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react-native';

import { ActionSheet } from './ActionSheet.tsx';
import { Text } from './Text.tsx';
import { useTheme } from '@/app/providers';
import { DASHBOARD_PERIODS, formatPeriodLabel, isCurrentPeriod, type CalendarDay, type DashboardPeriod } from '@/utils';

export interface PeriodBarProps {
  period: DashboardPeriod;
  anchor: CalendarDay;
  onChangePeriod: (period: DashboardPeriod) => void;
  onShift: (delta: number) => void;
  /** Makes the window's label open a date picker; omitted, the label is not tappable. */
  onOpenPicker?: () => void;
  /** Distinguishes the controls' testIDs between the screens that mount this. */
  testIDPrefix?: string;
  /** Today in the wallet's zone. */
  today: CalendarDay;
}

type PressedPart = 'prev' | 'label' | 'granularity' | 'next';

/**
 * One row: ‹ the window › with its granularity beside the label. The granularity changes rarely, so
 * it opens a sheet rather than holding a row of its own; the window, which changes often, stays one tap away.
 */
export function PeriodBar({ period, anchor, onChangePeriod, onShift, onOpenPicker, testIDPrefix = 'dashboard', today }: PeriodBarProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  // `style` can never be a function here — see CLAUDE.md Part 7 rule 15.
  const [pressed, setPressed] = useState<PressedPart | null>(null);
  const [choosing, setChoosing] = useState(false);
  // The current window is the last one with any data in it; stepping past it would only show an empty period.
  const disableNext = isCurrentPeriod(period, anchor, today);

  const pressHandlers = (part: PressedPart) => ({
    onPressIn: () => setPressed(part),
    onPressOut: () => setPressed(null),
  });
  const stepStyle = (part: PressedPart) => ({
    padding: theme.spacing.sm,
    borderRadius: theme.radius.pill,
    backgroundColor: pressed === part ? theme.colors.surfacePressed : 'transparent',
  });

  return (
    <View testID={`${testIDPrefix}-period-selector`} className="flex-row items-center justify-between">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.previousPeriod')}
        onPress={() => onShift(-1)}
        {...pressHandlers('prev')}
        hitSlop={theme.sizes.hitSlop.sm}
        style={stepStyle('prev')}
      >
        <ChevronLeft size={theme.iconSize.xl} color={theme.colors.textMuted} />
      </Pressable>

      <View className="flex-row items-center" style={{ flexShrink: 1, gap: theme.spacing.xs }}>
        <Pressable
          testID={`${testIDPrefix}-period-selector-picker-trigger`}
          accessibilityRole="button"
          accessibilityLabel={t('common.selectDate')}
          onPress={onOpenPicker}
          disabled={onOpenPicker === undefined}
          {...pressHandlers('label')}
          hitSlop={{ top: theme.sizes.hitSlop.md, bottom: theme.sizes.hitSlop.md }}
          className="flex-row items-center"
          style={{
            flexShrink: 1,
            gap: theme.spacing.xs,
            paddingVertical: theme.spacing.xs,
            paddingHorizontal: theme.spacing.sm,
            borderRadius: theme.radius.md,
            backgroundColor: pressed === 'label' ? theme.colors.surfacePressed : 'transparent',
          }}
        >
          {onOpenPicker !== undefined ? <Calendar size={theme.iconSize.md} color={theme.colors.textMuted} /> : null}
          <Text weight="bold" numberOfLines={1} style={{ flexShrink: 1, fontSize: theme.fontSize.lg }}>
            {formatPeriodLabel(period, anchor)}
          </Text>
        </Pressable>

        <Pressable
          testID={`${testIDPrefix}-period-granularity`}
          accessibilityRole="button"
          accessibilityLabel={t('common.viewBy')}
          accessibilityValue={{ text: t(`common.periods.${period}`) }}
          onPress={() => setChoosing(true)}
          {...pressHandlers('granularity')}
          hitSlop={{ top: theme.sizes.hitSlop.lg, bottom: theme.sizes.hitSlop.lg }}
          className="flex-row items-center"
          style={{
            gap: theme.spacing.xxs,
            paddingVertical: theme.spacing.xs,
            paddingLeft: theme.spacing.sm,
            paddingRight: theme.spacing.xs,
            borderRadius: theme.radius.pill,
            backgroundColor: pressed === 'granularity' ? theme.colors.surfacePressed : theme.colors.surfaceMuted,
          }}
        >
          <Text variant="caption" weight="semibold" tone="muted">
            {t(`common.periods.${period}`)}
          </Text>
          <ChevronDown size={theme.iconSize.sm} color={theme.colors.textMuted} />
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.nextPeriod')}
        onPress={() => onShift(1)}
        disabled={disableNext}
        {...pressHandlers('next')}
        hitSlop={theme.sizes.hitSlop.sm}
        style={[stepStyle('next'), { opacity: disableNext ? theme.opacity.disabled : 1 }]}
      >
        <ChevronRight size={theme.iconSize.xl} color={theme.colors.textMuted} />
      </Pressable>

      <ActionSheet
        visible={choosing}
        title={t('common.viewBy')}
        onCancel={() => setChoosing(false)}
        actions={DASHBOARD_PERIODS.map((candidate) => ({
          label: t(`common.periods.${candidate}`),
          selected: candidate === period,
          testID: `${testIDPrefix}-period-${candidate}`,
          onPress: () => {
            setChoosing(false);
            onChangePeriod(candidate);
          },
        }))}
      />
    </View>
  );
}
