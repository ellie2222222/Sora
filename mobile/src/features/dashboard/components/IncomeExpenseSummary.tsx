import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ArrowDownLeft, ArrowUpRight, type LucideIcon } from 'lucide-react-native';
import {
  TransactionType,
  ZERO,
  amountInCurrency,
  formatMoney,
  largestCurrencyTotal,
  maxOf,
  percentageOf,
  subtract,
  type CurrencyTotal,
  type DashboardResponse,
  type Scaled,
} from '@sora/contracts';

import { Money, OtherCurrencies, SectionLabel, Text } from '@/components';
import { useTheme } from '@/app/providers';
import { absScaled } from '@/utils';

/**
 * Income and expenses on one shared scale, each with the previous period as a faint bar beneath, then
 * what they net to. Figures are in the period's largest currency; any other currency is listed on its
 * own, never added in (BR-07). Transfers sit apart because they are neither (BR-06).
 */
export function IncomeExpenseSummary({
  data,
  previous,
  previousLabel,
}: {
  data: DashboardResponse;
  previous: DashboardResponse | undefined;
  previousLabel: string;
}) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();

  const currency = largestCurrencyTotal([...data.income, ...data.expense])?.currency;
  if (currency === undefined) return null;

  const income = amountInCurrency(data.income, currency);
  const expense = amountInCurrency(data.expense, currency);
  const net = subtract(income, expense);
  const previousIncome = previous === undefined ? null : amountInCurrency(previous.income, currency);
  const previousExpense = previous === undefined ? null : amountInCurrency(previous.expense, currency);
  const scale = [income, expense, previousIncome ?? ZERO, previousExpense ?? ZERO].reduce((largest, value) => maxOf(largest, value), ZERO);
  const keptRate = income > ZERO ? percentageOf(net, income, 0) : null;
  const keptRateCaption =
    keptRate === null
      ? null
      : keptRate >= 0
        ? t('dashboard.savingsRate', { rate: keptRate })
        : keptRate > -100
          ? t('dashboard.negativeSavingsRate', { rate: -keptRate })
          : // Past double the income a percentage stops reading as a comparison ("7911% more"); a multiple still does.
            t('dashboard.spentMultiple', {
              multiple: new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(percentageOf(expense, income, 0) / 100),
            });

  const otherCurrencies = [...new Set([...data.income, ...data.expense].map((total) => total.currency))].filter((code) => code !== currency);
  const headlineFirst = (totals: readonly CurrencyTotal[]) =>
    [...totals].sort((a, b) => Number(b.currency === currency) - Number(a.currency === currency));
  const movedIn = headlineFirst(data.transferredIn);
  const movedOut = headlineFirst(data.transferredOut);

  return (
    <View style={{ gap: theme.spacing.md }} testID="dashboard-income-expense">
      <SectionLabel
        action={
          previous !== undefined ? (
            <View className="flex-row items-center" style={{ gap: theme.spacing.xs }}>
              <View style={{ width: theme.spacing.md, height: theme.borderWidth.thick, borderRadius: theme.radius.pill, backgroundColor: theme.colors.borderStrong }} />
              <Text variant="caption" tone="faint" numberOfLines={1}>
                {t('dashboard.versusPeriod', { period: previousLabel })}
              </Text>
            </View>
          ) : undefined
        }
      >
        {t('dashboard.incomeVsExpenses')}
      </SectionLabel>

      <FlowRow
        label={t('dashboard.income')}
        amount={income}
        previousAmount={previousIncome}
        scale={scale}
        currency={currency}
        color={theme.colors.income}
        testID="dashboard-kpi-income"
      />
      <FlowRow
        label={t('dashboard.expenses')}
        amount={expense}
        previousAmount={previousExpense}
        scale={scale}
        currency={currency}
        color={theme.colors.expense}
        testID="dashboard-kpi-expense"
      />

      <View className="flex-row items-center justify-between" style={{ gap: theme.spacing.md, marginTop: theme.spacing.sm }} testID="dashboard-kpi-net">
        <View style={{ flexShrink: 1, gap: theme.spacing.xxs }}>
          <Text weight="semibold">{t('dashboard.net')}</Text>
          {keptRate !== null ? (
            <Text variant="caption" tone={keptRate >= 0 ? 'muted' : 'danger'} testID="dashboard-kpi-savings-rate">
              {keptRateCaption}
            </Text>
          ) : null}
        </View>
        <Money
          amount={formatMoney(absScaled(net))}
          currency={currency}
          type={net < ZERO ? TransactionType.EXPENSE : TransactionType.INCOME}
          variant="title"
          weight="bold"
          numberOfLines={1}
        />
      </View>

      {movedIn.length > 0 || movedOut.length > 0 ? (
        <View className="flex-row flex-wrap" style={{ columnGap: theme.spacing.lg, rowGap: theme.spacing.xs }} testID="dashboard-transfers">
          <TransferFigure icon={ArrowDownLeft} label={t('dashboard.transferredIn')} totals={movedIn} />
          <TransferFigure icon={ArrowUpRight} label={t('dashboard.transferredOut')} totals={movedOut} />
        </View>
      ) : null}

      <OtherCurrencies
        rows={otherCurrencies.map((code) => ({
          currency: code,
          figures: [
            { amount: amountInCurrency(data.income, code), type: TransactionType.INCOME },
            { amount: amountInCurrency(data.expense, code), type: TransactionType.EXPENSE },
          ],
        }))}
        testID="dashboard-other-currencies"
      />
    </View>
  );
}

