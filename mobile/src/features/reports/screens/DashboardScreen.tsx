import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, ChevronDown, PieChart as PieChartIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { add, isNegative, maxOf, negate, percentageOf, parseMoney, ValuationStatus, ZERO } from '@sora/contracts';
import type { CategorySpendSlice, CurrencyTotal, DashboardResponse } from '@sora/contracts';

import { ActionSheet, Button, Card, DonutChart, Money, MonthSelector, ProgressBar, RefreshableScrollView, StateView, Text, TrendBarChart } from '../../../components/index.ts';
import { SkeletonList } from '../../../components/Skeleton.tsx';
import { useTheme } from '../../../app/providers/ThemeProvider.tsx';
import { useWallets } from '../../../app/providers/WalletProvider.tsx';
import { WalletContextBar } from '../../wallets/components/WalletContextBar.tsx';
import { apiSlice } from '../../../app/store/api/apiSlice.ts';
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
  const dispatch = useDispatch();
  const { activeWallet, activeWalletId } = useWallets();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const onManage = () => navigation.getParent()?.navigate('WalletList');
  const onViewAllBudgets = () => navigation.getParent()?.navigate('Budgets');

  const [period, setPeriod] = useState<Period>('monthly');
  const [selectedMonth, setSelectedMonth] = useState(() => startOfMonth(today()));
  const [selectedYear, setSelectedYear] = useState(() => parseDay(today()).year);
  const [displayCurrency, setDisplayCurrency] = useState<string | null>(null);
  const [currencyPickerVisible, setCurrencyPickerVisible] = useState(false);

  const isCurrentMonth = selectedMonth === startOfMonth(today());
  const isCurrentYear = selectedYear === parseDay(today()).year;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      dispatch(apiSlice.util.invalidateTags(['Dashboard', 'Budget']));
      await new Promise((resolve) => setTimeout(resolve, 500));
    } finally {
      setIsRefreshing(false);
    }
  };

  const availableCurrencies = useMemo(() => {
    const set = new Set<string>();
    if (activeWallet?.balances) {
      for (const b of activeWallet.balances) {
        if (b.currency) set.add(b.currency);
      }
    }
    set.add('VND');
    set.add('USD');
    set.add('EUR');
    return Array.from(set);
  }, [activeWallet]);

  const defaultCurrency = activeWallet?.balances[0]?.currency ?? 'VND';
  const effectiveCurrency = displayCurrency ?? defaultCurrency;

  return (
    <WalletContextBar onManage={onManage}>
      <RefreshableScrollView
        testID="dashboard-screen"
        contentContainerStyle={{ padding: theme.spacing.md, gap: theme.spacing.lg }}
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
      >
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
            <MonthlyReport
              walletId={activeWalletId}
              month={selectedMonth}
              displayCurrency={effectiveCurrency}
              onOpenCurrencyPicker={() => setCurrencyPickerVisible(true)}
              onViewAllBudgets={onViewAllBudgets}
            />
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
            <YearlyReport walletId={activeWalletId} year={selectedYear} displayCurrency={effectiveCurrency} />
          </>
        )}
      </RefreshableScrollView>

      <ActionSheet
        visible={currencyPickerVisible}
        title={t('dashboard.valuationCurrency')}
        actions={availableCurrencies.map((c) => ({
          label: c === effectiveCurrency ? `${c} ✓` : c,
          onPress: () => {
            setDisplayCurrency(c);
            setCurrencyPickerVisible(false);
          },
        }))}
        onCancel={() => setCurrencyPickerVisible(false)}
      />
    </WalletContextBar>
  );
}

