import { Calendar, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { useTheme } from '@/app/providers';
import { formatDay, today } from '../utils/date';
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
  const [open, setOpen] = useState(false);

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <Text variant="label" tone="muted">
        {label}
      </Text>
      <View
        className="h-[48px] flex-row items-center justify-between border"
        style={{
          borderRadius: theme.radius.md,
          borderColor: error !== undefined ? theme.colors.danger : theme.colors.border,
          backgroundColor: theme.colors.surface,
          paddingHorizontal: theme.spacing.md,
        }}
      >
        <Pressable testID={testID} onPress={() => setOpen(true)} className="flex-1 flex-row items-center">
          {value !== null ? <Text>{formatDay(value)}</Text> : <Text tone="muted">{placeholder ?? ''}</Text>}
        </Pressable>
        <View className="flex-row items-center" style={{ gap: theme.spacing.sm }}>
          {onClear !== undefined && value !== null ? (
            <Pressable
              testID={testID !== undefined ? `${testID}-clear` : undefined}
              onPress={onClear}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Clear date"
            >
              <X size={16} color={theme.colors.textMuted} />
            </Pressable>
          ) : null}
          <Calendar size={18} color={theme.colors.textMuted} />
        </View>
      </View>
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
