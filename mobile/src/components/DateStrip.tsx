import { Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { useTheme } from '@/app/providers';
import { addDays, monthName, parseDay, today, type CalendarDay } from '@/utils';
import { Text } from './Text.tsx';

const CELL_LAYOUT = LinearTransition.springify().damping(26).stiffness(220);
const CELL_ENTERING = FadeIn.duration(200);
const CELL_EXITING = FadeOut.duration(150);

export interface DateStripProps {
  selectedDay: CalendarDay;
  onSelectDay: (day: CalendarDay) => void;
  testID?: string;
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
export function DateStrip({ selectedDay, onSelectDay, testID }: DateStripProps) {
  const theme = useTheme();
  const selectedMonth = parseDay(selectedDay).month;
  const days = Array.from({ length: RADIUS * 2 + 1 }, (_, i) => addDays(selectedDay, i - RADIUS));

  return (
    <View testID={testID} className="w-full flex-row justify-between">
      {days.map((day) => {
        const { date, month } = parseDay(day);
        const isSelected = day === selectedDay;
        const isToday = day === today();
        const inCurrentMonth = month === selectedMonth;
        const mutedColor = isSelected ? theme.colors.onPrimary : theme.colors.textFaint;

        return (
          <Animated.View key={day} layout={CELL_LAYOUT} entering={CELL_ENTERING} exiting={CELL_EXITING}>
            <Pressable
              testID={testID ? `${testID}-day-${day}` : undefined}
              onPress={() => onSelectDay(day)}
              accessibilityRole="button"
              accessibilityLabel={day}
              hitSlop={4}
              className="items-center w-[40px] py-xs"
              style={{
                borderRadius: theme.radius.md,
                backgroundColor: isSelected ? theme.colors.primary : 'transparent',
              }}
            >
              <Text variant="caption" weight="semibold" style={{ fontSize: 10, color: inCurrentMonth && !isSelected ? theme.colors.textMuted : mutedColor }}>
                {monthName(month)}
              </Text>
              <View
                className="w-[32px] h-[32px] items-center justify-center mt-xxs"
                style={{
                  borderRadius: theme.radius.pill,
                  borderWidth: isToday && !isSelected ? 1 : 0,
                  borderColor: theme.colors.primary,
                  backgroundColor: isToday && !isSelected ? theme.colors.primaryMuted : 'transparent',
                }}
              >
                <Text
                  weight={isSelected || isToday ? 'bold' : 'medium'}
                  style={{
                    fontSize: theme.fontSize.md,
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
