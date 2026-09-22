import { useEffect, useState } from 'react';
import { Plus, Receipt } from 'lucide-react-native';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { TransactionStatus, type TransactionResponse } from '@sora/contracts';

import { AnimatedScreen, DatePickerModal, DateStrip, Fab, PeriodBar, RefreshableScrollView, SkeletonList, SlideSwap, StateView, Text, TransactionListSection, TransactionTotals } from '@/components';
import { useAuth, useTheme, useWallets } from '@/app/providers';
import { useListTransactionsQuery } from '@/app/store';
import { WalletContextBar } from '@/features/wallets';
import { TransactionDetailModal } from './TransactionDetailModal';
import {
  groupTransactionsByDay,
  isNetworkError,
  shiftAnchor,
  today,
  windowFor,
  type CalendarDay,
  type DashboardPeriod,
} from '@/utils';

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

  const [period, setPeriod] = useState<DashboardPeriod>('monthly');
  const [selectedDay, setSelectedDay] = useState<CalendarDay>(today());
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionResponse | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const walletId = activeWalletId ?? undefined;
  // One source for the window, so the day strip and the query cannot disagree.
  const { dateFrom, dateTo } = windowFor(period, selectedDay);

  const transactions = useListTransactionsQuery(
    { walletId, accountId, categoryId, dateFrom, dateTo, pageSize: 200 },
    // Guest mode has one wallet and never receives a walletId filter from the
    // wallet switcher, so gating on one would leave the list permanently idle.
    { skip: !isGuest && walletId === undefined && accountId === undefined },
  );

  // Whose money this is (wallet/account/category) — not which month. Changing
  // month keeps last month's rows on screen while the new month loads (no
  // skeleton flash); changing whose money it is must clear them immediately,
  // so a moment of one wallet's transactions never reads as another's.
  const scopeKey = `${walletId ?? ''}|${accountId ?? ''}|${categoryId ?? ''}`;
  const [displayedItems, setDisplayedItems] = useState<TransactionResponse[]>([]);
  const [displayedScopeKey, setDisplayedScopeKey] = useState(scopeKey);
  if (scopeKey !== displayedScopeKey) {
    setDisplayedScopeKey(scopeKey);
    setDisplayedItems([]);
  }
  useEffect(() => {
    // Deleted transactions stay in the ledger (BR-03) but a deleted entry
    // reads as noise here, not history — it's excluded from every derived
    // figure server-side already, so the list should match.
    if (transactions.data) {
      setDisplayedItems(transactions.data.items.filter((item) => item.status !== TransactionStatus.DELETED));
    }
  }, [transactions.data]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await transactions.refetch();
    } finally {
      setIsRefreshing(false);
    }
  };

  const items = scopeKey === displayedScopeKey ? displayedItems : [];
  const showFab = !transactions.isLoading && items.length > 0;

  // A total summed from one page of a larger window is wrong, not merely partial,
  // so it is withheld instead. Measured against the fetched count, not the
  // displayed one, since DELETED rows are filtered out after the fetch.
  const fetchedCount = transactions.data?.items.length ?? 0;
  const windowTotal = transactions.data?.pagination?.total ?? fetchedCount;
  const isTruncated = windowTotal > fetchedCount;

  const renderContent = () => {
    if (transactions.isLoading && items.length === 0) {
      return <SkeletonList rows={8} />;
    }
    if (transactions.isError && items.length === 0 && !isNetworkError(transactions.error)) {
      return (
        <StateView
          variant="error"
          error={transactions.error}
          retryAction={() => void transactions.refetch()}
          testID={`${testIDPrefix}-error`}
          entrance="none"
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
          entrance="none"
        />
      );
    }

    const groups = groupTransactionsByDay(items);
    return (
      <RefreshableScrollView
        testID={`${testIDPrefix}-list`}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.md,
          paddingTop: theme.spacing.sm,
          // 88 clears the Fab's own footprint (48 size + spacing.md margin) plus breathing room.
          paddingBottom: fabBottomOffset + 88,
        }}
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
        <View style={{ paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.xs }}>
          <PeriodBar
            period={period}
            anchor={selectedDay}
            onChangePeriod={setPeriod}
            onShift={(delta) => setSelectedDay((current) => shiftAnchor(period, current, delta))}
            onOpenPicker={() => setShowDatePicker(true)}
            testIDPrefix={testIDPrefix}
          />
          <View className="flex-row justify-end" style={{ marginTop: theme.spacing.xs }}>
            {isTruncated ? (
              <Text variant="caption" tone="muted" testID={`${testIDPrefix}-period-truncated`}>
                {t('transactions.showingNewest', { count: fetchedCount, total: windowTotal })}
              </Text>
            ) : (
              <TransactionTotals transactions={items} testID={`${testIDPrefix}-period-totals`} />
            )}
          </View>
        </View>

        {/* Only meaningful while a day *is* the window — in any wider one it would
            pick a day the list does not narrow to. */}
        {period === 'daily' ? (
          <View style={{ paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.xs }}>
            <DateStrip selectedDay={selectedDay} onSelectDay={setSelectedDay} testID={`${testIDPrefix}-date-strip`} />
          </View>
        ) : null}

        <SlideSwap swapKey={dateFrom} style={{ flex: 1 }}>
          {renderContent()}
        </SlideSwap>

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
          onSelectDay={setSelectedDay}
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
