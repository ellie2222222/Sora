import { View } from 'react-native';
import { useSelector } from 'react-redux';
import { formatMoney } from '@sora/contracts';
import type { CurrencyTotal, TransactionResponse } from '@sora/contracts';

import { useTheme } from '../app/providers/ThemeProvider.tsx';
import { selectQueueEntryFor } from '../app/store/offlineQueueSlice.ts';
import type { DayGroup } from '../utils/groupByDate.ts';
import { formatDayHeading } from '../utils/date.ts';
import { sumScaledByKey } from '../utils/money.ts';
import { Money } from './Money.tsx';
import { Text } from './Text.tsx';
import { TransactionRow } from './TransactionRow.tsx';
import { ListItemEnter } from './ListItemEnter.tsx';

export interface TransactionListSectionProps {
  groups: DayGroup[];
  /** Shows a per-currency income/expense total next to each day's heading. */
  showDayTotals?: boolean;
  onPressTransaction?: (transaction: TransactionResponse) => void;
}

/** Renders `groupTransactionsByDay`'s output as flat, divider-separated sections rather than one Card per transaction. */
export function TransactionListSection({
  groups,
  showDayTotals = false,
  onPressTransaction,
}: TransactionListSectionProps) {
  const theme = useTheme();

  return (
    <View style={{ width: '100%' }}>
      {groups.map((group, index) => (
        <View key={group.day} style={{ width: '100%', marginTop: index === 0 ? 0 : theme.spacing.md }}>
          <View style={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text variant="label" tone="muted">
              {formatDayHeading(group.day)}
            </Text>
            {showDayTotals ? <DayTotals transactions={group.transactions} /> : null}
          </View>
          <View
            style={{
              width: '100%',
              marginTop: theme.spacing.xs,
              borderTopWidth: 1,
              borderTopColor: theme.colors.border,
            }}
          >
            {group.transactions.map((transaction, rowIndex) => (
              <View
                key={transaction.id}
                style={[
                  { width: '100%' },
                  rowIndex === 0
                    ? undefined
                    : { borderTopWidth: 1, borderTopColor: theme.colors.border },
                ]}
              >
                <ListItemEnter style={{ width: '100%' }}>
                  <TransactionListRow transaction={transaction} onPress={onPressTransaction} />
                </ListItemEnter>
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function TransactionListRow({
  transaction,
  onPress,
}: {
  transaction: TransactionResponse;
  onPress?: (transaction: TransactionResponse) => void;
}) {
  const syncStatus = useSelector(selectQueueEntryFor('transaction', transaction.id))?.status;
  return (
    <TransactionRow
      transaction={transaction}
      onPress={onPress}
      testID={`transaction-row-${transaction.id}`}
      syncStatus={syncStatus}
    />
  );
}

function DayTotals({ transactions }: { transactions: TransactionResponse[] }) {
  const theme = useTheme();
  const expense = sumByType(transactions, 'EXPENSE');
  if (expense.length === 0) return null;
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {expense.map((total) => (
        <Money
          key={total.currency}
          amount={total.amount}
          currency={total.currency}
          variant="caption"
          style={{ color: theme.colors.textMuted }}
        />
      ))}
    </View>
  );
}

/**
 * Per-currency totals, so a multi-currency wallet never sums across
 * currencies (BR-07); transfers are excluded (BR-06 — neither income nor
 * expense).
 */
function sumByType(transactions: TransactionResponse[], type: 'INCOME' | 'EXPENSE'): CurrencyTotal[] {
  const byCurrency = sumScaledByKey(
    transactions.filter((transaction) => transaction.type === type),
    (transaction) => transaction.currency,
    (transaction) => transaction.amount,
  );
  return Array.from(byCurrency, ([currency, amount]) => ({ currency, amount: formatMoney(amount) }));
}
