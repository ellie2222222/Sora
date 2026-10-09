import { useCallback, useMemo, useState } from 'react';
import { Plus, Receipt } from 'lucide-react-native';
import { View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
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
  StateView,
  Text,
  TransactionDayCard,
  useSwapOffset,
} from '@/components';
import { useAuth, useModal, useTheme, useToast, useWallets } from '@/app/providers';
import { useListTransactionsInfiniteQuery } from '@/app/store';
import { AccountScopePicker } from '@/features/accounts';
import { NoWalletState, WalletContextBar } from '@/features/wallets';
import { useWarmAddTransactionReads } from '../hooks/useWarmAddTransactionReads.ts';
import { CategoryFilterChip } from './CategoryFilterChip.tsx';
import { DeleteTransactionDialog } from './DeleteTransactionDialog.tsx';
import { TransactionDetailModal } from './TransactionDetailModal';
import { PeriodSummarySkeleton, TransactionDaysSkeleton, TransactionListSkeleton } from './TransactionListSkeleton';
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

/** The summary, the sticky filters, then the days; a window with none shows its state in the footer. */
type ListRow = 'summary' | 'filter' | DaySection;

const FILTER_TYPES = ['ALL', TransactionType.INCOME, TransactionType.EXPENSE, TransactionType.TRANSFER] as const;

const FILTER_LABEL_KEY = {
  ALL: 'transactions.filterAll',
  [TransactionType.INCOME]: 'transactions.filterIncome',
  [TransactionType.EXPENSE]: 'transactions.filterExpense',
  [TransactionType.TRANSFER]: 'transactions.filterTransfer',
} as const;

/** The list is always one period's window, so an empty list says nothing about the wallet's other periods. */
const EMPTY_TITLE_KEY = {
  ALL: 'home.noTransactionsTitle',
  [TransactionType.INCOME]: 'home.noIncomeTitle',
  [TransactionType.EXPENSE]: 'home.noExpensesTitle',
  [TransactionType.TRANSFER]: 'home.noTransfersTitle',
} as const;

