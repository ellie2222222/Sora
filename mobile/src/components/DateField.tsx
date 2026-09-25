import { Calendar, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/app/providers';
import { formatDay, today } from '@/utils';
import { DatePickerModal } from './DatePickerModal';
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
}

/**
 * A tap-to-open calendar field, styled like the other pickers (`AccountPicker`,
 * `CategoryPicker`) rather than a free-text `Input` — the value can only ever
 * be a real calendar day, so there's nothing left to validate.
 */
export function DateField({ label, value, onChange, onClear, placeholder, error, testID }: DateFieldProps) {
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
        className="h-[48px] flex-row items-center justify-between border"
        style={{
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
              style={{ width: 44, height: 44, marginRight: -theme.spacing.sm, alignItems: 'center', justifyContent: 'center' }}
              accessibilityRole="button"
              accessibilityLabel={t('common.clearDate', 'Clear date')}
            >
              <X size={16} color={theme.colors.textMuted} />
            </Pressable>
          ) : null}
          <Calendar size={18} color={theme.colors.textMuted} />
        </View>
      </Pressable>
      {error !== undefined ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : null}

      <DatePickerModal
        visible={open}
        selectedDay={value ?? today()}
        onSelectDay={onChange}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}
