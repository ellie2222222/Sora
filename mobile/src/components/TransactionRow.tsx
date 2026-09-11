import { View } from 'react-native';
import { UsersRound } from 'lucide-react-native';
import type { TransactionResponse } from '@sora/contracts';

import { useTheme } from '../app/providers/ThemeProvider.tsx';
import { formatTimeOfDay } from '../utils/date.ts';
import { Money } from './Money.tsx';
import { Text } from './Text.tsx';

export interface TransactionRowProps {
  transaction: TransactionResponse;
  testID?: string;
}

/** The one row shape for a transaction, shared by Home's timeline and the Transactions list. */
export function TransactionRow({ transaction, testID }: TransactionRowProps) {
  const theme = useTheme();
  const category = transaction.category;
  const title = transaction.description ?? category?.name ?? transaction.type;
  const initialSource = category?.icon ?? category?.name ?? transaction.type;
  const initial = initialSource.slice(0, 1).toUpperCase();
  const tint = category?.color ?? theme.colors.textMuted;
  const showCategoryInCaption = category !== null && transaction.description !== null;

  return (
    <View
      testID={testID}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.sm,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: theme.radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.surfaceMuted,
          borderWidth: 1.5,
          borderColor: tint,
        }}
      >
        <Text weight="semibold" style={{ color: tint }}>
          {initial}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1}>{title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
          <Text variant="caption" tone="muted">
            {formatTimeOfDay(transaction.transactionDate)}
            {showCategoryInCaption ? ` · ${category.name}` : ''}
          </Text>
          {transaction.isCrossWallet ? <UsersRound size={12} color={theme.colors.textFaint} /> : null}
        </View>
      </View>
      <Money
        amount={transaction.amount}
        currency={transaction.currency}
        type={transaction.type}
        weight="semibold"
        formatOptions={{ signDisplay: 'always' }}
      />
    </View>
  );
}
