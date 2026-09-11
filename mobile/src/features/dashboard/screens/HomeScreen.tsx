import { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Wallet as WalletIcon } from 'lucide-react-native';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { add, isNegative, negate, parseMoney, percentageOf, ZERO } from '@sora/contracts';
import type { CategorySpendSlice, CurrencyTotal } from '@sora/contracts';

import {
  Card,
  EmptyState,
  ErrorState,
  Money,
  MonthSelector,
  ProgressBar,
  Text,
  TransactionListSection,
} from '../../../components/index.ts';
import { SkeletonList } from '../../../components/Skeleton.tsx';
import { useTheme } from '../../../app/providers/ThemeProvider.tsx';
import { useWallets } from '../../../app/providers/WalletProvider.tsx';
import { WalletSwitcher } from '../../wallets/components/WalletSwitcher.tsx';
import { useGetDashboardSummaryQuery } from '../../../app/store/api/dashboardApi.ts';
import { useListBudgetsQuery } from '../../../app/store/api/budgetsApi.ts';
import { groupTransactionsByDay } from '../../../utils/groupByDate.ts';
import { addMonths, endOfMonth, formatMonthYear, startOfMonth, today } from '../../../utils/date.ts';
import type { MainTabScreenProps } from '../../../app/navigation/types.ts';

export function HomeScreen({ navigation }: MainTabScreenProps<'Home'>) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { activeWalletId, isLoading: walletsLoading, isError: walletsError, refetch: refetchWallets } = useWallets();

  const [selectedMonth, setSelectedMonth] = useState(() => startOfMonth(today()));
  const isCurrentMonth = selectedMonth === startOfMonth(today());
  const previousMonth = addMonths(selectedMonth, -1);

  const dashboard = useGetDashboardSummaryQuery(
    { walletId: activeWalletId ?? '', dateFrom: startOfMonth(selectedMonth), dateTo: endOfMonth(selectedMonth) },
    { skip: activeWalletId === null },
  );
  // Only feeds the MoM badges below — its own loading/error states are ignored
  // (a badge simply doesn't render) rather than blocking the whole screen on it.
  const previousDashboard = useGetDashboardSummaryQuery(
    { walletId: activeWalletId ?? '', dateFrom: startOfMonth(previousMonth), dateTo: endOfMonth(previousMonth) },
    { skip: activeWalletId === null },
  );
  const budgets = useListBudgetsQuery(
    { walletId: activeWalletId ?? '', status: 'ACTIVE', activeOn: today() },
    { skip: activeWalletId === null },
  );

  if (walletsLoading) return <SkeletonList rows={5} />;
  if (walletsError) return <ErrorState error={new Error('Could not load your wallets')} onRetry={refetchWallets} />;

  if (activeWalletId === null) {
    return (
      <EmptyState
        icon={WalletIcon}
        title={t('home.noWalletTitle')}
        description={t('home.noWalletDescription')}
        testID="home-empty"
      />
    );
  }

  if (dashboard.isLoading) return <SkeletonList rows={6} />;
  if (dashboard.isError) {
    return <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} testID="home-error" />;
  }

  const data = dashboard.data;
  if (data === undefined) return null;

  const topBudgets = [...(budgets.data ?? [])]
    .sort((a, b) => b.usagePercentage - a.usagePercentage)
    .slice(0, 3);
  const recentGroups = groupTransactionsByDay(data.recentTransactions);

  return (
    <ScrollView
      testID="home-screen"
      contentContainerStyle={{ padding: theme.spacing.md, gap: theme.spacing.md }}
      refreshControl={<RefreshControl refreshing={dashboard.isFetching} onRefresh={() => void dashboard.refetch()} />}
    >
      <WalletSwitcher onManage={() => navigation.getParent()?.navigate('WalletList')} />

      <MonthSelector
        testID="home-month-selector"
        label={formatMonthYear(selectedMonth)}
        onPrev={() => setSelectedMonth((month) => addMonths(month, -1))}
        onNext={() => setSelectedMonth((month) => addMonths(month, 1))}
        disableNext={isCurrentMonth}
      />

      <Card elevated>
        <Text variant="label" tone="muted">
          {t('home.totalBalance')}
        </Text>
        <BalanceTotals totals={data.totalBalance} />
      </Card>

      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        <Card style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
            <ArrowDownLeft size={16} color={theme.colors.income} />
            <Text variant="label" tone="muted">
              {t('home.income')}
            </Text>
          </View>
          <BalanceTotals totals={data.income} variant="body" />
          <MoMBadge current={data.income} previous={previousDashboard.data?.income} />
        </Card>
        <Card style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
            <ArrowUpRight size={16} color={theme.colors.expense} />
            <Text variant="label" tone="muted">
              {t('home.expenses')}
            </Text>
          </View>
          <BalanceTotals totals={data.expense} variant="body" />
          <MoMBadge current={data.expense} previous={previousDashboard.data?.expense} />
        </Card>
      </View>

      {topBudgets.length > 0 ? (
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: theme.spacing.sm }}>
            <Text variant="label" tone="muted">
              Budgets
            </Text>
            <Text
              variant="label"
              tone="muted"
              onPress={() => navigation.getParent()?.navigate('Budgets')}
              testID="home-view-all-budgets"
            >
              {t('home.viewAll')}
            </Text>
          </View>
          <View style={{ gap: theme.spacing.sm }}>
            {topBudgets.map((budget) => (
              <View key={budget.id}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text numberOfLines={1} style={{ flex: 1 }}>
                    {budget.name}
                  </Text>
                  <Text variant="caption" tone={budget.isOverBudget ? 'danger' : 'muted'}>
                    {budget.usagePercentage.toFixed(0)}%
                  </Text>
                </View>
                <ProgressBar percentage={budget.usagePercentage} danger={budget.isOverBudget} />
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      {data.spendingByCategory.length > 0 ? (
        <Card>
          <Text variant="label" tone="muted" style={{ marginBottom: theme.spacing.sm }}>
            {t('home.spendingByCategory')}
          </Text>
          {data.spendingByCategory.map((slice) => (
            <SpendingRow key={slice.categoryId} slice={slice} />
          ))}
        </Card>
      ) : null}

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: theme.spacing.sm }}>
          <Text variant="label" tone="muted">
            {t('home.recentTransactions')}
          </Text>
          <Text
            variant="label"
            tone="muted"
            onPress={() => navigation.getParent()?.navigate('Transactions')}
            testID="home-view-all-transactions"
          >
            {t('home.viewAll')}
          </Text>
        </View>
        {data.recentTransactions.length === 0 ? (
          <Text tone="faint">{t('home.noTransactionsYet')}</Text>
        ) : (
          <TransactionListSection groups={recentGroups} />
        )}
      </Card>
    </ScrollView>
  );
}

