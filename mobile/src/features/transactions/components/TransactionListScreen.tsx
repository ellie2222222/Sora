import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Receipt } from 'lucide-react-native';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { TransactionStatus, TransactionType, type TransactionResponse } from '@sora/contracts';

import {
  AnimatedScreen,
  DatePickerModal,
  DateStrip,
  Fab,
  ListLoadMoreFooter,
  PeriodBar,
  PeriodSummaryCard,
  RefreshableSectionList,
  SkeletonList,
  SlideSwap,
  StateView,
  Text,
  TransactionDayHeader,
  TransactionListItem,
  TransactionItemSkeleton,
} from '@/components';
import { useAuth, useModal, useTheme, useWallets } from '@/app/providers';
import { useListTransactionsInfiniteQuery } from '@/app/store';
import { NoWalletState, WalletContextBar } from '@/features/wallets';
import { TransactionDetailModal } from './TransactionDetailModal';
import { TransactionListSkeleton } from './TransactionListSkeleton';
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
  type CalendarDay,
  type DashboardPeriod,
} from '@/utils';

interface DaySection {
  day: CalendarDay;
  isFirst: boolean;
  showTotals: boolean;
  data: TransactionResponse[];
  isNewMonth: boolean;
}

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
  const { activeWalletId, isLoading: walletsLoading } = useWallets();
  const { openModal } = useModal();

  const [period, setPeriod] = useState<DashboardPeriod>('monthly');
  const [selectedDay, setSelectedDay] = useState<CalendarDay>(today());
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionResponse | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filterType, setFilterType] = useState<'ALL' | TransactionType>('ALL');

  const walletId = activeWalletId ?? undefined;
  // One source for the window, so the day strip and the query cannot disagree.
  const { dateFrom, dateTo } = windowFor(period, selectedDay);

  const transactions = useListTransactionsInfiniteQuery(
    { walletId, accountId, categoryId, dateFrom, dateTo },
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

  const items = useMemo(() => {
    if (scopeKey !== displayedScopeKey) return [];
    if (filterType === 'ALL') return displayedItems;
    return displayedItems.filter((item) => item.type === filterType);
  }, [scopeKey, displayedScopeKey, displayedItems, filterType]);

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
    return groups.map((group, index) => {
      const currentMonth = parseDay(group.day).month;
      const prevMonth = index > 0 ? parseDay(groups[index - 1]?.day ?? '').month : null;
      const isNewMonth = (period === 'yearly' || period === 'quarterly') && currentMonth !== prevMonth;

      return {
        day: group.day,
        isFirst: index === 0,
        showTotals: !(hasMorePages && index === groups.length - 1),
        data: group.transactions,
        isNewMonth,
      };
    });
  }, [items, hasMorePages, period]);

  const handlePressTransaction = useCallback((transaction: TransactionResponse) => setSelectedTransaction(transaction), []);
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

    return (
      <RefreshableSectionList<TransactionResponse, DaySection>
        testID="list-transactions"
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <View>
            {section.isNewMonth ? (
              <Text
                variant="title"
                weight="bold"
                style={{
                  marginTop: section.isFirst ? 0 : theme.spacing.lg,
                  marginBottom: theme.spacing.sm,
                  marginLeft: theme.spacing.xxs,
                }}
              >
                {formatMonthYear(section.day)}
              </Text>
            ) : null}
            <TransactionDayHeader
              day={section.day}
              transactions={section.data}
              isFirst={section.isFirst || section.isNewMonth}
              showTotals={section.showTotals}
            />
          </View>
        )}
        renderItem={({ item }) => <TransactionListItem transaction={item} onPress={handlePressTransaction} />}
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
          // 88 clears the Fab's own footprint (48 size + spacing.md margin) plus breathing room.
          paddingBottom: fabBottomOffset + 88,
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
          <View
            className="flex-row p-[3px] border"
            style={{
              backgroundColor: theme.colors.surfaceMuted,
              borderRadius: theme.radius.md,
              borderColor: theme.colors.border,
            }}
          >
            {(['ALL', TransactionType.INCOME, TransactionType.EXPENSE, TransactionType.TRANSFER] as const).map((type) => (
              <Pressable
                key={type}
                onPress={() => setFilterType(type)}
                accessibilityRole="tab"
                accessibilityState={{ selected: filterType === type }}
                className="flex-1 py-sm items-center justify-center"
                style={[
                  {
                    borderRadius: theme.radius.sm,
                    backgroundColor: filterType === type ? theme.colors.surface : 'transparent',
                  },
                  filterType === type
                    ? Platform.select({
                        web: { boxShadow: '0px 1px 2px rgba(0,0,0,0.08)' },
                        default: {
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: 0.08,
                          shadowRadius: 2,
                          elevation: 1,
                        },
                      })
                    : undefined,
                ]}
              >
                <Text
                  weight={filterType === type ? 'bold' : 'medium'}
                  tone={filterType === type ? undefined : 'muted'}
                  style={{ fontSize: 13 }}
                >
                  {type === 'ALL'
                    ? t('common.all', 'All')
                    : t(`transactions.type.${type.toLowerCase()}`, { defaultValue: type.charAt(0).toUpperCase() + type.slice(1).toLowerCase() })}
                </Text>
              </Pressable>
            ))}
          </View>
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
          onEdit={(t) => openModal('EditTransaction', { transactionId: t.id })}
        />
      </WalletContextBar>
    </AnimatedScreen>
  );
}