function FlowRow({
  label,
  amount,
  previousAmount,
  scale,
  currency,
  color,
  testID,
}: {
  label: string;
  amount: Scaled;
  previousAmount: Scaled | null;
  scale: Scaled;
  currency: string;
  color: string;
  testID: string;
}) {
  const theme = useTheme();
  const share = (value: Scaled) => (scale === ZERO ? 0 : percentageOf(value, scale));

  return (
    <View style={{ gap: theme.spacing.xs }} testID={testID}>
      <View className="flex-row items-baseline justify-between" style={{ gap: theme.spacing.md }}>
        <Text variant="label" tone="muted">
          {label}
        </Text>
        <Money amount={formatMoney(amount)} currency={currency} weight="semibold" numberOfLines={1} style={{ fontSize: theme.fontSize.lg }} />
      </View>
      <Bar share={share(amount)} color={color} thickness={theme.sizes.progressBar.md} track />
      {previousAmount !== null ? <Bar share={share(previousAmount)} color={theme.colors.borderStrong} thickness={theme.borderWidth.thick} /> : null}
    </View>
  );
}

/** A zero share still shows as a sliver, so "nothing" reads as a measured zero rather than a missing bar. */
function Bar({ share, color, thickness, track = false }: { share: number; color: string; thickness: number; track?: boolean }) {
  const theme = useTheme();
  return (
    <View style={{ height: thickness, borderRadius: theme.radius.pill, backgroundColor: track ? theme.colors.surfaceMuted : 'transparent', overflow: 'hidden' }}>
      <View style={{ width: `${share}%`, minWidth: theme.sizes.chart.minBarLength, height: '100%', borderRadius: theme.radius.pill, backgroundColor: color }} />
    </View>
  );
}

function TransferFigure({ icon: Icon, label, totals }: { icon: LucideIcon; label: string; totals: readonly CurrencyTotal[] }) {
  const theme = useTheme();
  return (
    <View className="flex-row flex-wrap items-center" style={{ gap: theme.spacing.xs }}>
      <Icon size={theme.iconSize.sm} color={theme.colors.textFaint} />
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      {totals.length > 0 ? (
        totals.map((total) => <Money key={total.currency} amount={total.amount} currency={total.currency} variant="caption" weight="semibold" />)
      ) : (
        <Text variant="caption" tone="faint">
          —
        </Text>
      )}
    </View>
  );
}
