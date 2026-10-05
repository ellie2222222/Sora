import { Pressable, View, type DimensionValue } from 'react-native';
import { useMemo } from 'react';
import { UsersRound } from 'lucide-react-native';
import { TransactionType, type TransactionResponse } from '@sora/contracts';

import { useTheme } from '@/app/providers';
import type { QueueStatus } from '@/services/sync';
import { CategoryAvatar } from './CategoryAvatar.tsx';
import { Money } from './Money.tsx';
import { SyncStatusDot } from './SyncStatusDot.tsx';
import { Text } from './Text.tsx';
import { Skeleton } from './Skeleton.tsx';

export interface TransactionItemProps {
  transaction: TransactionResponse;
  onPress?: (transaction: TransactionResponse) => void;
  testID?: string;
  /** The offline queue's status for this transaction, if it has a pending write. */
  syncStatus?: QueueStatus;
  /** Inside a card the row pads itself, so its whole width stays tappable. */
  paddingHorizontal?: number;
}

/** The one row shape for a transaction. */
export function TransactionItem({ transaction, onPress, testID, syncStatus, paddingHorizontal }: TransactionItemProps) {
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

  const tint = category?.color ?? theme.colors.primary;

  return (
    <Pressable
      testID={testID}
      onPress={onPress ? () => onPress(transaction) : undefined}
      className="w-full self-stretch flex-row items-center justify-between"
      style={{ paddingVertical: theme.spacing.sm, paddingHorizontal, minHeight: theme.sizes.listRowMinHeight }}
    >
      <View
        className="flex-row items-center flex-1"
        style={{ gap: theme.spacing.sm }}
      >
        <CategoryAvatar
          categoryIcon={category?.icon}
          categoryName={category?.name}
          transactionType={transaction.type}
          tint={tint}
          size={theme.sizes.badge.md}
        />
        <View className="flex-1">
          <Text numberOfLines={1} weight="medium">
            {primaryTitle}
          </Text>
          {secondaryText.length > 0 ? (
            <View className="flex-row items-center mt-xxs" style={{ gap: theme.spacing.xxs }}>
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {secondaryText}
              </Text>
              {transaction.isCrossWallet ? <UsersRound size={theme.iconSize.xs} color={theme.colors.textFaint} /> : null}
              <SyncStatusDot status={syncStatus} testID={testID ? `${testID}-sync-status` : undefined} />
            </View>
          ) : null}
        </View>
      </View>

      <View className="items-end justify-center">
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
export function TransactionItemSkeleton({ titleWidth, subtitleWidth, amountWidth }: { titleWidth?: DimensionValue; subtitleWidth?: DimensionValue; amountWidth?: DimensionValue } = {}) {
  const theme = useTheme();
  
  // Stable random widths across re-renders
  const rTitleWidth = useMemo<DimensionValue>(() => titleWidth ?? `${Math.floor(Math.random() * 40) + 40}%`, [titleWidth]);
  const rSubtitleWidth = useMemo<DimensionValue>(() => subtitleWidth ?? `${Math.floor(Math.random() * 30) + 30}%`, [subtitleWidth]);
  const rAmountWidth = useMemo<DimensionValue>(() => amountWidth ?? theme.sizes.skeletonWidth.xs + Math.floor(Math.random() * theme.sizes.skeletonWidth.xs), [amountWidth, theme]);

  return (
    <View
      className="w-full self-stretch flex-row items-center justify-between"
      style={{ paddingVertical: theme.spacing.sm, minHeight: theme.sizes.listRowMinHeight }}
    >
      <View
        className="flex-row items-center flex-1"
        style={{ gap: theme.spacing.sm }}
      >
        <Skeleton width={theme.sizes.badge.md} height={theme.sizes.badge.md} radius={theme.radius.pill} />
        <View className="flex-1" style={{ gap: theme.spacing.xxs, justifyContent: 'center' }}>
          <Skeleton width={rTitleWidth} height={theme.sizes.skeletonLine.body} radius={theme.radius.sm} />
          <Skeleton width={rSubtitleWidth} height={theme.sizes.skeletonLine.caption} radius={theme.radius.sm} />
        </View>
      </View>

      <View className="items-end justify-center">
        <Skeleton width={rAmountWidth} height={theme.sizes.skeletonLine.body} radius={theme.radius.sm} />
      </View>
    </View>
  );
}

