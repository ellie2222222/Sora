import { useState } from 'react';
import { Calendar, Plus, Receipt } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TransactionResponse } from '@sora/contracts';

import {
  AnimatedScreen,
  DatePickerModal,
  Fab,
  MonthSelector,
  RefreshableScrollView,
  StateView,
  Text,
  TransactionListSection,
} from '../../../components';
import { SkeletonList } from '../../../components/Skeleton';
import { useAuth, useTheme, useWallets } from '../../../app/providers';
import { useListTransactionsQuery } from '../../../app/store/api';
import { WalletContextBar } from '../../wallets/components/WalletContextBar';
import { TransactionDetailModal } from './TransactionDetailModal';
import { addMonths, endOfMonth, formatDay, groupTransactionsByDay, startOfMonth, today } from '../../../utils';

/**
 * The transaction-list shell shared by the Home tab (unfiltered, the whole
 * wallet's history) and the Transactions stack screen (filtered by account
 * or category) — same fetch/loading/empty/error/list shape either way.
 */
export function TransactionListScreen({
  accountId,
  categoryId,
  onManage,
  onAddTransaction,
  fabBottomOffset,
  testIDPrefix,
}: {
  accountId?: string;
  categoryId?: string;
  onManage: () => void;
  onAddTransaction: () => void;
  fabBottomOffset: number;
  testIDPrefix: string;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { isGuest } = useAuth();
  const { activeWalletId } = useWallets();

  const [selectedDay, setSelectedDay] = useState<string>(today());
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionResponse | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const walletId = activeWalletId ?? undefined;
  const dateFrom = startOfMonth(selectedDay);
  const dateTo = endOfMonth(selectedDay);

  const transactions = useListTransactionsQuery(
    { walletId, accountId, categoryId, dateFrom, dateTo, pageSize: 100 },
    // Guest mode has one wallet and never receives a walletId filter from the
    // wallet switcher, so gating on one would leave the list permanently idle.
    { skip: !isGuest && walletId === undefined && accountId === undefined },
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await transactions.refetch();
    } finally {
      setIsRefreshing(false);
    }
  };

  const items = transactions.data?.items ?? [];
  const showFab = !transactions.isLoading && !transactions.isError && items.length > 0;

  const renderContent = () => {
    if (transactions.isLoading) {
      return <SkeletonList rows={8} />;
    }
    if (transactions.isError) {
      return (
        <StateView
          variant="error"
          error={transactions.error}
          retryAction={() => void transactions.refetch()}
          testID={`${testIDPrefix}-error`}
        />
      );
    }

    if (items.length === 0) {
      return (
        <StateView
          variant="empty"
          icon={Receipt}
          title={t('home.noTransactionsTitle')}
          message={t('home.noTransactionsMessage')}
          primaryAction={{
            label: t('common.create'),
            onPress: onAddTransaction,
            icon: Plus,
          }}
          testID={`${testIDPrefix}-empty`}
        />
      );
    }

    const groups = groupTransactionsByDay(items);
    return (
      <RefreshableScrollView
        testID={`${testIDPrefix}-list`}
        // 96 clears the Fab's own footprint (56 size + spacing.md margin) plus breathing room.
        contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: fabBottomOffset + 96 }}
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
      >
        <TransactionListSection
          groups={groups}
          showDayTotals
          onPressTransaction={(tx) => setSelectedTransaction(tx)}
        />
      </RefreshableScrollView>
    );
  };

  return (
    <AnimatedScreen>
      <WalletContextBar onManage={onManage}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.xs,
            backgroundColor: theme.colors.surfaceMuted,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border,
          }}
        >
          <MonthSelector
            label={formatDay(selectedDay)}
            onPrev={() => setSelectedDay(addMonths(selectedDay, -1))}
            onNext={() => setSelectedDay(addMonths(selectedDay, 1))}
            onOpenPicker={() => setShowDatePicker(true)}
            testID={`${testIDPrefix}-month-selector`}
          />
        </View>

        {renderContent()}

        {showFab ? (
          <Fab
            testID={`${testIDPrefix}-fab`}
            bottomOffset={fabBottomOffset}
            onPress={onAddTransaction}
          />
        ) : null}

        <DatePickerModal
          visible={showDatePicker}
          selectedDay={selectedDay}
          onSelectDay={(day) => setSelectedDay(day)}
          onClose={() => setShowDatePicker(false)}
        />

        <TransactionDetailModal
          visible={Boolean(selectedTransaction)}
          transaction={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
        />
      </WalletContextBar>
    </AnimatedScreen>
  );
}
