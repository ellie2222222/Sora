import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { maxOf, parseMoney, percentageOf, ZERO } from '@sora/contracts';
import type { DashboardResponse } from '@sora/contracts';

import { AnimatedScreen, PeriodBar, RefreshableScrollView, SkeletonList, StateView, Text, TrendBarChart } from '@/components';
import { Plus, Wallet as WalletIcon } from 'lucide-react-native';
import { useModal, useTheme, useWallets } from '@/app/providers';
import { WalletContextBar } from '@/features/wallets';
import { dashboardApiSlice, useGetDashboardSummaryQuery, useListCategoriesQuery } from '@/app/store';
import {
  changeAgainst,
  emptyReasonFor,
  formatPeriodLabel,
  isNetworkError,
  monthName,
  parseDay,
  previousWindow,
  shiftAnchor,
  today,
  windowFor,
  type CalendarDay,
  type DashboardEmptyReason,
  type DashboardPeriod,
} from '@/utils';
import type { MainTabScreenProps } from '@/app/navigation';
import { BudgetGoalSummary } from '../components/BudgetGoalSummary.tsx';
import { CashFlowCard } from '../components/CashFlowCard.tsx';
import { CategoryBreakdown } from '../components/CategoryBreakdown.tsx';
import { DashboardEmpty } from '../components/DashboardEmpty.tsx';
import { DashboardKpis } from '../components/DashboardKpis.tsx';
import { MemberSplit } from '../components/MemberSplit.tsx';

export function DashboardScreen({ navigation }: MainTabScreenProps<'Dashboard'>) {
  const theme = useTheme();
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { activeWalletId, isLoading: walletsLoading } = useWallets();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const onManage = () => navigation.getParent()?.navigate('WalletList');

  const [period, setPeriod] = useState<DashboardPeriod>('monthly');
  const [anchor, setAnchor] = useState<CalendarDay>(() => today());
  const shiftPeriod = (delta: number) => setAnchor((current) => shiftAnchor(period, current, delta));

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      dispatch(dashboardApiSlice.util.invalidateTags(['Dashboard']));
      await new Promise((resolve) => setTimeout(resolve, 500));
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <AnimatedScreen>
      <WalletContextBar onManage={onManage}>
        <RefreshableScrollView
          testID="dashboard-screen"
          // flexGrow lets an empty state centre itself in the leftover height; with
          // real content to scroll it has no effect.
          contentContainerStyle={{ flexGrow: 1, padding: theme.spacing.md, gap: theme.spacing.lg }}
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
        >
          <PeriodBar
            period={period}
            anchor={anchor}
            onChangePeriod={setPeriod}
            onShift={shiftPeriod}
          />

          {walletsLoading ? (
            <SkeletonList rows={5} />
          ) : activeWalletId === null ? (
            <StateView
              variant="empty"
              icon={WalletIcon}
              title={t('dashboard.noWalletYet')}
              message={t('dashboard.createWalletToSee')}
              primaryAction={{ label: t('wallets.newWallet'), onPress: onManage, icon: Plus }}
              testID="dashboard-empty"
            />
          ) : period === 'yearly' ? (
            <YearlyReport
              walletId={activeWalletId}
              year={parseDay(anchor).year}
              periodLabel={formatPeriodLabel(period, anchor)}
              navigation={navigation}
              onPreviousPeriod={() => shiftPeriod(-1)}
            />
          ) : (
            <PeriodReport
              walletId={activeWalletId}
              period={period}
              anchor={anchor}
              navigation={navigation}
              onPreviousPeriod={() => shiftPeriod(-1)}
            />
          )}
        </RefreshableScrollView>
      </WalletContextBar>
    </AnimatedScreen>
  );
}

type DashboardNavigation = MainTabScreenProps<'Dashboard'>['navigation'];

/** `DashboardEmpty` with the wallet-scoped bits — role gating and the create modals — filled in. */
function DashboardEmptyForWallet({
  reason,
  walletId,
  periodLabel,
  onPreviousPeriod,
}: {
  reason: DashboardEmptyReason;
  walletId: string;
  periodLabel: string;
  onPreviousPeriod: () => void;
}) {
  const { openModal } = useModal();
  const { permissions } = useWallets();

  return (
    <DashboardEmpty
      reason={reason}
      periodLabel={periodLabel}
      canWrite={permissions.canWrite}
      onAddAccount={() => openModal('AddAccount', { walletId })}
      onAddTransaction={() => openModal('AddTransaction')}
      onPreviousPeriod={onPreviousPeriod}
    />
  );
}

/**
 * One window's figures, plus the window before it for the change indicators —
 * the same two-query shape the month-over-month insights already used, now
 * driven by whichever granularity is selected.
 */
