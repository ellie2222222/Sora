import { useEffect, useRef, useState } from 'react';
import { Plus, Receipt } from 'lucide-react-native';
import { View } from 'react-native';
import Animated, { FadeOut, SlideInLeft, SlideInRight } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { TransactionStatus, type TransactionResponse } from '@sora/contracts';

import { AnimatedScreen, DatePickerModal, DateStrip, Fab, MonthSelector, RefreshableScrollView, SkeletonList, StateView, TransactionListSection, TransactionTotals } from '@/components';
import { useAuth, useTheme, useWallets } from '@/app/providers';
import { useListTransactionsQuery } from '@/app/store';
import { WalletContextBar } from '@/features/wallets';
import { TransactionDetailModal } from './TransactionDetailModal';
import { addMonths, endOfMonth, formatDay, groupTransactionsByDay, isNetworkError, startOfMonth, today } from '../../../utils';

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

  // Read by the content wrapper's `entering` animation on the render this
  // triggers — set before `setSelectedDay` so that render sees the direction
  // for the day being navigated *to*, not the previous one.
  const slideDirectionRef = useRef<'forward' | 'backward'>('forward');
  const changeDay = (day: string) => {
    slideDirectionRef.current = day >= selectedDay ? 'forward' : 'backward';
    setSelectedDay(day);
  };

  const walletId = activeWalletId ?? undefined;
  const dateFrom = startOfMonth(selectedDay);
  const dateTo = endOfMonth(selectedDay);

  const transactions = useListTransactionsQuery(
    { walletId, accountId, categoryId, dateFrom, dateTo, pageSize: 100 },
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
        <View
          className="flex-row justify-between items-center"
          style={{
            paddingHorizontal: theme.spacing.md,
            paddingTop: theme.spacing.xs,
          }}
        >
          <MonthSelector
            label={formatDay(selectedDay)}
            onPrev={() => changeDay(addMonths(selectedDay, -1))}
            onNext={() => changeDay(addMonths(selectedDay, 1))}
            onOpenPicker={() => setShowDatePicker(true)}
            testID={`${testIDPrefix}-month-selector`}
          />
          <TransactionTotals transactions={items} testID={`${testIDPrefix}-month-totals`} />
        </View>

        <View style={{ paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.xs }}>
          <DateStrip selectedDay={selectedDay} onSelectDay={changeDay} testID={`${testIDPrefix}-date-strip`} />
        </View>

        <Animated.View
          key={selectedDay}
          style={{ flex: 1 }}
          // Overdamped (damping/stiffness ratio > 1, no fixed duration) so a full-width panel
          // settles into place without overshoot/bounce-back — DateStrip's own cell transition
          // stays springier since that's a small highlight move, not a whole screen of content.
          entering={(slideDirectionRef.current === 'forward' ? SlideInRight : SlideInLeft)
            .springify()
            .damping(34)
            .stiffness(210)}
          exiting={FadeOut.duration(150)}
        >
          {renderContent()}
        </Animated.View>

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
          onSelectDay={changeDay}
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
