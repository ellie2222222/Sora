import type { MoneyString, TransactionType } from '@sora/contracts';
import { negate, parseMoney } from '@sora/contracts';

import { useTheme } from '@/app/providers';
import { directionOf, formatScaled, type MoneyFormatOptions } from '@/utils';
import { Text, type TextComponentProps } from './Text.tsx';

export interface MoneyProps extends Omit<TextComponentProps, 'tone' | 'numeric'> {
  amount: MoneyString;
  currency: string;
  /** Colours the figure income-green / expense-red / neutral. Omit to inherit `tone`. */
  type?: TransactionType;
  /** Fuses a +/- sign into the figure for INCOME/EXPENSE. Defaults to true. */
  showSign?: boolean;
  formatOptions?: MoneyFormatOptions;
}

/**
 * `amount` always arrives positive (VL-04: direction lives in `type`, never in
 * the sign). EXPENSE is negated here so the formatted string carries a real
 * "-" fused to the currency symbol by `Intl` — one glyph, never a gap.
 */
export function Money({ amount, currency, type, showSign = true, formatOptions, style, ...props }: MoneyProps) {
  const theme = useTheme();

  const value = parseMoney(amount);
  const direction = type !== undefined ? directionOf(type) : undefined;
  // Nothing moved, so a zero is neither earned nor spent.
  const colorDirection = value === 0n && direction !== undefined ? 'neutral' : direction;
  const color =
    colorDirection === undefined
      ? undefined
      : { in: theme.colors.income, out: theme.colors.expense, neutral: theme.colors.text }[colorDirection];

  const signed = direction === 'out' ? negate(value) : value;

  const actualFormatOptions: MoneyFormatOptions = {
    ...formatOptions,
    signDisplay:
      showSign && (direction === 'in' || direction === 'out') ? 'always' : formatOptions?.signDisplay,
  };

  const text = formatScaled(signed, currency, actualFormatOptions);

  return (
    <Text {...props} numeric style={[color !== undefined ? { color } : null, style]}>
      {text}
    </Text>
  );
}
