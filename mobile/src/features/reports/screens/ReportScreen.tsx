import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { add, isNegative, maxOf, negate, percentageOf, parseMoney, ZERO } from '@sora/contracts';
import type { CategorySpendSlice, CurrencyTotal, DashboardResponse } from '@sora/contracts';

import { Button, DonutChart, EmptyState, ErrorState, Money, MonthSelector, Text, TrendBarChart } from '../../../components/index.ts';
import { SkeletonList } from '../../../components/Skeleton.tsx';
import { PieChart as PieChartIcon } from 'lucide-react-native';
import { useTheme } from '../../../app/providers/ThemeProvider.tsx';
import { useWallets } from '../../../app/providers/WalletProvider.tsx';
import { WalletContextBar } from '../../wallets/components/WalletContextBar.tsx';
import { useGetDashboardSummaryQuery } from '../../../app/store/api/dashboardApi.ts';
import { formatMoneyString } from '../../../utils/money.ts';
import { addMonths, endOfMonth, formatMonthYear, monthName, parseDay, startOfMonth, today } from '../../../utils/date.ts';
import type { CalendarDay } from '../../../utils/date.ts';
import type { MainTabScreenProps } from '../../../app/navigation/types.ts';

type Period = 'monthly' | 'yearly';

export function ReportScreen({ navigation }: MainTabScreenProps<'Report'>) {
  const theme = useTheme();
  const { activeWalletId } = useWallets();
  const onManage = () => navigation.getParent()?.navigate('WalletList');

  const [period, setPeriod] = useState<Period>('monthly');
  const [selectedMonth, setSelectedMonth] = useState(() => startOfMonth(today()));
  const [selectedYear, setSelectedYear] = useState(() => parseDay(today()).year);
  const isCurrentMonth = selectedMonth === startOfMonth(today());
  const isCurrentYear = selectedYear === parseDay(today()).year;

  return (
    <WalletContextBar onManage={onManage}>
      <ScrollView testID="report-screen" contentContainerStyle={{ padding: theme.spacing.md, gap: theme.spacing.lg }}>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <Button
            testID="report-period-monthly"
            label="Monthly"
            size="sm"
            variant={period === 'monthly' ? 'primary' : 'secondary'}
            onPress={() => setPeriod('monthly')}
          />
          <Button
            testID="report-period-yearly"
            label="Yearly"
            size="sm"
            variant={period === 'yearly' ? 'primary' : 'secondary'}
            onPress={() => setPeriod('yearly')}
          />
        </View>

        {activeWalletId === null ? (
          <EmptyState icon={PieChartIcon} title="No wallet yet" description="Create a wallet to see reports." testID="report-empty" />
        ) : period === 'monthly' ? (
          <>
            <MonthSelector
              testID="report-month-selector"
              label={formatMonthYear(selectedMonth)}
              onPrev={() => setSelectedMonth((month) => addMonths(month, -1))}
              onNext={() => setSelectedMonth((month) => addMonths(month, 1))}
              disableNext={isCurrentMonth}
            />
            <MonthlyReport walletId={activeWalletId} month={selectedMonth} />
          </>
        ) : (
          <>
            <MonthSelector
              testID="report-year-selector"
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

function MonthlyReport({ walletId, month }: { walletId: string; month: CalendarDay }) {
  const theme = useTheme();
  const previousMonth = addMonths(month, -1);

  const current = useGetDashboardSummaryQuery({ walletId, dateFrom: startOfMonth(month), dateTo: endOfMonth(month) });
  const previous = useGetDashboardSummaryQuery({ walletId, dateFrom: startOfMonth(previousMonth), dateTo: endOfMonth(previousMonth) });

  if (current.isLoading) return <SkeletonList rows={5} />;
  if (current.isError) return <ErrorState error={current.error} onRetry={() => void current.refetch()} testID="report-monthly-error" />;

  const data = current.data;
  if (data === undefined) return null;

  const income = data.income[0];
  const expense = data.expense[0];
  const net = data.net[0];
  const savingsRate = income !== undefined && net !== undefined ? percentageOf(parseMoney(net.amount), parseMoney(income.amount), 0) : null;
  const topCategory = data.spendingByCategory[0];
  const insights = buildMonthlyInsights(data, previous.data, topCategory, savingsRate);

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <SummaryFigure label="Income" total={income} />
        <SummaryFigure label="Expenses" total={expense} />
        <SummaryFigure label="Net" total={net} />
      </View>

      {data.spendingByCategory.length === 0 ? (
        <Text tone="faint">No spending recorded this month.</Text>
      ) : (
        <View style={{ alignItems: 'center', gap: theme.spacing.md }}>
          <DonutChart
            slices={data.spendingByCategory}
            centerLabel={expense !== undefined ? formatCompact(expense) : undefined}
            centerSublabel="spent"
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
            Insights
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
            Income vs expenses
          </Text>
          <TrendBarChart points={points} />
        </View>

        {topCategories.length > 0 ? (
          <View style={{ gap: theme.spacing.xs }}>
            <Text variant="label" tone="muted">
              Top categories this year
            </Text>
            {topCategories.slice(0, 6).map((category) => (
              <View key={category.name} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: theme.spacing.xs }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: category.color ?? theme.colors.primary }} />
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

function SummaryFigure({ label, total }: { label: string; total: CurrencyTotal | undefined }) {
  return (
    <View>
      <Text variant="label" tone="muted">
        {label}
      </Text>
      {total !== undefined ? <Money amount={total.amount} currency={total.currency} variant="title" weight="bold" /> : <Text tone="faint">—</Text>}
    </View>
  );
}

function CategoryLegendRow({ slice }: { slice: CategorySpendSlice }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: slice.color ?? theme.colors.primary }} />
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
  data: DashboardResponse,
  previousData: DashboardResponse | undefined,
  topCategory: CategorySpendSlice | undefined,
  savingsRate: number | null,
): string[] {
  const lines: string[] = [];

  if (savingsRate !== null) {
    lines.push(savingsRate >= 0 ? `You saved ${savingsRate}% of your income this month.` : `You spent ${Math.abs(savingsRate)}% more than you earned this month.`);
  }

  if (topCategory !== undefined) {
    lines.push(`${topCategory.categoryName} was your biggest expense at ${topCategory.percentage.toFixed(0)}% of spending.`);

    const previousSlice = previousData?.spendingByCategory.find((slice) => slice.categoryId === topCategory.categoryId);
    if (previousSlice !== undefined) {
      const currentAmount = parseMoney(topCategory.amount);
      const previousAmount = parseMoney(previousSlice.amount);
      if (previousAmount !== ZERO) {
        const denominator = isNegative(previousAmount) ? negate(previousAmount) : previousAmount;
        const change = percentageOf(add(currentAmount, negate(previousAmount)), denominator, 0);
        if (Math.abs(change) >= 5) {
          lines.push(`${topCategory.categoryName} spending ${change >= 0 ? 'increased' : 'decreased'} ${Math.abs(change)}% from last month.`);
        }
      }
    }
  }

  return lines;
}
