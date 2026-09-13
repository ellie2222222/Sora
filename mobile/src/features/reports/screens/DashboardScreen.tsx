import { useCallback, useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, PieChart as PieChartIcon } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { add, isNegative, maxOf, negate, percentageOf, parseMoney, ZERO } from '@sora/contracts';
import type { CategorySpendSlice, CurrencyTotal, DashboardResponse } from '@sora/contracts';

import { Button, Card, DonutChart, Money, MonthSelector, ProgressBar, StateView, Text, TrendBarChart } from '../../../components/index.ts';
import { SkeletonList } from '../../../components/Skeleton.tsx';
import { useTheme } from '../../../app/providers/ThemeProvider.tsx';
import { useWallets } from '../../../app/providers/WalletProvider.tsx';
import { WalletContextBar } from '../../wallets/components/WalletContextBar.tsx';
import { useGetDashboardSummaryQuery } from '../../../app/store/api/dashboardApi.ts';
import { useListBudgetsQuery } from '../../../app/store/api/budgetsApi.ts';
import { formatMoneyString } from '../../../utils/money.ts';
import { addMonths, endOfMonth, formatMonthYear, monthName, parseDay, startOfMonth, today } from '../../../utils/date.ts';
import type { CalendarDay } from '../../../utils/date.ts';
import type { MainTabScreenProps } from '../../../app/navigation/types.ts';

type Period = 'monthly' | 'yearly';

export function DashboardScreen({ navigation }: MainTabScreenProps<'Dashboard'>) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { activeWalletId } = useWallets();
  const onManage = () => navigation.getParent()?.navigate('WalletList');
  const onViewAllBudgets = () => navigation.getParent()?.navigate('Budgets');

  const [period, setPeriod] = useState<Period>('monthly');
  const [selectedMonth, setSelectedMonth] = useState(() => startOfMonth(today()));
  const [selectedYear, setSelectedYear] = useState(() => parseDay(today()).year);
  const isCurrentMonth = selectedMonth === startOfMonth(today());
  const isCurrentYear = selectedYear === parseDay(today()).year;

  return (
    <WalletContextBar onManage={onManage}>
      <ScrollView testID="dashboard-screen" contentContainerStyle={{ padding: theme.spacing.md, gap: theme.spacing.lg }}>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <Button
            testID="dashboard-period-monthly"
            label={t('reports.monthly')}
            size="sm"
            variant={period === 'monthly' ? 'primary' : 'secondary'}
            onPress={() => setPeriod('monthly')}
          />
          <Button
            testID="dashboard-period-yearly"
            label={t('reports.yearly')}
            size="sm"
            variant={period === 'yearly' ? 'primary' : 'secondary'}
            onPress={() => setPeriod('yearly')}
          />
        </View>

        {activeWalletId === null ? (
          <StateView variant="empty" icon={PieChartIcon} title={t('dashboard.noWalletYet')} message={t('dashboard.createWalletToSee')} testID="dashboard-empty" />
        ) : period === 'monthly' ? (
          <>
            <MonthSelector
              testID="dashboard-month-selector"
              label={formatMonthYear(selectedMonth)}
              onPrev={() => setSelectedMonth((month) => addMonths(month, -1))}
              onNext={() => setSelectedMonth((month) => addMonths(month, 1))}
              disableNext={isCurrentMonth}
            />
            <MonthlyReport walletId={activeWalletId} month={selectedMonth} onViewAllBudgets={onViewAllBudgets} />
          </>
        ) : (
          <>
            <MonthSelector
              testID="dashboard-year-selector"
              label={String(selectedYear)}
              onPrev={() => setSelectedYear((year) => year - 1)}
              onNext={() => setSelectedYear((year) => year + 1)}
              disableNext={isCurrentYear}
            />
            <YearlyReport walletId={activeWalletId} year={selectedYear} />
          </>
        )}
      </ScrollView>
    </WalletContextBar>
  );
}

