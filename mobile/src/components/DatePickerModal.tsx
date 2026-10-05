import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, X, Calendar as CalendarIcon } from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import i18next from 'i18next';

import { useTheme } from '@/app/providers';
import { BottomSheetModal } from './BottomSheetModal';
import { Button } from './Button';
import { Text } from './Text';
import { addMonths, monthGrid, monthName, parseDay, today, withYear } from '@/utils';

export interface DatePickerModalProps {
  visible: boolean;
  selectedDay: string; // YYYY-MM-DD
  onSelectDay: (day: string) => void;
  onClose: () => void;
}

export function DatePickerModal({ visible, selectedDay, onSelectDay, onClose }: DatePickerModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const initialDay = selectedDay && typeof selectedDay === 'string' && selectedDay.includes('-') ? selectedDay : today();
  const [viewDay, setViewDay] = useState(initialDay);
  const [viewMode, setViewMode] = useState<'days' | 'years'>('days');
  // `style` can never be a function here — see CLAUDE.md Part 7 rule 15.
  const [yearTogglePressed, setYearTogglePressed] = useState(false);
  const { year, month } = parseDay(viewDay || today());

  const grid = monthGrid(viewDay || today());
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
    const tDay = today();
    setViewDay(tDay);
    onSelectDay(tDay);
    onClose();
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 90 }, (_, i) => currentYear - 60 + i);

  return (
    <BottomSheetModal visible={visible} onClose={onClose}>
      <View testID="sheet-date-picker" style={{ gap: theme.spacing.md }}>
        <View className="flex-row justify-between items-center">
          <Text variant="title">{t('common.selectDate', { defaultValue: 'Select Date' })}</Text>
          <Pressable testID="btn-cancel-date-picker" onPress={onClose} hitSlop={theme.sizes.hitSlop.md} className="p-xs">
            <X size={theme.iconSize.xl} color={theme.colors.textMuted} />
          </Pressable>
        </View>

        <View
          className="flex-row justify-between items-center"
          style={{
            backgroundColor: theme.colors.surfaceMuted,
            borderRadius: theme.radius.md,
            padding: theme.spacing.xs,
          }}
        >
          {viewMode === 'days' ? (
            <>
              <Pressable testID="btn-previous-month" onPress={handlePrevMonth} hitSlop={theme.sizes.hitSlop.md} className="p-xs">
                <ChevronLeft size={theme.iconSize.xl} color={theme.colors.text} />
              </Pressable>
              <Pressable
                testID="btn-select-year"
                onPress={() => setViewMode('years')}
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
                <CalendarIcon size={theme.iconSize.sm} color={theme.colors.primary} />
                <Text weight="semibold" style={{ fontSize: theme.fontSize.md }}>
                  {monthName(month)} {year}
                </Text>
              </Pressable>
              <Pressable testID="btn-next-month" onPress={handleNextMonth} hitSlop={theme.sizes.hitSlop.md} className="p-xs">
                <ChevronRight size={theme.iconSize.xl} color={theme.colors.text} />
              </Pressable>
            </>
          ) : (
            <View className="flex-1 flex-row justify-between items-center px-sm">
              <Text weight="semibold" style={{ fontSize: theme.fontSize.md, paddingLeft: theme.spacing.sm }}>
                {t('common.selectYear', { defaultValue: 'Select Year' })}
              </Text>
              <Pressable
                testID="btn-select-days"
                onPress={() => setViewMode('days')}
                className="py-xs"
                style={{
                  paddingHorizontal: theme.spacing.sm,
                  borderRadius: theme.radius.sm,
                  backgroundColor: theme.colors.primary,
                }}
              >
                <Text style={{ color: theme.colors.onPrimary, fontSize: theme.fontSize.xs, fontWeight: 'bold' }}>
                  {t('common.back', { defaultValue: 'Back' })}
                </Text>
              </Pressable>
            </View>
          )}
        </View>

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
                    const isToday = cell.day === today();
                    const dayNum = parseDay(cell.day).date;

                    return (
                      <Pressable
                        key={cell.day}
                        testID={`option-day-${cell.day}`}
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
                                  : theme.colors.textFaint,
                          }}
                        >
                          {dayNum}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          </>
        ) : (
          <ScrollView style={{ maxHeight: theme.sizes.listMaxHeight.sm }} contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, justifyContent: 'center', paddingVertical: theme.spacing.sm }}>
            {years.map((y) => {
              const isSelectedYear = y === year;
              return (
                <Pressable
                  key={y}
                  testID={`option-year-${y}`}
                  onPress={() => handleSelectYear(y)}
                  className="items-center justify-center"
                  style={{
                    width: '22%',
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
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        <View
          className="flex-row justify-between items-center"
          style={{
            borderTopWidth: theme.borderWidth.thin,
            marginTop: theme.spacing.xs,
            paddingTop: theme.spacing.sm,
            borderTopColor: theme.colors.border,
          }}
        >
          <Button
            testID="btn-select-today"
            label={t('common.today', { defaultValue: 'Today' })}
            variant="secondary"
            size="sm"
            onPress={handleSelectToday}
          />
          <Button
            label={t('common.close', { defaultValue: 'Close' })}
            variant="ghost"
            size="sm"
            onPress={onClose}
          />
        </View>
      </View>
    </BottomSheetModal>
  );
}
