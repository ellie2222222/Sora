import { View } from 'react-native';
import { TransactionType, type TransactionResponse } from '@sora/contracts';

import { sumByTransactionType } from '../utils/money.ts';
import { Money } from './Money.tsx';

export interface TransactionTotalsProps {
  transactions: readonly TransactionResponse[];
  testID?: string;
}

/**
 * Per-currency income + expense totals for a set of transactions, colour/
 * sign-coded via `Money`. Shared by a day's heading and a month's header so
 * both read the same figures the same way.
 */
export function TransactionTotals({ transactions, testID }: TransactionTotalsProps) {
  const income = sumByTransactionType(transactions, 'INCOME');
  const expense = sumByTransactionType(transactions, 'EXPENSE');
  if (income.length === 0 && expense.length === 0) return null;

  return (
    <View testID={testID} className="flex-row gap-[6px]">
      {income.map((total) => (
        <Money
          key={`in-${total.currency}`}
          amount={total.amount}
          currency={total.currency}
          type={TransactionType.INCOME}
          variant="caption"
          formatOptions={{ compact: true }}
        />
      ))}
      {expense.map((total) => (
        <Money
          key={`out-${total.currency}`}
          amount={total.amount}
          currency={total.currency}
          type={TransactionType.EXPENSE}
          variant="caption"
          formatOptions={{ compact: true }}
        />
      ))}
    </View>
  );
}
