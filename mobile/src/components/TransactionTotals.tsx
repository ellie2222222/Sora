import { View } from 'react-native';
import { TransactionType, type TransactionResponse } from '@sora/contracts';

import { netSumByCurrency } from '@/utils';
import { Money } from './Money.tsx';

export interface TransactionTotalsProps {
  transactions: readonly TransactionResponse[];
  testID?: string;
  variant?: 'caption' | 'label' | 'body' | 'title' | 'heading';
}

/** Per-currency income + expense totals for a set of transactions, colour/sign-coded via `Money`. */
export function TransactionTotals({ transactions, testID, variant = 'label' }: TransactionTotalsProps) {
  const nets = netSumByCurrency(transactions);
  if (nets.length === 0) return null;

  return (
    <View testID={testID} className="flex-row gap-[6px]">
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
