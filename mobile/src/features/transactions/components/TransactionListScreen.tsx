import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Receipt } from 'lucide-react-native';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { TransactionStatus, TransactionType, type TransactionResponse } from '@sora/contracts';

import {
  AnimatedScreen,
  closeOpenSwipeRow,
  DatePickerModal,
  DateStrip,
  Fab,
  fabListPaddingBottom,
  IncomeExpenseTotals,
  ListLoadMoreFooter,
  PeriodBar,
  PeriodSummaryCard,
  RefreshableFlatList,
  SegmentedControl,
  SlideSwap,
  StateView,
  Text,
  TransactionDayCard,
} from '@/components';
import { useAuth, useModal, useTheme, useToast, useWallets } from '@/app/providers';
import { useListTransactionsInfiniteQuery } from '@/app/store';
import { NoWalletState, WalletContextBar } from '@/features/wallets';
import { useWarmAddTransactionReads } from '../hooks/useWarmAddTransactionReads.ts';
import { DeleteTransactionDialog } from './DeleteTransactionDialog.tsx';
import { TransactionDetailModal } from './TransactionDetailModal';
import { TransactionDaysSkeleton, TransactionListSkeleton } from './TransactionListSkeleton';
import {
  canLoadMore,
  flattenPages,
  groupTransactionsByDay,
  isNetworkError,
  parseDay,
  shiftAnchor,
  today,
  totalOf,
  windowFor,
  formatMonthYear,
  formatPeriodLabel,
  type CalendarDay,
  type DashboardPeriod,
} from '@/utils';

interface DaySection {
  day: CalendarDay;
  isFirst: boolean;
  showTotals: boolean;
  data: TransactionResponse[];
  isNewMonth: boolean;
  /** Every loaded row of this section's month, for its header totals; null while the month may continue on an unloaded page. */
  monthTransactions: TransactionResponse[] | null;
}

const FILTER_TYPES = ['ALL', TransactionType.INCOME, TransactionType.EXPENSE, TransactionType.TRANSFER] as const;

/** The list is always one period's window, so an empty list says nothing about the wallet's other periods. */
const EMPTY_TITLE_KEY = {
  ALL: 'home.noTransactionsTitle',
  [TransactionType.INCOME]: 'home.noIncomeTitle',
  [TransactionType.EXPENSE]: 'home.noExpensesTitle',
  [TransactionType.TRANSFER]: 'home.noTransfersTitle',
} as const;

/**
 * The transaction-list shell shared by the Home tab (unfiltered, the whole
 * wallet's history) and the Transactions stack screen (filtered by account
 * or category) — same fetch/loading/empty/error/list shape either way.
 */
