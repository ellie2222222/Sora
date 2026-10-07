import { Calendar, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/app/providers';
import { formatDay, type CalendarDay } from '@/utils';
import { DatePickerModal } from './DatePickerModal';
import { DatePresetSheet, type DatePresetSheetProps } from './DatePresetSheet';
import { Text } from './Text';

export interface DateFieldProps {
  label: string;
  /** YYYY-MM-DD, or `null` for an optional date left unset — only meaningful together with `onClear`. */
  value: string | null;
  onChange: (day: string) => void;
  /** Present only on optional date fields — renders a clear affordance once a date is set. */
  onClear?: () => void;
  /** Shown in place of a formatted date while `value` is `null`. */
  placeholder?: string;
  error?: string;
  testID?: string;
  /** Opens quick options with the calendar one row away, in place of the bare calendar. */
  presetSheet?: Omit<DatePresetSheetProps, 'visible' | 'value' | 'onSelect' | 'onClose' | 'today'>;
  /** Today in the wallet's zone. */
  today: CalendarDay;
}

/**
 * A tap-to-open calendar field, styled like the other pickers (`AccountPicker`,
 * `CategoryPicker`) rather than a free-text `Input` — the value can only ever
 * be a real calendar day, so there's nothing left to validate.
 */
export function DateField({ label, value, onChange, onClear, placeholder, error, testID, presetSheet, today }: DateFieldProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <Text variant="label" tone="muted">
        {label}
      </Text>
      <Pressable
        testID={testID}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={value !== null ? `${label}, ${formatDay(value)}` : label}
        className="flex-row items-center justify-between"
        style={{
          borderWidth: theme.borderWidth.thin,
          height: theme.sizes.controlHeight,
          borderRadius: theme.radius.md,
          borderColor: error !== undefined ? theme.colors.danger : theme.colors.borderControl,
          backgroundColor: theme.colors.surface,
          paddingHorizontal: theme.spacing.md,
        }}
      >
        <View className="flex-1 flex-row items-center">
          {value !== null ? <Text>{formatDay(value)}</Text> : <Text tone="muted">{placeholder ?? ''}</Text>}
        </View>
        <View className="flex-row items-center" style={{ gap: theme.spacing.sm }}>
          {onClear !== undefined && value !== null ? (
            <Pressable
              testID={testID !== undefined ? `${testID}-clear` : undefined}
              onPress={onClear}
              style={{ width: theme.sizes.touchTarget, height: theme.sizes.touchTarget, marginRight: -theme.spacing.sm, alignItems: 'center', justifyContent: 'center' }}
              accessibilityRole="button"
              accessibilityLabel={t('common.clearDate', 'Clear date')}
            >
              <X size={theme.iconSize.md} color={theme.colors.textMuted} />
            </Pressable>
          ) : null}
          <Calendar size={theme.iconSize.lg} color={theme.colors.textMuted} />
        </View>
      </Pressable>
      {error !== undefined ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : null}

      {presetSheet !== undefined ? (
        <DatePresetSheet {...presetSheet} today={today} visible={open} value={value} onSelect={onChange} onClose={() => setOpen(false)} />
      ) : (
        <DatePickerModal visible={open} today={today} selectedDay={value ?? today} onSelectDay={onChange} onClose={() => setOpen(false)} />
      )}
    </View>
  );
}