/** The Home tab's transaction list, the wallet's whole history unless an account, category or type narrows it. */
export function TransactionListScreen({
  accountId,
  accountFilter,
  categoryId,
  onClearCategory,
  onAddTransaction,
  fabBottomOffset,
  testIDPrefix,
}: {
  accountId?: string;
  /** Shows account chips above the type filter; the caller owns the choice and passes it back as `accountId`. */
  accountFilter?: { selectedAccountId: string | null; onSelect: (accountId: string | null) => void };
  categoryId?: string;
  /** Shows the category as a chip that drops the filter; without it a category filter is fixed. */
  onClearCategory?: () => void;
  onAddTransaction: () => void;
  fabBottomOffset: number;
  testIDPrefix: string;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { isGuest } = useAuth();
  const { activeWalletId, isLoading: walletsLoading, permissions, timeZone } = useWallets();
  const { openModal } = useModal();
  const { showToast } = useToast();

  const [period, setPeriod] = useState<DashboardPeriod>('monthly');
  const [selectedDay, setSelectedDay] = useState<CalendarDay>(() => today(timeZone));
  const walletToday = today(timeZone);
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
  // `currentData`, not `data`: RTK keeps the previous arguments' result in `data` while new ones
  // load, so only `currentData` tells this window's rows apart from "not answered yet".
  const loadedItems = useMemo(
    // Deleted transactions stay in the ledger (BR-03) but a deleted entry
    // reads as noise here, not history — it's excluded from every derived
    // figure server-side already, so the list should match.
    () => (transactions.currentData ? flattenPages(transactions.currentData.pages).filter((item) => item.status !== TransactionStatus.DELETED) : null),
    [transactions.currentData],
  );
  const [kept, setKept] = useState<{ scopeKey: string; items: TransactionResponse[] }>({ scopeKey, items: [] });
  if (loadedItems !== null && (kept.items !== loadedItems || kept.scopeKey !== scopeKey)) {
    setKept({ scopeKey, items: loadedItems });
  }
  const awaitingWindow = loadedItems === null;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Back to page one: a refresh re-reads the newest rows, not every page scrolled through.
      await transactions.refetch({ refetchCachedPages: false });
    } finally {
      setIsRefreshing(false);
    }
  };

  const items = loadedItems ?? (kept.scopeKey === scopeKey ? kept.items : []);

  const showFab = !transactions.isLoading && items.length > 0;

  // A total summed from part of a window is wrong, not merely partial, so it is
  // withheld until every page is loaded. Counted before the DELETED filter, since
  // the server's total counts those rows too.
  const hasMorePages = transactions.hasNextPage;
  const fetchedCount = useMemo(() => flattenPages(transactions.data?.pages).length, [transactions.data]);
  const windowTotal = totalOf(transactions.data?.pages) ?? fetchedCount;

  // The last loaded day may continue on the next page, so its heading total waits too.
  const sections = useMemo<DaySection[]>(() => {
    const groups = groupTransactionsByDay(items, timeZone);
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
  }, [items, hasMorePages, period, timeZone]);

  const handlePressTransaction = useCallback((transaction: TransactionResponse) => setSelectedTransaction(transaction), []);
  const handleEditTransaction = useCallback(
    (transaction: TransactionResponse) => openModal('EditTransaction', { transactionId: transaction.id }),
    [openModal],
  );
  // The detail sheet closes as Edit opens, so Back opens it again on the same transaction.
  const handleEditFromDetail = (transaction: TransactionResponse) =>
    openModal('EditTransaction', { transactionId: transaction.id, parent: { onBack: () => setSelectedTransaction(transaction) } });
  const handleDeleteTransaction = useCallback((transaction: TransactionResponse) => setDeletingTransaction(transaction), []);
  const handleEndReached = () => {
    if (canLoadMore(transactions)) void transactions.fetchNextPage();
  };

  const periodOffset = useSwapOffset(dateFrom);
  const filterOffset = useSwapOffset(FILTER_TYPES.indexOf(filterType));
  // The filter sits in the list but must not slide with the rows, so each row piece applies the offset itself.
  const bodySlide = useAnimatedStyle(() => ({ transform: [{ translateX: periodOffset.value + filterOffset.value }] }));

  // The filter is a row, not part of a list header, so the list can pin it while the summary scrolls away.
  const rows = useMemo<ListRow[]>(() => ['summary', 'filter', ...sections], [sections]);
  const windowEmpty = sections.length === 0;

  const periodBar = (
    <View style={{ paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.xs, paddingBottom: theme.spacing.sm }}>
      <PeriodBar
        period={period}
        anchor={selectedDay}
        onChangePeriod={setPeriod}
        onShift={(delta) => setSelectedDay((current) => shiftAnchor(period, current, delta))}
        onOpenPicker={() => setShowDatePicker(true)}
        testIDPrefix={testIDPrefix}
        today={walletToday}
      />
    </View>
  );

  const summary = (
    <View>
      <View style={{ paddingHorizontal: theme.spacing.md }}>
        {hasMorePages ? (
          <View className="flex-row justify-end">
            <Text variant="caption" tone="muted" testID={`${testIDPrefix}-period-truncated`}>
              {t('transactions.showingNewest', { count: fetchedCount, total: windowTotal })}
            </Text>
          </View>
        ) : awaitingWindow && items.length === 0 ? (
          <PeriodSummarySkeleton />
        ) : (
          <PeriodSummaryCard transactions={items} filterType={filterType} testID={`${testIDPrefix}-period-summary`} />
        )}
      </View>

      {/* Only meaningful while a day *is* the window — in any wider one it would
          pick a day the list does not narrow to. */}
      {period === 'daily' ? (
        <View style={{ paddingHorizontal: theme.spacing.sm, paddingTop: theme.spacing.sm }}>
          <DateStrip selectedDay={selectedDay} onSelectDay={setSelectedDay} today={walletToday} testID={`${testIDPrefix}-date-strip`} />
        </View>
      ) : null}
    </View>
  );

  const filterBar = (
    <View style={{ paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, gap: theme.spacing.sm, backgroundColor: theme.colors.background }}>
      {accountFilter !== undefined && walletId !== undefined ? (
        <AccountScopePicker
          walletId={walletId}
          selectedAccountId={accountFilter.selectedAccountId}
          onSelect={accountFilter.onSelect}
          testID={`picker-${testIDPrefix}-account`}
        />
      ) : null}
      {categoryId !== undefined && onClearCategory !== undefined && walletId !== undefined ? (
        <CategoryFilterChip walletId={walletId} categoryId={categoryId} onClear={onClearCategory} testID={`btn-clear-${testIDPrefix}-category`} />
      ) : null}
      <SegmentedControl
        options={FILTER_TYPES.map((type) => ({
          value: type,
          label: t(FILTER_LABEL_KEY[type]),
          // Not `btn-transaction-type-*`: the add sheet's type picker owns that id and opens over this screen.
          testID: `btn-transaction-filter-${type}`,
        }))}
        value={filterType}
        onChange={setFilterType}
      />
    </View>
  );

  const renderEmptyBody = () => {
    if (transactions.isError && !isNetworkError(transactions.error)) {
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
    if (awaitingWindow && !transactions.isError) {
      return (
        <View style={{ paddingHorizontal: theme.spacing.md }}>
          <TransactionDaysSkeleton />
        </View>
      );
    }

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
  };

  const renderDay = (section: DaySection) => (
    <Animated.View style={[{ paddingHorizontal: theme.spacing.md }, bodySlide]}>
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
        today={walletToday}
      />
    </Animated.View>
  );

  return (
    <AnimatedScreen testID={`screen-${testIDPrefix}`}>
      <WalletContextBar>
        {periodBar}
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
            <RefreshableFlatList<ListRow>
              testID="list-transactions"
              data={rows}
              keyExtractor={(row) => (typeof row === 'string' ? row : row.day)}
              stickyHeaderIndices={[rows.indexOf('filter')]}
              renderItem={({ item: row }) =>
                row === 'summary' ? (
                  summary
                ) : row === 'filter' ? (
                  filterBar
                ) : (
                  renderDay(row)
                )
              }
              ListFooterComponent={
                windowEmpty ? (
                  // Keyed per pane, as SlideSwap keys its subtree, so two StateViews never share state.
                  <Animated.View key={`${dateFrom}|${filterType}`} style={bodySlide}>
                    {renderEmptyBody()}
                  </Animated.View>
                ) : items.length > 0 ? (
                  <Animated.View style={[{ paddingHorizontal: theme.spacing.md }, bodySlide]}>
                    <ListLoadMoreFooter
                      isFetchingNextPage={transactions.isFetchingNextPage}
                      hasNextPage={hasMorePages}
                      isError={transactions.isError}
                      onRetry={() => void transactions.fetchNextPage()}
                      testID={`${testIDPrefix}-list-footer`}
                    />
                  </Animated.View>
                ) : null
              }
              onScrollBeginDrag={closeOpenSwipeRow}
              onEndReached={handleEndReached}
              onEndReachedThreshold={0.5}
              // The footer is the only part that can grow, so an empty or error state centres in the space below the filters.
              ListFooterComponentStyle={
                windowEmpty ? { flexGrow: 1, justifyContent: awaitingWindow && !transactions.isError ? 'flex-start' : 'center' } : undefined
              }
              contentContainerStyle={{ flexGrow: 1, paddingBottom: items.length > 0 ? fabListPaddingBottom(theme, fabBottomOffset) : 0 }}
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
            />

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
          today={walletToday}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
          onClose={() => setShowDatePicker(false)}
        />

        <TransactionDetailModal
          visible={Boolean(selectedTransaction)}
          transaction={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
          onEdit={handleEditFromDetail}
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
