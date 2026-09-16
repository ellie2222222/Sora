import { Calendar } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { useTheme } from '@/app/providers';
import { formatDay } from '../utils/date';
import { DatePickerModal } from './DatePickerModal';
import { Text } from './Text';

export interface DateFieldProps {
  label: string;
  value: string; // YYYY-MM-DD
  onChange: (day: string) => void;
  error?: string;
  testID?: string;
}

/**
 * A tap-to-open calendar field, styled like the other pickers (`AccountPicker`,
 * `CategoryPicker`) rather than a free-text `Input` — the value can only ever
 * be a real calendar day, so there's nothing left to validate.
 */
export function DateField({ label, value, onChange, error, testID }: DateFieldProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <Text variant="label" tone="muted">
        {label}
      </Text>
      <Pressable
        testID={testID}
        onPress={() => setOpen(true)}
        className="h-[48px] flex-row items-center justify-between border"
        style={{
          borderRadius: theme.radius.md,
          borderColor: error !== undefined ? theme.colors.danger : theme.colors.border,
          backgroundColor: theme.colors.surface,
          paddingHorizontal: theme.spacing.md,
        }}
      >
        <Text>{formatDay(value)}</Text>
        <Calendar size={18} color={theme.colors.textMuted} />
      </Pressable>
      {error !== undefined ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : null}

      <DatePickerModal visible={open} selectedDay={value} onSelectDay={onChange} onClose={() => setOpen(false)} />
    </View>
  );
}
