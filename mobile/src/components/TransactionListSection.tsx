import { View } from 'react-native';
import { useSelector } from 'react-redux';
import type { TransactionResponse } from '@sora/contracts';

import { useTheme } from '@/app/providers';
import { selectQueueEntryFor } from '@/app/store';
import { formatDayHeading } from '@/utils';
import type { DayGroup } from '@/utils';
import { Text } from './Text.tsx';
import { TransactionRow } from './TransactionRow.tsx';
import { TransactionTotals } from './TransactionTotals.tsx';
import { ListItemEnter } from './ListItemEnter.tsx';

/** A row only plays its entrance animation while its creation is still fresh on screen — not on every remount (tab switch, leaving and reopening the screen) of already-existing data. */
const RECENTLY_CREATED_MS = 5000;

function isRecentlyCreated(transaction: TransactionResponse): boolean {
  return Date.now() - new Date(transaction.createdAt).getTime() < RECENTLY_CREATED_MS;
}

export interface TransactionListSectionProps {
  groups: DayGroup[];
  /** Shows each day's per-currency income and expense totals next to its heading. */
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
    <View className="w-full">
      {groups.map((group, index) => (
        <View key={group.day} className="w-full" style={{ marginTop: index === 0 ? 0 : theme.spacing.md }}>
          <View className="w-full flex-row justify-between items-baseline">
            <Text variant="label" tone="muted">
              {formatDayHeading(group.day)}
            </Text>
            {showDayTotals ? <TransactionTotals transactions={group.transactions} /> : null}
          </View>
          <View
            className="w-full border-t"
            style={{ marginTop: theme.spacing.xs, borderTopColor: theme.colors.border }}
          >
            {group.transactions.map((transaction) => (
              <View key={transaction.id} className="w-full">
                <ListItemEnter style={{ width: '100%' }} animate={isRecentlyCreated(transaction)}>
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

