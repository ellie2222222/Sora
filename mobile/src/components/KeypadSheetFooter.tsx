import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useTheme } from '@/app/providers';
import { Text } from './Text.tsx';

export interface KeypadSheetFooterProps {
  /** Left of the amount: an `IconChip` or a compact picker. */
  leading: ReactNode;
  amount: string;
  amountTestID: string;
  /** Field errors shown under the amount row; undefined entries are skipped. */
  errors?: (string | undefined)[];
  /** Divider above the footer, when a picker area sits between it and the header. */
  divider?: boolean;
  /** The name/note input, submit error and `CalculatorKeypad`, in that order. */
  children: ReactNode;
}

/** The bottom block every keypad-driven create sheet shares: summary chip, amount, then the keypad. */
export function KeypadSheetFooter({ leading, amount, amountTestID, errors = [], divider = true, children }: KeypadSheetFooterProps) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexShrink: 0,
        gap: theme.spacing.sm,
        marginTop: theme.spacing.sm,
        ...(divider ? { paddingTop: theme.spacing.md, borderTopWidth: 1, borderTopColor: theme.colors.border } : {}),
      }}
    >
      <View className="flex-row items-end justify-between" style={{ gap: theme.spacing.sm }}>
        {leading}
        <Text variant="heading" numeric weight="bold" testID={amountTestID}>
          {amount}
        </Text>
      </View>
      {errors.map((message, index) =>
        message !== undefined ? (
          <Text key={index} variant="caption" tone="danger">
            {message}
          </Text>
        ) : null,
      )}
      {children}
    </View>
  );
}
