import { memo } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { Pencil, Trash2 } from 'lucide-react-native';
import type { TransactionResponse } from '@sora/contracts';

import { useTheme } from '@/app/providers';
import { selectQueueEntryFor } from '@/app/store';
import { formatDayHeading, type CalendarDay } from '@/utils';
import { Text } from './Text.tsx';
import { TransactionItem } from './TransactionItem.tsx';
import { TransactionTotals } from './TransactionTotals.tsx';
import { ListItemEnter } from './ListItemEnter.tsx';
import { SwipeableRow, type SwipeRowAction } from './swipe/index.ts';

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
    <View className="w-full">
      {!isFirst ? (
        <View
          style={{
            height: 1,
            backgroundColor: theme.colors.border,
            marginTop: theme.spacing.sm,
            marginBottom: theme.spacing.sm,
          }}
        />
      ) : null}
      <View
        className="w-full flex-row justify-between items-center"
        style={{ paddingVertical: theme.spacing.sm, marginBottom: 0 }}
      >
        <Text variant="label" weight="semibold">
          {formatDayHeading(day)}
        </Text>
        {showTotals ? <TransactionTotals transactions={transactions} /> : null}
      </View>
    </View>
  );
}

export interface TransactionListItemProps {
  transaction: TransactionResponse;
  onPress?: (transaction: TransactionResponse) => void;
  /** Swipe actions; omit when the caller may not write, and keep them stable so the memo holds. */
  onEdit?: (transaction: TransactionResponse) => void;
  onDelete?: (transaction: TransactionResponse) => void;
}

/** Memoized so a new page appended to the list re-renders only the rows it adds. */
export const TransactionListItem = memo(function TransactionListItem({ transaction, onPress, onEdit, onDelete }: TransactionListItemProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const syncStatus = useSelector(selectQueueEntryFor('transaction', transaction.id))?.status;

  const actions: SwipeRowAction[] = [];
  if (onEdit !== undefined) {
    actions.push({ key: 'edit', label: t('common.edit'), icon: Pencil, tone: 'primary', onPress: () => onEdit(transaction), testID: 'btn-edit-transaction' });
  }
  if (onDelete !== undefined) {
    actions.push({ key: 'delete', label: t('common.delete'), icon: Trash2, tone: 'danger', onPress: () => onDelete(transaction), testID: 'btn-delete-transaction' });
  }

  return (
    <ListItemEnter style={{ width: '100%' }} animate={isRecentlyCreated(transaction)}>
      <SwipeableRow
        actions={actions}
        backgroundColor={theme.colors.background}
        onActivate={onPress ? () => onPress(transaction) : undefined}
      >
        <TransactionItem
          transaction={transaction}
          onPress={onPress}
          testID={`row-transaction-${transaction.id}`}
          syncStatus={syncStatus}
        />
      </SwipeableRow>
    </ListItemEnter>
  );
});