function PeriodReport({
  walletId,
  period,
  anchor,
  navigation,
  onPreviousPeriod,
}: {
  walletId: string;
  period: DashboardPeriod;
  anchor: CalendarDay;
  navigation: DashboardNavigation;
  onPreviousPeriod: () => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();

  const current = useGetDashboardSummaryQuery({ walletId, ...windowFor(period, anchor) });
  const previous = useGetDashboardSummaryQuery({ walletId, ...previousWindow(period, anchor) });
  const categories = useListCategoriesQuery({ walletId });

  if (current.isLoading) return <SkeletonList rows={5} />;
  if (current.isError && !isNetworkError(current.error)) {
    return (
      <StateView
        variant="error"
        error={current.error}
        retryAction={() => void current.refetch()}
        testID="dashboard-period-error"
      />
    );
  }

  const data = current.data;
  if (data === undefined) {
    return <StateView variant="error" error={new Error(t('dashboard.noData', 'No dashboard data available.'))} />;
  }

  const emptyReason = emptyReasonFor(data);
  if (emptyReason !== null) {
    return (
      <View style={{ flex: 1, gap: theme.spacing.lg }}>
        <DashboardEmptyForWallet
          reason={emptyReason}
          walletId={walletId}
          periodLabel={formatPeriodLabel(period, anchor)}
          onPreviousPeriod={onPreviousPeriod}
        />
        {/* An active budget or goal is worth seeing even in a window that recorded nothing against it. */}
        <BudgetGoalSummary
          budgets={data.activeBudgets}
          goals={data.activeGoals}
          onOpenBudget={(budgetId) => navigation.getParent()?.navigate('BudgetDetail', { budgetId })}
          onOpenGoal={(goalId) => navigation.getParent()?.navigate('GoalDetail', { goalId })}
        />
      </View>
    );
  }

  const income = data.income[0];
  const net = data.net[0];
  const savingsRate =
    income !== undefined && net !== undefined
      ? percentageOf(parseMoney(net.amount), parseMoney(income.amount), 0)
      : null;

  const categoryNames = new Map((categories.data ?? []).map((category) => [category.id, category.name]));

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <DashboardKpis
        income={data.income}
        expense={data.expense}
        net={data.net}
        transferredIn={data.transferredIn}
        transferredOut={data.transferredOut}
        savingsRate={savingsRate}
      />

      <CashFlowCard
        income={data.income}
        expense={data.expense}
        transferredIn={data.transferredIn}
        transferredOut={data.transferredOut}
      />

      <CategoryBreakdown
        slices={data.spendingByCategory}
        previousSlices={previous.data?.spendingByCategory ?? []}
        expenseTotal={data.expense[0]}
        categoryNames={categoryNames}
        onSelectCategory={(categoryId) =>
          navigation.getParent()?.navigate('Transactions', { categoryId })
        }
      />

      <MemberSplit members={data.spendingByMember} />

      <BudgetGoalSummary
        budgets={data.activeBudgets}
        goals={data.activeGoals}
        onOpenBudget={(budgetId) => navigation.getParent()?.navigate('BudgetDetail', { budgetId })}
        onOpenGoal={(goalId) => navigation.getParent()?.navigate('GoalDetail', { goalId })}
      />

      <PeriodInsights data={data} previousData={previous.data} savingsRate={savingsRate} periodLabel={formatPeriodLabel(period, anchor)} />
    </View>
  );
}

/**
 * The year as twelve monthly windows.
 *
 * Kept as its own path rather than folded into `PeriodReport`: a year is the
 * one period the screen shows as a *trend across* its sub-periods, which needs
 * twelve queries instead of two.
 */