function MonthlyReport({
  walletId,
  month,
  displayCurrency,
  onOpenCurrencyPicker,
  onViewAllBudgets,
}: {
  walletId: string;
  month: CalendarDay;
  displayCurrency: string;
  onOpenCurrencyPicker: () => void;
  onViewAllBudgets: () => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const previousMonth = addMonths(month, -1);

  const current = useGetDashboardSummaryQuery({
    walletId,
    dateFrom: startOfMonth(month),
    dateTo: endOfMonth(month),
    displayCurrency,
  });
  const previous = useGetDashboardSummaryQuery({
    walletId,
    dateFrom: startOfMonth(previousMonth),
    dateTo: endOfMonth(previousMonth),
    displayCurrency,
  });
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

  const hasMultipleCurrencies = data.totalBalance.length > 1;
  const valuation = data.valuation;

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <Card elevated testID="dashboard-total-balance-card">
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.xs }}>
          <Text variant="label" tone="muted">
            {t('dashboard.totalBalance')}
          </Text>
          <Pressable
            testID="dashboard-currency-selector"
            onPress={onOpenCurrencyPicker}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              backgroundColor: theme.colors.surfaceElevated,
              paddingHorizontal: theme.spacing.sm,
              paddingVertical: 4,
              borderRadius: theme.radius.sm,
              borderWidth: 1,
              borderColor: theme.colors.border,
            }}
          >
            <Text variant="caption" weight="semibold">
              {displayCurrency}
            </Text>
            <ChevronDown size={14} color={theme.colors.textMuted} />
          </Pressable>
        </View>

        {valuation && valuation.status === ValuationStatus.FRESH && valuation.amount !== null ? (
          <View style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
              {valuation.isApproximate ? (
                <Text variant="heading" weight="bold">
                  ≈
                </Text>
              ) : null}
              <Money amount={valuation.amount} currency={valuation.currency} variant="heading" />
            </View>
            {valuation.isApproximate ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
                <Text variant="caption" tone="muted">
                  {t('dashboard.convertedEstimateNotice')}
                </Text>
                {hasMultipleCurrencies ? (
                  <Text variant="caption" tone="faint">
                    • {t('dashboard.acrossCurrencies', { count: data.totalBalance.length })}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : valuation && valuation.status === ValuationStatus.STALE && valuation.amount !== null ? (
          <View style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
              <Text variant="heading" weight="bold">
                ≈
              </Text>
              <Money amount={valuation.amount} currency={valuation.currency} variant="heading" />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.xs, marginTop: 2 }}>
              <View
                style={{
                  backgroundColor: theme.colors.warningMuted,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: theme.radius.sm,
                  borderWidth: 1,
                  borderColor: theme.colors.warning,
                }}
              >
                <Text variant="caption" style={{ color: theme.colors.warning, fontSize: 11 }}>
                  {t('valuation.usingStaleRate', { defaultValue: 'Using previous exchange rate' })}
                </Text>
              </View>
              <Pressable onPress={() => void current.refetch()} style={{ paddingVertical: 2, paddingHorizontal: 4 }}>
                <Text variant="caption" weight="medium" style={{ color: theme.colors.primary }}>
                  {t('common.tryAgain', { defaultValue: 'Try again' })}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : valuation && valuation.status === ValuationStatus.UNAVAILABLE ? (
          <View style={{ gap: theme.spacing.xs, marginVertical: theme.spacing.xs }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
              <Text variant="heading" weight="bold" tone="muted">
                ≈ —
              </Text>
            </View>
            <Text variant="body" tone="danger">
              {t('valuation.rateUnavailable', { defaultValue: 'Conversion unavailable' })}
            </Text>
            {valuation.missingCurrencies && valuation.missingCurrencies.length > 0 ? (
              <Text variant="caption" tone="muted">
                {t('valuation.missingCurrencies', {
                  currencies: valuation.missingCurrencies.join(', '),
                  defaultValue: `Couldn't get a rate for ${valuation.missingCurrencies.join(', ')}.`,
                })}
              </Text>
            ) : null}
            <Pressable onPress={() => void current.refetch()} style={{ alignSelf: 'flex-start', marginTop: 4 }}>
              <Text variant="caption" weight="medium" style={{ color: theme.colors.primary }}>
                {t('common.tryAgain', { defaultValue: 'Try again' })}
              </Text>
            </Pressable>
          </View>
        ) : (
          <BalanceTotals totals={data.totalBalance} />
        )}

        {/* Native balances breakdown when multi-currency or when viewing a converted currency */}
        {hasMultipleCurrencies || (valuation?.isApproximate && data.totalBalance.length > 0) ? (
          <View
            style={{
              marginTop: theme.spacing.md,
              paddingTop: theme.spacing.sm,
              borderTopWidth: 1,
              borderTopColor: theme.colors.border,
              gap: theme.spacing.xs,
            }}
          >
            <Text variant="caption" tone="muted">
              {t('wallets.accounts')}
            </Text>
            {data.totalBalance.map((total) => (
              <View
                key={total.currency}
                style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <Text variant="body" weight="medium">
                  {total.currency}
                </Text>
                <Money amount={total.amount} currency={total.currency} variant="body" />
              </View>
            ))}
          </View>
        ) : null}
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

function YearlyReport({ walletId, year, displayCurrency }: { walletId: string; year: number; displayCurrency: string }) {
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
          <MonthDataPoint key={month} walletId={walletId} month={month} displayCurrency={displayCurrency} onSettled={handleMonthSettled} />
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
        <MonthDataPoint key={month} walletId={walletId} month={month} displayCurrency={displayCurrency} onSettled={handleMonthSettled} />
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
  displayCurrency,
  onSettled,
}: {
  walletId: string;
  month: CalendarDay;
  displayCurrency: string;
  onSettled: (month: CalendarDay, data: DashboardResponse | undefined) => void;
}) {
  const query = useGetDashboardSummaryQuery({
    walletId,
    dateFrom: startOfMonth(month),
    dateTo: endOfMonth(month),
    displayCurrency,
  });
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

