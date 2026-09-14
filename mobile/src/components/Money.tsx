import type { MoneyString, TransactionType } from '@sora/contracts';
import { TransactionType as TxType } from '@sora/contracts';
import { Minus, Plus } from 'lucide-react-native';
import { View } from 'react-native';

import { useTheme } from '../app/providers/ThemeProvider.tsx';
import { directionOf, formatMoneyString, type MoneyFormatOptions } from '../utils/money.ts';
import { Text, type TextComponentProps } from './Text.tsx';

export interface MoneyProps extends Omit<TextComponentProps, 'tone' | 'numeric'> {
  amount: MoneyString;
  currency: string;
  /** Colours the figure income-green / expense-red / neutral. Omit to inherit `tone`. */
  type?: TransactionType;
  /** Controls whether plus/minus icon is shown. Defaults to true when `type` is INCOME or EXPENSE. */
  showIcon?: boolean;
  formatOptions?: MoneyFormatOptions;
}

export function Money({ amount, currency, type, showIcon = true, formatOptions, style, ...props }: MoneyProps) {
  const theme = useTheme();

  const direction = type !== undefined ? directionOf(type) : undefined;
  const color =
    direction === undefined
      ? undefined
      : { in: theme.colors.income, out: theme.colors.expense, neutral: theme.colors.text }[direction];

  const actualFormatOptions: MoneyFormatOptions = {
    ...formatOptions,
    signDisplay: showIcon && (direction === 'in' || direction === 'out') ? 'never' : formatOptions?.signDisplay,
  };

  const text = formatMoneyString(amount, currency, actualFormatOptions);

  const iconSize = props.variant === 'heading' ? 18 : props.variant === 'title' ? 16 : 13;

  const renderIcon = () => {
    if (!showIcon || !type) return null;
    if (type === TxType.EXPENSE || direction === 'out') {
      return <Minus size={iconSize} color={color} strokeWidth={2.5} />;
    }
    if (type === TxType.INCOME || direction === 'in') {
      return <Plus size={iconSize} color={color} strokeWidth={2.5} />;
    }
    return null;
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      {renderIcon()}
      <Text {...props} numeric style={[color !== undefined ? { color } : null, style]}>
        {text}
      </Text>
    </View>
  );
}
