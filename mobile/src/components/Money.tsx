import type { MoneyString, TransactionType } from '@finance/contracts';

import { useTheme } from '../app/providers/ThemeProvider.tsx';
import { directionOf, formatMoneyString, type MoneyFormatOptions } from '../utils/money.ts';
import { Text, type TextComponentProps } from './Text.tsx';

export interface MoneyProps extends Omit<TextComponentProps, 'tone' | 'numeric'> {
  amount: MoneyString;
  currency: string;
  /** Colours the figure income-green / expense-red / neutral. Omit to inherit `tone`. */
  type?: TransactionType;
  formatOptions?: MoneyFormatOptions;
}

export function Money({ amount, currency, type, formatOptions, style, ...props }: MoneyProps) {
  const theme = useTheme();
  const text = formatMoneyString(amount, currency, formatOptions);

  const color =
    type === undefined
      ? undefined
      : { in: theme.colors.income, out: theme.colors.expense, neutral: theme.colors.text }[
          directionOf(type)
        ];

  return (
    <Text {...props} numeric style={[color !== undefined ? { color } : null, style]}>
      {text}
    </Text>
  );
}
