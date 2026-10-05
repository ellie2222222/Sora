import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { TransactionType, type TransactionResponse } from '@sora/contracts';

import { useTheme } from '@/app/providers';
import { formatMoneyString, netSumByCurrency, sumByTransactionType } from '@/utils';
import { Money } from './Money.tsx';
import { Text } from './Text.tsx';

export interface TransactionTotalsProps {
  transactions: readonly TransactionResponse[];
  testID?: string;
  variant?: 'caption' | 'label' | 'body' | 'title' | 'heading';
}

/** Per-currency net (income − expense) of a set of transactions, colour/sign-coded via `Money`. */
export function TransactionTotals({ transactions, testID, variant = 'label' }: TransactionTotalsProps) {
  const theme = useTheme();
  const nets = netSumByCurrency(transactions);
  if (nets.length === 0) return null;

  return (
    <View testID={testID} className="flex-row" style={{ gap: theme.spacing.xs }}>
      {nets.map((total) => (
        <Money
          key={total.currency}
          amount={total.amount}
          currency={total.currency}
          type={total.type}
          variant={variant}
          weight="semibold"
          formatOptions={{ compact: true }}
        />
      ))}
    </View>
  );
}

export interface IncomeExpenseTotalsProps {
  transactions: readonly TransactionResponse[];
  testID?: string;
}

/**
 * Per-currency "↑ income ↓ expense" for a set of transactions, small enough to sit beside a heading.
 * A side with no rows is left out rather than shown as ₫0, so a filtered list never reads as "nothing spent".
 */
export function IncomeExpenseTotals({ transactions, testID }: IncomeExpenseTotalsProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const income = sumByTransactionType(transactions, TransactionType.INCOME);
  const expense = sumByTransactionType(transactions, TransactionType.EXPENSE);
  const currencies = [...new Set([...income, ...expense].map((total) => total.currency))];
  if (currencies.length === 0) return null;

  const sides = [
    { arrow: '↑', label: t('transactions.incomeLabel'), color: theme.colors.income, totals: income },
    { arrow: '↓', label: t('transactions.expensesLabel'), color: theme.colors.expense, totals: expense },
  ];
  const figures = currencies.flatMap((currency) =>
    sides.flatMap((side) => {
      const total = side.totals.find((candidate) => candidate.currency === currency);
      if (total === undefined) return [];
      return [{ ...side, key: `${currency}${side.arrow}`, text: formatMoneyString(total.amount, currency, { compact: true }) }];
    }),
  );

  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={figures.map((figure) => `${figure.label} ${figure.text}`).join(', ')}
      className="flex-row flex-wrap justify-end"
      style={{ flexShrink: 1, columnGap: theme.spacing.sm }}
    >
      {figures.map((figure) => (
        <Text key={figure.key} variant="caption" weight="semibold" numeric numberOfLines={1} style={{ color: figure.color }}>
          {`${figure.arrow} ${figure.text}`}
        </Text>
      ))}
    </View>
  );
}