function BalanceTotals({ totals, variant = 'heading' }: { totals: CurrencyTotal[]; variant?: 'heading' | 'body' }) {
  if (totals.length === 0) return <Text tone="faint">—</Text>;
  return (
    <>
      {totals.map((total) => (
        <Money key={total.currency} amount={total.amount} currency={total.currency} variant={variant} />
      ))}
    </>
  );
}

/**
 * Month-over-month delta for one figure. Compares only the first (alphabetically
 * lowest, per `CurrencyLedger.currencies()`) currency a wallet holds — not a
 * "dominant" one, the domain has no such concept — so a multi-currency wallet's
 * badge is a partial signal, not the whole picture.
 */
function MoMBadge({ current, previous }: { current: CurrencyTotal[]; previous: CurrencyTotal[] | undefined }) {
  const currency = current[0]?.currency;
  if (currency === undefined || previous === undefined) return null;

  const previousTotal = previous.find((total) => total.currency === currency);
  if (previousTotal === undefined) return null;

  const currentAmount = parseMoney(current[0]?.amount ?? '0');
  const previousAmount = parseMoney(previousTotal.amount);
  if (previousAmount === ZERO) return null;

  const denominator = isNegative(previousAmount) ? negate(previousAmount) : previousAmount;
  const change = percentageOf(add(currentAmount, negate(previousAmount)), denominator, 0);
  if (change === 0) return null;

  return (
    <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
      {change > 0 ? '▲' : '▼'} {Math.abs(change)}% vs last month
    </Text>
  );
}

function SpendingRow({ slice }: { slice: CategorySpendSlice }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: theme.spacing.xs,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: slice.color ?? theme.colors.primary,
          }}
        />
        <Text>{slice.categoryName}</Text>
      </View>
      <Text tone="muted">{slice.percentage.toFixed(0)}%</Text>
    </View>
  );
}