export function TransactionListScreen({
  accountId,
  categoryId,
  onAddTransaction,
  fabBottomOffset,
  testIDPrefix,
}: {
  accountId?: string;
  categoryId?: string;
  onAddTransaction: () => void;
  fabBottomOffset: number;
  testIDPrefix: string;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { isGuest } = useAuth();
  const { activeWalletId, isLoading: walletsLoading, permissions } = useWallets();
  const { openModal } = useModal();
  const { showToast } = useToast();

  const [period, setPeriod] = useState<DashboardPeriod>('monthly');
  const [selectedDay, setSelectedDay] = useState<CalendarDay>(today());
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionResponse | null>(null);
  const [deletingTransaction, setDeletingTransaction] = useState<TransactionResponse | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filterType, setFilterType] = useState<'ALL' | TransactionType>('ALL');

  const walletId = activeWalletId ?? undefined;
  // Guest reads come from the device itself, so only a signed-in session has anything to warm.
  useWarmAddTransactionReads(walletId, isGuest);
  // One source for the window, so the day strip and the query cannot disagree.
  const { dateFrom, dateTo } = windowFor(period, selectedDay);

  // Filtered by the server, not over the loaded pages: a first page with none of the chosen
  // type would otherwise read as "none in this period" and stop paging.
  const type = filterType === 'ALL' ? undefined : filterType;
  const transactions = useListTransactionsInfiniteQuery(
    { walletId, accountId, categoryId, type, dateFrom, dateTo },
    // Guest mode has one wallet and never receives a walletId filter from the
    // wallet switcher, so gating on one would leave the list permanently idle.
    { skip: !isGuest && walletId === undefined && accountId === undefined },
  );

  // Whose money this is (wallet/account/category) and which type — not which month. Changing
  // month keeps last month's rows on screen while the new month loads (no skeleton flash);
  // changing scope or type must clear them, so one wallet's or one type's rows never read as another's.
  const scopeKey = `${walletId ?? ''}|${accountId ?? ''}|${categoryId ?? ''}|${filterType}`;
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
      setDisplayedItems(flattenPages(transactions.data.pages).filter((item) => item.status !== TransactionStatus.DELETED));
    }
  }, [transactions.data]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Back to page one: a refresh re-reads the newest rows, not every page scrolled through.
      await transactions.refetch({ refetchCachedPages: false });
    } finally {
      setIsRefreshing(false);
    }
  };

  const items = scopeKey === displayedScopeKey ? displayedItems : [];

  const showFab = !transactions.isLoading && items.length > 0;

  // A total summed from part of a window is wrong, not merely partial, so it is
  // withheld until every page is loaded. Counted before the DELETED filter, since
  // the server's total counts those rows too.
  const hasMorePages = transactions.hasNextPage;
  const fetchedCount = useMemo(() => flattenPages(transactions.data?.pages).length, [transactions.data]);
  const windowTotal = totalOf(transactions.data?.pages) ?? fetchedCount;

  // The last loaded day may continue on the next page, so its heading total waits too.
  const sections = useMemo<DaySection[]>(() => {
    const groups = groupTransactionsByDay(items);
    const monthKeyOf = (day: CalendarDay) => day.slice(0, 7);
    const byMonth = new Map<string, TransactionResponse[]>();
    for (const group of groups) {
      const key = monthKeyOf(group.day);
      const monthRows = byMonth.get(key) ?? [];
      monthRows.push(...group.transactions);
      byMonth.set(key, monthRows);
    }
    const lastGroup = groups.at(-1);
    const lastLoadedMonth = lastGroup === undefined ? null : monthKeyOf(lastGroup.day);

    return groups.map((group, index) => {
      const currentMonth = parseDay(group.day).month;
      const prevMonth = index > 0 ? parseDay(groups[index - 1]?.day ?? '').month : null;
      const isNewMonth = (period === 'yearly' || period === 'quarterly') && currentMonth !== prevMonth;
      const monthKey = monthKeyOf(group.day);

      return {
        day: group.day,
        isFirst: index === 0,
        showTotals: !(hasMorePages && index === groups.length - 1),
        data: group.transactions,
        isNewMonth,
        monthTransactions: hasMorePages && monthKey === lastLoadedMonth ? null : (byMonth.get(monthKey) ?? null),
      };
    });
  }, [items, hasMorePages, period]);

  const handlePressTransaction = useCallback((transaction: TransactionResponse) => setSelectedTransaction(transaction), []);
  const handleEditTransaction = useCallback(
    (transaction: TransactionResponse) => openModal('EditTransaction', { transactionId: transaction.id }),
    [openModal],
  );
  const handleDeleteTransaction = useCallback((transaction: TransactionResponse) => setDeletingTransaction(transaction), []);
  const handleEndReached = () => {
    if (canLoadMore(transactions)) void transactions.fetchNextPage();
  };

  const renderContent = () => {


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

    // A new type or scope starts a fresh query; until it answers, empty means "not loaded yet".
    if (items.length === 0 && transactions.isFetching) {
      return (
        <View style={{ paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.sm }}>
          <TransactionDaysSkeleton />
        </View>
      );
    }

    if (items.length === 0) {
      return (
        <StateView
          variant="empty"
          icon={Receipt}
          title={t(EMPTY_TITLE_KEY[filterType], { period: formatPeriodLabel(period, selectedDay) })}
          message={t(filterType === 'ALL' ? 'home.noTransactionsMessage' : 'home.noFilteredMessage')}
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

    return (
      <RefreshableFlatList<DaySection>
        testID="list-transactions"
        data={sections}
        keyExtractor={(section) => section.day}
        renderItem={({ item: section }) => (
          <View>
            {section.isNewMonth ? (
              <View
                className="flex-row items-center justify-between"
                style={{
                  marginTop: section.isFirst ? 0 : theme.spacing.lg,
                  marginBottom: theme.spacing.sm,
                  marginHorizontal: theme.spacing.xxs,
                  gap: theme.spacing.md,
                }}
              >
                <Text variant="title" weight="bold" numberOfLines={1} style={{ flexShrink: 0 }}>
                  {formatMonthYear(section.day)}
                </Text>
                {section.monthTransactions !== null ? (
                  <IncomeExpenseTotals
                    transactions={section.monthTransactions}
                    testID={`${testIDPrefix}-month-totals-${section.day.slice(0, 7)}`}
                  />
                ) : null}
              </View>
            ) : null}
            <TransactionDayCard
              day={section.day}
              transactions={section.data}
              showTotals={section.showTotals}
              onPress={handlePressTransaction}
              onEdit={permissions.canWrite ? handleEditTransaction : undefined}
              onDelete={permissions.canWrite ? handleDeleteTransaction : undefined}
            />
          </View>
        )}
        onScrollBeginDrag={closeOpenSwipeRow}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          <ListLoadMoreFooter
            isFetchingNextPage={transactions.isFetchingNextPage}
            hasNextPage={hasMorePages}
            isError={transactions.isError}
            onRetry={() => void transactions.fetchNextPage()}
            testID={`${testIDPrefix}-list-footer`}
          />
        }
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.md,
          paddingTop: theme.spacing.sm,
          paddingBottom: fabListPaddingBottom(theme, fabBottomOffset),
        }}
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
      />
    );
  };

  return (
    <AnimatedScreen testID={`screen-${testIDPrefix}`}>
      <WalletContextBar>
        <View style={{ paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.xs }}>
          <PeriodBar
            period={period}
            anchor={selectedDay}
            onChangePeriod={setPeriod}
            onShift={(delta) => setSelectedDay((current) => shiftAnchor(period, current, delta))}
            onOpenPicker={() => setShowDatePicker(true)}
            testIDPrefix={testIDPrefix}
          />
        </View>
        {(activeWalletId === null && walletsLoading) || (transactions.isLoading && items.length === 0) ? (
          <TransactionListSkeleton />
        ) : activeWalletId === null ? (
          <View style={{ flex: 1, paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.xl }}>
            <NoWalletState
              title={t('home.noWalletTitle')}
              message={t('home.noWalletDescription')}
              testID={`${testIDPrefix}-no-wallet`}
            />
          </View>
        ) : (
          <>
            <View style={{ paddingHorizontal: theme.spacing.md }}>
              {hasMorePages ? (
                <View className="flex-row justify-end" style={{ marginTop: theme.spacing.xs }}>
              <Text variant="caption" tone="muted" testID={`${testIDPrefix}-period-truncated`}>
                {t('transactions.showingNewest', { count: fetchedCount, total: windowTotal })}
              </Text>
            </View>
          ) : (
            <View style={{ marginTop: theme.spacing.sm }}>
              <PeriodSummaryCard transactions={items} filterType={filterType} testID={`${testIDPrefix}-period-summary`} />
            </View>
          )}
        </View>

        {/* Only meaningful while a day *is* the window — in any wider one it would
            pick a day the list does not narrow to. */}
        {period === 'daily' ? (
          <View style={{ paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.xs }}>
            <DateStrip selectedDay={selectedDay} onSelectDay={setSelectedDay} testID={`${testIDPrefix}-date-strip`} />
          </View>
        ) : null}

        <View
          style={{
            paddingHorizontal: theme.spacing.md,
            paddingBottom: theme.spacing.sm,
            paddingTop: period === 'daily' ? 0 : theme.spacing.xs,
          }}
        >
          <SegmentedControl
            options={FILTER_TYPES.map((type) => ({
              value: type,
              label:
                type === 'ALL'
                  ? t('common.all', 'All')
                  : t(`transactions.type.${type.toLowerCase()}`, { defaultValue: type.charAt(0).toUpperCase() + type.slice(1).toLowerCase() }),
              // Not `btn-transaction-type-*`: the add sheet's type picker owns that id and opens over this screen.
              testID: `btn-transaction-filter-${type}`,
            }))}
            value={filterType}
            onChange={setFilterType}
          />
        </View>

        <SlideSwap swapKey={dateFrom} style={{ flex: 1 }}>
          {renderContent()}
        </SlideSwap>

        {showFab ? (
          <Fab
            testID="btn-add-transaction"
            bottomOffset={fabBottomOffset}
            onPress={onAddTransaction}
          />
        ) : null}

          </>
        )}
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
          onEdit={handleEditTransaction}
        />
        <DeleteTransactionDialog
          transaction={deletingTransaction}
          onCancel={() => setDeletingTransaction(null)}
          onDeleted={() => setDeletingTransaction(null)}
          onError={(message) => {
            setDeletingTransaction(null);
            showToast(message, 'error');
          }}
        />
      </WalletContextBar>
    </AnimatedScreen>
  );
}


