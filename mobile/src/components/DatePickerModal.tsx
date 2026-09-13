import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, X, Calendar as CalendarIcon } from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import i18next from 'i18next';

import { useTheme } from '../app/providers/ThemeProvider';
import { BottomSheetModal } from './BottomSheetModal';
import { Button } from './Button';
import { Text } from './Text';
import {
  addMonths,
  monthGrid,
  monthName,
  parseDay,
  today,
} from '../utils/date';

export interface DatePickerModalProps {
  visible: boolean;
  selectedDay: string; // YYYY-MM-DD
  onSelectDay: (day: string) => void;
  onClose: () => void;
}

/**
 * Shared interactive date/year picker modal component.
 * Uses the primary `BottomSheetModal` component as its foundation.
 */
export function DatePickerModal({ visible, selectedDay, onSelectDay, onClose }: DatePickerModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const initialDay = selectedDay && typeof selectedDay === 'string' && selectedDay.includes('-') ? selectedDay : today();
  const [viewDay, setViewDay] = useState(initialDay);
  const [viewMode, setViewMode] = useState<'days' | 'years'>('days');
  const { year, month, date } = parseDay(viewDay || today());

  const grid = monthGrid(viewDay || today());
  const weekdayInitials = useMemo(() => {
    const locale = i18next.language || 'en';
    return Array.from({ length: 7 }, (_, i) => {
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
    const formattedMonth = String(month).padStart(2, '0');
    const formattedDate = String(date).padStart(2, '0');
    setViewDay(`${targetYear}-${formattedMonth}-${formattedDate}`);
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
      <View style={{ gap: theme.spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="title">{t('common.selectDate', { defaultValue: 'Select Date' })}</Text>
          <Pressable onPress={onClose} hitSlop={8} style={{ padding: 4 }}>
            <X size={20} color={theme.colors.textMuted} />
          </Pressable>
        </View>

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: theme.colors.surfaceMuted,
            borderRadius: theme.radius.md,
            padding: theme.spacing.xs,
          }}
        >
          {viewMode === 'days' ? (
            <>
              <Pressable onPress={handlePrevMonth} hitSlop={8} style={{ padding: 4 }}>
                <ChevronLeft size={20} color={theme.colors.text} />
              </Pressable>
              <Pressable
                onPress={() => setViewMode('years')}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: theme.radius.sm,
                  backgroundColor: pressed ? theme.colors.border : 'transparent',
                })}
              >
                <Text weight="semibold" style={{ fontSize: theme.fontSize.md }}>
                  {monthName(month)} {year}
                </Text>
                <CalendarIcon size={14} color={theme.colors.primary} />
              </Pressable>
              <Pressable onPress={handleNextMonth} hitSlop={8} style={{ padding: 4 }}>
                <ChevronRight size={20} color={theme.colors.text} />
              </Pressable>
            </>
          ) : (
            <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 8 }}>
              <Text weight="semibold" style={{ fontSize: theme.fontSize.md, paddingLeft: 8 }}>
                {t('common.selectYear', { defaultValue: 'Select Year' })}
              </Text>
              <Pressable
                onPress={() => setViewMode('days')}
                style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.sm, backgroundColor: theme.colors.primary }}
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
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              {weekdayInitials.map((initial, i) => (
                <Text key={i} variant="caption" tone="muted" weight="semibold" style={{ width: 36, textAlign: 'center' }}>
                  {initial}
                </Text>
              ))}
            </View>

            <View style={{ gap: 4 }}>
              {grid.map((row, rowIndex) => (
                <View key={rowIndex} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  {row.map((cellDay, colIndex) => {
                    if (cellDay === null) {
                      return <View key={colIndex} style={{ width: 36, height: 36 }} />;
                    }
                    const isSelected = cellDay === selectedDay;
                    const isToday = cellDay === today();
                    const dayNum = parseDay(cellDay).date;

                    return (
                      <Pressable
                        key={cellDay}
                        onPress={() => handleSelectDayInternal(cellDay)}
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: theme.radius.pill,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: isSelected
                            ? theme.colors.primary
                            : isToday
                              ? theme.colors.primaryMuted
                              : 'transparent',
                          borderWidth: isToday && !isSelected ? 1 : 0,
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
                                : theme.colors.text,
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
          <ScrollView style={{ maxHeight: 220 }} contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', paddingVertical: 8 }}>
            {years.map((y) => {
              const isSelectedYear = y === year;
              return (
                <Pressable
                  key={y}
                  onPress={() => handleSelectYear(y)}
                  style={{
                    width: '22%',
                    paddingVertical: 10,
                    borderRadius: theme.radius.md,
                    alignItems: 'center',
                    justifyContent: 'center',
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
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: theme.spacing.xs,
            paddingTop: theme.spacing.sm,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
          }}
        >
          <Button
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
