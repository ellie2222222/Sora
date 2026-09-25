import { memo } from 'react';
import { View } from 'react-native';
import { useSelector } from 'react-redux';
import type { TransactionResponse } from '@sora/contracts';

import { useTheme } from '@/app/providers';
import { selectQueueEntryFor } from '@/app/store';
import { formatDayHeading, type CalendarDay } from '@/utils';
import { Text } from './Text.tsx';
import { TransactionRow } from './TransactionRow.tsx';
import { TransactionTotals } from './TransactionTotals.tsx';
import { ListItemEnter } from './ListItemEnter.tsx';

/** Animates only freshly created rows, not every remount of existing data (tab switch, scroll-back, reopen). */
const RECENTLY_CREATED_MS = 5000;

function isRecentlyCreated(transaction: TransactionResponse): boolean {
  return Date.now() - new Date(transaction.createdAt).getTime() < RECENTLY_CREATED_MS;
}

export interface TransactionDayHeaderProps {
  day: CalendarDay;
  transactions: readonly TransactionResponse[];
  isFirst: boolean;
  /** Per-currency income/expense totals beside the heading; omit when the day may continue on an unloaded page. */
  showTotals: boolean;
}

/** A day section's heading for a day-grouped `SectionList` of transactions, divider included. */
export function TransactionDayHeader({ day, transactions, isFirst, showTotals }: TransactionDayHeaderProps) {
  const theme = useTheme();

  return (
    <View className="w-full" style={{ paddingTop: isFirst ? 0 : theme.spacing.md }}>
      <View className="w-full flex-row justify-between items-baseline">
        <Text variant="label" tone="muted">
          {formatDayHeading(day)}
        </Text>
        {showTotals ? <TransactionTotals transactions={transactions} /> : null}
      </View>
      <View
        className="w-full border-t"
        style={{ marginTop: theme.spacing.xs, borderTopColor: theme.colors.border }}
      />
    </View>
  );
}

export interface TransactionListRowProps {
  transaction: TransactionResponse;
  onPress?: (transaction: TransactionResponse) => void;
}

/** Memoized so a new page appended to the list re-renders only the rows it adds. */
export const TransactionListRow = memo(function TransactionListRow({ transaction, onPress }: TransactionListRowProps) {
  const syncStatus = useSelector(selectQueueEntryFor('transaction', transaction.id))?.status;
  return (
    <ListItemEnter style={{ width: '100%' }} animate={isRecentlyCreated(transaction)}>
      <TransactionRow
        transaction={transaction}
        onPress={onPress}
        testID={`row-transaction-${transaction.id}`}
        syncStatus={syncStatus}
      />
    </ListItemEnter>
  );
});
