import { Pressable, View } from 'react-native';
import { UsersRound } from 'lucide-react-native';
import { TransactionType, type TransactionResponse } from '@sora/contracts';

import { useTheme } from '../app/providers/ThemeProvider.tsx';
import type { QueueStatus } from '../services/sync/offlineQueueTypes.ts';
import { Money } from './Money.tsx';
import { SyncStatusDot } from './SyncStatusDot.tsx';
import { Text } from './Text.tsx';

export interface TransactionRowProps {
  transaction: TransactionResponse;
  onPress?: (transaction: TransactionResponse) => void;
  testID?: string;
  /** The offline queue's status for this transaction, if it has a pending write. */
  syncStatus?: QueueStatus;
}

/** The one row shape for a transaction, shared by Home's timeline and the Transactions list. */
export function TransactionRow({ transaction, onPress, testID, syncStatus }: TransactionRowProps) {
  const theme = useTheme();
  const category = transaction.category;
  
  const fromAcc = transaction.fromAccount?.name;
  const toAcc = transaction.toAccount?.name;

  let accountText = '';
  if (transaction.type === TransactionType.TRANSFER) {
    accountText = fromAcc && toAcc ? `${fromAcc} → ${toAcc}` : fromAcc || toAcc || '';
  } else if (transaction.type === TransactionType.EXPENSE) {
    accountText = fromAcc || '';
  } else {
    accountText = toAcc || '';
  }

  const primaryTitle = transaction.description || category?.name || transaction.type;
  
  const secondaryParts: string[] = [];
  if (transaction.description && category?.name) {
    secondaryParts.push(category.name);
  }
  if (accountText) {
    secondaryParts.push(accountText);
  }
  const secondaryText = secondaryParts.join(' · ');

  const initialSource = category?.icon ?? category?.name ?? transaction.type;
  const initial = initialSource.slice(0, 1).toUpperCase();
  const tint = category?.color ?? theme.colors.primary;

  return (
    <Pressable
      testID={testID}
      onPress={onPress ? () => onPress(transaction) : undefined}
      style={{
        width: '100%',
        alignSelf: 'stretch',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: theme.spacing.sm,
        gap: theme.spacing.sm,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, flex: 1, paddingRight: theme.spacing.xs }}>
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: theme.radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.surfaceMuted,
            borderWidth: 1.5,
            borderColor: tint,
          }}
        >
          <Text weight="semibold" style={{ color: tint, fontSize: 15 }}>
            {initial}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} weight="medium" style={{ fontSize: 15 }}>
            {primaryTitle}
          </Text>
          {secondaryText.length > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <Text variant="caption" tone="muted" numberOfLines={1} style={{ fontSize: 12 }}>
                {secondaryText}
              </Text>
              {transaction.isCrossWallet ? <UsersRound size={12} color={theme.colors.textFaint} /> : null}
              <SyncStatusDot status={syncStatus} testID={testID ? `${testID}-sync-status` : undefined} />
            </View>
          ) : null}
        </View>
      </View>

      <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
        <Money
          amount={transaction.amount}
          currency={transaction.currency}
          type={transaction.type}
          weight="semibold"
        />
      </View>
    </Pressable>
  );
}
