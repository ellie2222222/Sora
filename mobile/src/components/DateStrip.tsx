import { Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { useTheme } from '@/app/providers';
import { addDays, monthName, parseDay, type CalendarDay } from '@/utils';
import { Text } from './Text.tsx';

const CELL_LAYOUT = LinearTransition.springify().damping(26).stiffness(220);
const CELL_ENTERING = FadeIn.duration(200);
const CELL_EXITING = FadeOut.duration(150);

export interface DateStripProps {
  selectedDay: CalendarDay;
  onSelectDay: (day: CalendarDay) => void;
  testID?: string;
  /** Today in the wallet's zone. */
  today: CalendarDay;
}

/** Days shown either side of the selected one — 7 cells total. */
const RADIUS = 3;

/**
 * Always-visible calendar window: the selected day centred among 3 days on
 * each side. Days from the previous/next month are real, tappable cells
 * (muted, month-labelled) rather than hidden behind the picker — tapping one
 * re-centres the strip on it, which (via `selectedDay` driving the month
 * bounds upstream) is what actually jumps the screen to that month.
 */
export function DateStrip({ selectedDay, onSelectDay, testID, today }: DateStripProps) {
  const theme = useTheme();
  const selectedMonth = parseDay(selectedDay).month;
  const days = Array.from({ length: RADIUS * 2 + 1 }, (_, i) => addDays(selectedDay, i - RADIUS));

  return (
    <View testID={testID} className="w-full flex-row justify-between">
      {days.map((day) => {
        const { date, month } = parseDay(day);
        const isSelected = day === selectedDay;
        const isToday = day === today;
        const inCurrentMonth = month === selectedMonth;
        const mutedColor = isSelected ? theme.colors.onPrimary : theme.colors.textFaint;

        return (
          <Animated.View key={day} layout={CELL_LAYOUT} entering={CELL_ENTERING} exiting={CELL_EXITING}>
            <Pressable
              testID={testID ? `${testID}-day-${day}` : undefined}
              onPress={() => onSelectDay(day)}
              accessibilityRole="button"
              accessibilityLabel={day}
              hitSlop={theme.sizes.hitSlop.sm}
              className="items-center py-xs"
              style={{
                width: theme.sizes.badge.lg,
                borderRadius: theme.radius.md,
                backgroundColor: isSelected ? theme.colors.primary : 'transparent',
              }}
            >
              <Text variant="caption" weight="semibold" style={{ color: inCurrentMonth && !isSelected ? theme.colors.textMuted : mutedColor }}>
                {monthName(month)}
              </Text>
              <View
                className="items-center justify-center mt-xxs"
                style={{
                  width: theme.sizes.badge.sm,
                  height: theme.sizes.badge.sm,
                  borderRadius: theme.radius.pill,
                  borderWidth: isToday && !isSelected ? theme.borderWidth.thin : 0,
                  borderColor: theme.colors.primary,
                  backgroundColor: isToday && !isSelected ? theme.colors.primaryMuted : 'transparent',
                }}
              >
                <Text
                  weight={isSelected || isToday ? 'bold' : 'medium'}
                  style={{
                    color: isSelected
                      ? theme.colors.onPrimary
                      : isToday
                        ? theme.colors.primary
                        : inCurrentMonth
                          ? theme.colors.text
                          : theme.colors.textFaint,
                  }}
                >
                  {date}
                </Text>
              </View>
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}
