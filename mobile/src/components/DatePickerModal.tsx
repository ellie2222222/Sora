import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react-native';
import { FlatList, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import i18next from 'i18next';

import { useTheme } from '@/app/providers';
import { BottomSheetModal } from './BottomSheetModal';
import { Button } from './Button';
import { Text } from './Text';
import { addMonths, formatDay, monthGrid, monthName, parseDay, withYear, type CalendarDay } from '@/utils';
import { ThemedIcon, ThemedPressable, ThemedView } from './Themed.tsx';

export interface DatePickerModalProps {
  visible: boolean;
  selectedDay: string; // YYYY-MM-DD
  onSelectDay: (day: string) => void;
  onClose: () => void;
  /** Today in the wallet's zone, which the Today button picks and the grid marks. */
  today: CalendarDay;
}

const YEAR_COLUMNS = 4;

export function DatePickerModal({ visible, selectedDay, onSelectDay, onClose, today }: DatePickerModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const initialDay = selectedDay && typeof selectedDay === 'string' && selectedDay.includes('-') ? selectedDay : today;
  const [viewDay, setViewDay] = useState(initialDay);
  const [viewMode, setViewMode] = useState<'days' | 'years'>('days');
  // `style` can never be a function here — see CLAUDE.md Part 7 rule 15.
  const [yearTogglePressed, setYearTogglePressed] = useState(false);
  const { year, month } = parseDay(viewDay || today);

  const grid = monthGrid(viewDay || today);
  const weekdayInitials = useMemo(() => {
    const locale = i18next.language || 'en';
    return Array.from({ length: 7 }, (_, i) => {
      // 2026-05-10 is an arbitrary known Sunday, used only as a Sun-Sat anchor
      // to read each weekday's locale-correct narrow initial.
      const dateObj = new Date(Date.UTC(2026, 4, 10 + i));
      return dateObj.toLocaleDateString(locale, { weekday: 'narrow', timeZone: 'UTC' });
    });
  }, [i18next.language]);

  useEffect(() => {
    if (visible) {
      setViewDay(initialDay);
      setViewMode('days');
    }
  }, [visible, initialDay]);

  const handlePrevMonth = () => setViewDay(addMonths(viewDay, -1));
  const handleNextMonth = () => setViewDay(addMonths(viewDay, 1));

  const handleSelectYear = (targetYear: number) => {
    setViewDay(withYear(viewDay, targetYear));
    setViewMode('days');
  };

  const handleSelectDayInternal = (day: string) => {
    onSelectDay(day);
    onClose();
  };

  const handleSelectToday = () => {
    const tDay = today;
    setViewDay(tDay);
    onSelectDay(tDay);
    onClose();
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 90 }, (_, i) => currentYear - 60 + i);

  return (
    <BottomSheetModal visible={visible} onClose={onClose} title={t('common.selectDate')} entity="date-picker">
      <View style={{ gap: theme.spacing.md }}>

        <ThemedView
          className="flex-row justify-between items-center"
          style={{
            backgroundColor: theme.colors.surfaceMuted,
            borderRadius: theme.radius.md,
            padding: theme.spacing.xs,
          }}
        >
          {viewMode === 'days' ? (
            <>
              <Pressable
                testID="btn-previous-month"
                accessibilityRole="button"
                accessibilityLabel={t('common.previousPeriod')}
                onPress={handlePrevMonth}
                hitSlop={theme.sizes.hitSlop.md}
                className="p-xs"
              >
                <ThemedIcon icon={ChevronLeft} size={theme.iconSize.xl} color={theme.colors.text} />
              </Pressable>
              <ThemedPressable
                testID="btn-select-year"
                accessibilityRole="button"
                onPress={() => setViewMode('years')}
                hitSlop={{ top: theme.sizes.hitSlop.lg, bottom: theme.sizes.hitSlop.lg }}
                onPressIn={() => setYearTogglePressed(true)}
                onPressOut={() => setYearTogglePressed(false)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.spacing.xs,
                  paddingHorizontal: theme.spacing.sm,
                  paddingVertical: theme.spacing.xs,
                  borderRadius: theme.radius.sm,
                  backgroundColor: yearTogglePressed ? theme.colors.border : 'transparent',
                }}
              >
                <ThemedIcon icon={CalendarIcon} size={theme.iconSize.sm} color={theme.colors.primary} />
                <Text weight="semibold" style={{ fontSize: theme.fontSize.md }}>
                  {monthName(month)} {year}
                </Text>
              </ThemedPressable>
              <Pressable
                testID="btn-next-month"
                accessibilityRole="button"
                accessibilityLabel={t('common.nextPeriod')}
                onPress={handleNextMonth}
                hitSlop={theme.sizes.hitSlop.md}
                className="p-xs"
              >
                <ThemedIcon icon={ChevronRight} size={theme.iconSize.xl} color={theme.colors.text} />
              </Pressable>
            </>
          ) : (
            <View className="flex-1 flex-row justify-between items-center px-sm">
              <Text weight="semibold" style={{ fontSize: theme.fontSize.md, paddingLeft: theme.spacing.sm }}>
                {t('common.selectYear')}
              </Text>
              <ThemedPressable
                testID="btn-select-days"
                onPress={() => setViewMode('days')}
                className="py-xs"
                style={{
                  paddingHorizontal: theme.spacing.sm,
                  borderRadius: theme.radius.sm,
                  backgroundColor: theme.colors.primary,
                }}
              >
                <Text variant="label" weight="bold" style={{ color: theme.colors.onPrimary }}>
                  {t('common.back')}
                </Text>
              </ThemedPressable>
            </View>
          )}
        </ThemedView>

        {viewMode === 'days' ? (
          <>
            <View className="flex-row justify-between">
              {weekdayInitials.map((initial, i) => (
                <Text key={i} variant="caption" tone="muted" weight="semibold" style={{ width: theme.sizes.badge.md, textAlign: 'center' }}>
                  {initial}
                </Text>
              ))}
            </View>

            <View className="gap-xs">
              {grid.map((row, rowIndex) => (
                <View key={rowIndex} className="flex-row justify-between">
                  {row.map((cell) => {
                    const isSelected = cell.day === selectedDay;
                    const isToday = cell.day === today;
                    const dayNum = parseDay(cell.day).date;

                    return (
                      <ThemedPressable
                        key={cell.day}
                        testID={`option-day-${cell.day}`}
                        accessibilityRole="button"
                        accessibilityLabel={formatDay(cell.day)}
                        accessibilityState={{ selected: isSelected }}
                        hitSlop={(theme.sizes.touchTarget - theme.sizes.badge.md) / 2}
                        onPress={() => handleSelectDayInternal(cell.day)}
                        className="items-center justify-center"
                        style={{
                          width: theme.sizes.badge.md,
                          height: theme.sizes.badge.md,
                          borderRadius: theme.radius.pill,
                          backgroundColor: isSelected
                            ? theme.colors.primary
                            : isToday
                              ? theme.colors.primaryMuted
                              : 'transparent',
                          borderWidth: isToday && !isSelected ? theme.borderWidth.thin : 0,
                          borderColor: theme.colors.primary,
                        }}
                      >
                        <Text
                          weight={isSelected || isToday ? 'bold' : 'regular'}
                          style={{
                            fontSize: theme.fontSize.sm,
                            color: isSelected
                              ? theme.colors.onPrimary
                              : isToday
                                ? theme.colors.primary
                                : cell.inCurrentMonth
                                  ? theme.colors.text
                                  : theme.colors.textMuted,
                          }}
                        >
                          {dayNum}
                        </Text>
                      </ThemedPressable>
                    );
                  })}
                </View>
              ))}
            </View>
          </>
        ) : (
          <FlatList
            data={years}
            keyExtractor={(y) => String(y)}
            numColumns={YEAR_COLUMNS}
            style={{ maxHeight: theme.sizes.listMaxHeight.sm }}
            contentContainerStyle={{ gap: theme.spacing.sm, paddingVertical: theme.spacing.sm }}
            columnWrapperStyle={{ gap: theme.spacing.sm }}
            renderItem={({ item: y }) => {
              const isSelectedYear = y === year;
              return (
                <ThemedPressable
                  testID={`option-year-${y}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelectedYear }}
                  onPress={() => handleSelectYear(y)}
                  className="items-center justify-center"
                  style={{
                    flex: 1,
                    minHeight: theme.sizes.touchTarget,
                    paddingVertical: theme.spacing.sm,
                    borderRadius: theme.radius.md,
                    backgroundColor: isSelectedYear ? theme.colors.primary : theme.colors.surfaceMuted,
                  }}
                >
                  <Text
                    weight={isSelectedYear ? 'bold' : 'regular'}
                    style={{
                      fontSize: theme.fontSize.sm,
                      color: isSelectedYear ? theme.colors.onPrimary : theme.colors.text,
                    }}
                  >
                    {y}
                  </Text>
                </ThemedPressable>
              );
            }}
          />
        )}

        <ThemedView
          className="flex-row items-center"
          style={{
            borderTopWidth: theme.borderWidth.thin,
            marginTop: theme.spacing.xs,
            paddingTop: theme.spacing.sm,
            borderTopColor: theme.colors.border,
          }}
        >
          <Button
            testID="btn-select-today"
            label={t('common.today')}
            variant="secondary"
            size="sm"
            onPress={handleSelectToday}
          />
        </ThemedView>
      </View>
    </BottomSheetModal>
  );
}
