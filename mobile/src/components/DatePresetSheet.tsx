import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Calendar, Check, ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/app/providers';
import { formatDay, type CalendarDay } from '@/utils';
import { BottomSheetModal } from './BottomSheetModal';
import { DatePickerModal } from './DatePickerModal';
import { Text } from './Text';

export interface DatePreset {
  key: string;
  label: string;
  day: CalendarDay;
}

export interface DatePresetSheetProps {
  visible: boolean;
  title: string;
  /** The question the choice answers, shown above the options. */
  prompt?: string;
  presets: DatePreset[];
  value: CalendarDay | null;
  onSelect: (day: CalendarDay) => void;
  onClose: () => void;
  entity: string;
  /** Today in the wallet's zone. */
  today: CalendarDay;
}

/** Quick, computed dates first, with the calendar one row away for an exact day. */
export function DatePresetSheet({ visible, title, prompt, presets, value, onSelect, onClose, entity, today }: DatePresetSheetProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [calendarOpen, setCalendarOpen] = useState(false);
  // `style` can never be a function here — see CLAUDE.md Part 7 rule 15.
  const [pressedKey, setPressedKey] = useState<string | null>(null);

  useEffect(() => {
    if (visible) setCalendarOpen(false);
  }, [visible]);

  const customDay = value !== null && !presets.some((preset) => preset.day === value) ? formatDay(value) : null;
  const isCustom = customDay !== null;

  function choose(day: CalendarDay) {
    onSelect(day);
    onClose();
  }

  function rowStyle(key: string, selected: boolean) {
    return {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      gap: theme.spacing.sm,
      minHeight: theme.sizes.controlHeight,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.radius.md,
      backgroundColor: selected ? theme.colors.primaryMuted : pressedKey === key ? theme.colors.surfaceMuted : 'transparent',
    };
  }

  function pressHandlers(key: string) {
    return { onPressIn: () => setPressedKey(key), onPressOut: () => setPressedKey(null) };
  }

  return (
    <BottomSheetModal visible={visible} onClose={onClose} title={title} entity={entity}>
      <View style={{ gap: theme.spacing.md }}>
        {prompt !== undefined ? <Text weight="semibold">{prompt}</Text> : null}

        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="label" tone="muted">
            {t('common.quickOptions')}
          </Text>
          {presets.map((preset) => {
            const selected = preset.day === value;
            return (
              <Pressable
                key={preset.key}
                testID={`option-${entity}-${preset.key}`}
                onPress={() => choose(preset.day)}
                {...pressHandlers(preset.key)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${preset.label}, ${formatDay(preset.day)}`}
                style={rowStyle(preset.key, selected)}
              >
                <Text weight={selected ? 'semibold' : 'regular'}>{preset.label}</Text>
                <View className="flex-row items-center" style={{ gap: theme.spacing.xs }}>
                  <Text tone="muted">{formatDay(preset.day)}</Text>
                  {selected ? <Check size={theme.iconSize.md} color={theme.colors.primary} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={{ borderTopWidth: theme.borderWidth.thin, borderTopColor: theme.colors.border, paddingTop: theme.spacing.sm }}>
          <Pressable
            testID={`option-${entity}-custom`}
            onPress={() => setCalendarOpen(true)}
            {...pressHandlers('custom')}
            accessibilityRole="button"
            accessibilityState={{ selected: isCustom }}
            accessibilityLabel={isCustom ? `${t('common.customDate')}, ${customDay}` : t('common.customDate')}
            style={rowStyle('custom', isCustom)}
          >
            <View className="flex-row items-center" style={{ gap: theme.spacing.sm }}>
              <Calendar size={theme.iconSize.lg} color={theme.colors.textMuted} />
              <View>
                <Text weight={isCustom ? 'semibold' : 'regular'}>{t('common.customDate')}</Text>
                <Text variant="caption" tone="muted">
                  {customDay ?? t('common.pickDate')}
                </Text>
              </View>
            </View>
            <ChevronRight size={theme.iconSize.md} color={theme.colors.textMuted} />
          </Pressable>
        </View>
      </View>

      <DatePickerModal
        visible={calendarOpen}
        today={today}
        selectedDay={value ?? today}
        onSelectDay={choose}
        onClose={() => setCalendarOpen(false)}
      />
    </BottomSheetModal>
  );
}
