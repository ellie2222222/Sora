import { Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { MonthSelector } from './MonthSelector.tsx';
import { Text } from './Text.tsx';
import { useTheme } from '@/app/providers';
import { DASHBOARD_PERIODS, formatPeriodLabel, isCurrentPeriod, type CalendarDay, type DashboardPeriod } from '@/utils';

export interface PeriodBarProps {
  period: DashboardPeriod;
  anchor: CalendarDay;
  onChangePeriod: (period: DashboardPeriod) => void;
  onShift: (delta: number) => void;
  /** Shows the stepper's calendar trigger; omitted, the label is not tappable. */
  onOpenPicker?: () => void;
  /** Distinguishes the pills' testIDs between the screens that mount this. */
  testIDPrefix?: string;
}

/**
 * The granularity pills plus the ← / → window stepper.
 *
 * Horizontally scrollable: five pills do not fit a narrow phone at a readable
 * font size, and shrinking them to fit makes the selected one hard to tell
 * apart.
 */
export function PeriodBar({
  period,
  anchor,
  onChangePeriod,
  onShift,
  onOpenPicker,
  testIDPrefix = 'dashboard',
}: PeriodBarProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: theme.spacing.xs }}
      >
        {DASHBOARD_PERIODS.map((candidate) => {
          const selected = candidate === period;
          return (
            <Pressable
              key={candidate}
              testID={`${testIDPrefix}-period-${candidate}`}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => onChangePeriod(candidate)}
              style={{
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.xs,
                borderRadius: theme.radius.pill,
                borderWidth: 1,
                borderColor: selected ? theme.colors.primary : theme.colors.border,
                backgroundColor: selected ? theme.colors.primary : 'transparent',
              }}
            >
              <Text
                variant="caption"
                weight={selected ? 'semibold' : 'medium'}
                style={selected ? { color: theme.colors.onPrimary } : undefined}
                tone={selected ? undefined : 'muted'}
              >
                {t(`common.periods.${candidate}`)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <MonthSelector
        testID={`${testIDPrefix}-period-selector`}
        label={formatPeriodLabel(period, anchor)}
        onPrev={() => onShift(-1)}
        onNext={() => onShift(1)}
        onOpenPicker={onOpenPicker}
        // The current window is the last one with any data in it; stepping past
        // it would only ever show an empty period.
        disableNext={isCurrentPeriod(period, anchor)}
      />
    </View>
  );
}