function MonthlyReport({ walletId, month, onViewAllBudgets }: { walletId: string; month: CalendarDay; onViewAllBudgets: () => void }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const previousMonth = addMonths(month, -1);

  const current = useGetDashboardSummaryQuery({ walletId, dateFrom: startOfMonth(month), dateTo: endOfMonth(month) });
  const previous = useGetDashboardSummaryQuery({ walletId, dateFrom: startOfMonth(previousMonth), dateTo: endOfMonth(previousMonth) });
  const budgets = useListBudgetsQuery({ walletId, status: 'ACTIVE', activeOn: today() });

  if (current.isLoading) return <SkeletonList rows={5} />;
  if (current.isError) return <StateView variant="error" error={current.error} retryAction={() => void current.refetch()} testID="dashboard-monthly-error" />;

  const data = current.data;
  if (data === undefined) return <StateView variant="error" error={new Error(t('reports.noData', 'No report data available.'))} />;

  const income = data.income[0];
  const expense = data.expense[0];
  const net = data.net[0];
  const savingsRate = income !== undefined && net !== undefined ? percentageOf(parseMoney(net.amount), parseMoney(income.amount), 0) : null;
  const topCategory = data.spendingByCategory[0];
  const insights = buildMonthlyInsights(t, data, previous.data, topCategory, savingsRate);
  const topBudgets = [...(budgets.data ?? [])].sort((a, b) => b.usagePercentage - a.usagePercentage).slice(0, 3);

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <Card elevated>
        <Text variant="label" tone="muted">
          {t('dashboard.totalBalance')}
        </Text>
        <BalanceTotals totals={data.totalBalance} />
      </Card>

      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        <Card style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
            <ArrowDownLeft size={16} color={theme.colors.income} />
            <Text variant="label" tone="muted">
              {t('dashboard.income')}
            </Text>
          </View>
          <BalanceTotals totals={data.income} variant="body" />
          <MoMBadge current={data.income} previous={previous.data?.income} />
        </Card>
        <Card style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
            <ArrowUpRight size={16} color={theme.colors.expense} />
            <Text variant="label" tone="muted">
              {t('dashboard.expenses')}
            </Text>
          </View>
          <BalanceTotals totals={data.expense} variant="body" />
          <MoMBadge current={data.expense} previous={previous.data?.expense} />
        </Card>
      </View>

      {topBudgets.length > 0 ? (
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: theme.spacing.sm }}>
            <Text variant="label" tone="muted">
              {t('dashboard.budgets')}
            </Text>
            <Text variant="label" tone="muted" onPress={onViewAllBudgets} testID="dashboard-view-all-budgets">
              {t('dashboard.viewAll')}
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

      {data.spendingByCategory.length === 0 ? (
        <Text tone="faint">{t('reports.noSpendingThisMonth')}</Text>
      ) : (
        <View style={{ alignItems: 'center', gap: theme.spacing.md }}>
          <Text variant="label" tone="muted" style={{ alignSelf: 'flex-start' }}>
            {t('dashboard.spendingByCategory')}
          </Text>
          <DonutChart
            slices={data.spendingByCategory}
            centerLabel={expense !== undefined ? formatCompact(expense) : undefined}
            centerSublabel={t('reports.spent')}
          />
          <View style={{ width: '100%', gap: theme.spacing.xs }}>
            {data.spendingByCategory.map((slice) => (
              <CategoryLegendRow key={slice.categoryId} slice={slice} />
            ))}
          </View>
        </View>
      )}

      {insights.length > 0 ? (
        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="label" tone="muted">
            {t('reports.insights')}
          </Text>
          {insights.map((line) => (
            <Text key={line}>{line}</Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function YearlyReport({ walletId, year }: { walletId: string; year: number }) {
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

  const totals = months.reduce<{ categories: Map<string, { name: string; color: string | null; amount: ReturnType<typeof parseMoney> }> }>(
    (accumulator, month) => {
      const data = byMonth[month];
      for (const slice of data?.spendingByCategory ?? []) {
        const existing = accumulator.categories.get(slice.categoryId);
        const amount = parseMoney(slice.amount);
        accumulator.categories.set(slice.categoryId, {
          name: slice.categoryName,
          color: slice.color,
          amount: existing === undefined ? amount : add(existing.amount, amount),
        });
      }
      return accumulator;
    },
    { categories: new Map() },
  );

  const topCategories = Array.from(totals.categories.values()).sort((a, b) => (a.amount > b.amount ? -1 : a.amount < b.amount ? 1 : 0));

  return (
    <>
      {months.map((month) => (
        <MonthDataPoint key={month} walletId={walletId} month={month} onSettled={handleMonthSettled} />
      ))}
      <View style={{ gap: theme.spacing.lg }}>
        <View>
          <Text variant="label" tone="muted" style={{ marginBottom: theme.spacing.sm }}>
            {t('reports.incomeVsExpenses')}
          </Text>
          <TrendBarChart points={points} />
        </View>

        {topCategories.length > 0 ? (
          <View style={{ gap: theme.spacing.xs }}>
            <Text variant="label" tone="muted">
              {t('reports.topCategoriesThisYear')}
            </Text>
            {topCategories.slice(0, 6).map((category) => (
              <View key={category.name} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: theme.spacing.xs }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                  <View style={{ width: 8, height: 8, borderRadius: theme.radius.pill, backgroundColor: category.color ?? theme.colors.primary }} />
                  <Text>{category.name}</Text>
                </View>
              </View>
            ))}
          </View>
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
  const query = useGetDashboardSummaryQuery({ walletId, dateFrom: startOfMonth(month), dateTo: endOfMonth(month) });
  // A month whose query errors still settles (as `undefined`, folded into the
  // chart as a zero point) — waiting on `data` alone would spin forever.
  useEffect(() => {
    if (query.isSuccess || query.isError) onSettled(month, query.data);
  }, [month, query.isSuccess, query.isError, query.data, onSettled]);
  return null;
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
  const { t } = useTranslation();
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
      {t('dashboard.vsLastMonth', { direction: change > 0 ? '▲' : '▼', change: Math.abs(change) })}
    </Text>
  );
}

function CategoryLegendRow({ slice }: { slice: CategorySpendSlice }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <View style={{ width: 8, height: 8, borderRadius: theme.radius.pill, backgroundColor: slice.color ?? theme.colors.primary }} />
        <Text>{slice.categoryName}</Text>
      </View>
      <Text tone="muted">{slice.percentage.toFixed(0)}%</Text>
    </View>
  );
}

function monthsOfYear(year: number): CalendarDay[] {
  return Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, '0')}-01`);
}

function formatCompact(total: CurrencyTotal): string {
  return formatMoneyString(total.amount, total.currency, { compact: true, hideCurrency: true });
}

/** A short, deterministic list of observations, not an analytics engine. */
function buildMonthlyInsights(
  t: (key: string, options?: Record<string, unknown>) => string,
  data: DashboardResponse,
  previousData: DashboardResponse | undefined,
  topCategory: CategorySpendSlice | undefined,
  savingsRate: number | null,
): string[] {
  const lines: string[] = [];

  if (savingsRate !== null) {
    lines.push(
      savingsRate >= 0
        ? t('reports.savedPercent', { rate: savingsRate })
        : t('reports.spentMorePercent', { rate: Math.abs(savingsRate) })
    );
  }

  if (topCategory !== undefined) {
    lines.push(
      t('reports.biggestExpense', { category: topCategory.categoryName, percentage: topCategory.percentage.toFixed(0) })
    );

    const previousSlice = previousData?.spendingByCategory.find((slice) => slice.categoryId === topCategory.categoryId);
    if (previousSlice !== undefined) {
      const currentAmount = parseMoney(topCategory.amount);
      const previousAmount = parseMoney(previousSlice.amount);
      if (previousAmount !== ZERO) {
        const denominator = isNegative(previousAmount) ? negate(previousAmount) : previousAmount;
        const change = percentageOf(add(currentAmount, negate(previousAmount)), denominator, 0);
        if (Math.abs(change) >= 5) {
          lines.push(
            t('reports.spendingChanged', {
              category: topCategory.categoryName,
              direction: change >= 0 ? t('reports.increased') : t('reports.decreased'),
              change: Math.abs(change),
            })
          );
        }
      }
    }
  }

  return lines;
}