function YearlyReport({
  walletId,
  year,
  periodLabel,
  navigation,
  onPreviousPeriod,
}: {
  walletId: string;
  year: number;
  periodLabel: string;
  navigation: DashboardNavigation;
  onPreviousPeriod: () => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const months = monthsOfYear(year);
  const [byMonth, setByMonth] = useState<Record<CalendarDay, DashboardResponse | undefined>>({});
  const [settled, setSettled] = useState<Record<CalendarDay, boolean>>({});

  const handleMonthSettled = useCallback((month: CalendarDay, data: DashboardResponse | undefined) => {
    setByMonth((current) => (current[month] === data ? current : { ...current, [month]: data }));
    setSettled((current) => (current[month] === true ? current : { ...current, [month]: true }));
  }, []);

  const settledCount = months.filter((month) => settled[month] === true).length;
  if (settledCount < months.length) {
    return (
      <>
        {months.map((month) => (
          <MonthDataPoint key={month} walletId={walletId} month={month} onSettled={handleMonthSettled} />
        ))}
        <SkeletonList rows={5} />
      </>
    );
  }

  // Every month agrees on the all-time figures the reason is derived from, so
  // the first that loaded answers for the year.
  const anyMonth = months.map((month) => byMonth[month]).find((response) => response !== undefined);
  const emptyReason = anyMonth === undefined ? 'no-accounts' : emptyReasonFor(yearOf(months, byMonth, anyMonth));
  if (emptyReason !== null) {
    return (
      <>
        {months.map((month) => (
          <MonthDataPoint key={month} walletId={walletId} month={month} onSettled={handleMonthSettled} />
        ))}
        <DashboardEmptyForWallet
          reason={emptyReason}
          walletId={walletId}
          periodLabel={periodLabel}
          onPreviousPeriod={onPreviousPeriod}
        />
      </>
    );
  }

  const monthlyIncome = months.map((month) => parseMoney(byMonth[month]?.income[0]?.amount ?? '0'));
  const monthlyExpense = months.map((month) => parseMoney(byMonth[month]?.expense[0]?.amount ?? '0'));
  // TrendBarChart only needs each bar's height relative to the year's peak, so
  // that ratio is computed in bigint space (percentageOf) rather than ever
  // widening a Scaled amount into a JS number.
  const yearMax = [...monthlyIncome, ...monthlyExpense].reduce((max, amount) => maxOf(max, amount), ZERO);
  const points = months.map((month, index) => ({
    label: monthName(parseDay(month).month),
    income: percentageOf(monthlyIncome[index] ?? ZERO, yearMax),
    expense: percentageOf(monthlyExpense[index] ?? ZERO, yearMax),
  }));

  const december = byMonth[months[months.length - 1] ?? ''];

  return (
    <>
      {months.map((month) => (
        <MonthDataPoint key={month} walletId={walletId} month={month} onSettled={handleMonthSettled} />
      ))}
      <View className="gap-lg">
        <View>
          <Text variant="label" tone="muted" style={{ marginBottom: theme.spacing.sm }}>
            {t('dashboard.incomeVsExpenses')}
          </Text>
          <TrendBarChart points={points} />
        </View>

        {december !== undefined ? (
          <BudgetGoalSummary
            budgets={december.activeBudgets}
            goals={december.activeGoals}
            onOpenBudget={(budgetId) => navigation.getParent()?.navigate('BudgetDetail', { budgetId })}
            onOpenGoal={(goalId) => navigation.getParent()?.navigate('GoalDetail', { goalId })}
          />
        ) : null}
      </View>
    </>
  );
}

/** One query per month as its own component — a fixed array of these keeps hook calls stable, unlike calling the hook inside a loop. */
function MonthDataPoint({
  walletId,
  month,
  onSettled,
}: {
  walletId: string;
  month: CalendarDay;
  onSettled: (month: CalendarDay, data: DashboardResponse | undefined) => void;
}) {
  const query = useGetDashboardSummaryQuery({ walletId, ...windowFor('monthly', month) });
  // A month whose query errors still settles (as `undefined`, folded into the
  // chart as a zero point) — waiting on `data` alone would spin forever.
  useEffect(() => {
    if (query.isSuccess || query.isError) onSettled(month, query.data);
  }, [month, query.isSuccess, query.isError, query.data, onSettled]);
  return null;
}

/** A short, deterministic list of observations, not an analytics engine. */
function PeriodInsights({
  data,
  previousData,
  savingsRate,
  periodLabel,
}: {
  data: DashboardResponse;
  previousData: DashboardResponse | undefined;
  savingsRate: number | null;
  periodLabel: string;
}) {
  const theme = useTheme();
  const { t } = useTranslation();

  const lines: string[] = [];
  const topCategory = data.spendingByCategory[0];

  if (savingsRate !== null) {
    lines.push(
      savingsRate >= 0
        ? t('dashboard.savedPercent', { rate: savingsRate })
        : t('dashboard.spentMorePercent', { rate: Math.abs(savingsRate) }),
    );
  }

  if (topCategory !== undefined) {
    lines.push(
      t('dashboard.biggestExpense', {
        category: topCategory.categoryName,
        percentage: topCategory.percentage.toFixed(0),
      }),
    );

    const previousSlice = previousData?.spendingByCategory.find(
      (slice) => slice.categoryId === topCategory.categoryId,
    );
    if (previousSlice !== undefined) {
      const change = changeAgainst(topCategory.amount, previousSlice.amount);
      if (change !== null && Math.abs(change) >= 5) {
        lines.push(
          t('dashboard.spendingChangedPeriod', {
            category: topCategory.categoryName,
            direction: change >= 0 ? t('dashboard.increased') : t('dashboard.decreased'),
            change: Math.abs(change),
          }),
        );
      }
    }
  }

  if (lines.length === 0) return null;

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <Text variant="label" tone="muted">
        {t('dashboard.insightsFor', { period: periodLabel })}
      </Text>
      {lines.map((line) => (
        <Text key={line}>{line}</Text>
      ))}
    </View>
  );
}

/**
 * The year's loaded months as one emptiness input: activity in any single month
 * makes the year non-empty, while `totalBalance`/`recentTransactions` are
 * all-time figures every month's response reports identically.
 */
function yearOf(
  months: readonly CalendarDay[],
  byMonth: Record<CalendarDay, DashboardResponse | undefined>,
  reference: DashboardResponse,
) {
  const loaded = months
    .map((month) => byMonth[month])
    .filter((response): response is DashboardResponse => response !== undefined);

  return {
    totalBalance: reference.totalBalance,
    recentTransactions: reference.recentTransactions,
    income: loaded.flatMap((response) => response.income),
    expense: loaded.flatMap((response) => response.expense),
    transferredIn: loaded.flatMap((response) => response.transferredIn),
    transferredOut: loaded.flatMap((response) => response.transferredOut),
  };
}

function monthsOfYear(year: number): CalendarDay[] {
  return Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, '0')}-01`);
}
