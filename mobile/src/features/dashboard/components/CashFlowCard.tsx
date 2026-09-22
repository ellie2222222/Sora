import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ZERO, add, maxOf, parseMoney, percentageOf, subtract, type CurrencyTotal } from '@sora/contracts';

import { Text, WaterfallChart, type WaterfallPoint } from '@/components';
import { useTheme } from '@/app/providers';

export interface CashFlowCardProps {
  income: CurrencyTotal[];
  expense: CurrencyTotal[];
  transferredIn: CurrencyTotal[];
  transferredOut: CurrencyTotal[];
}

/**
 * Income → expense → transfers as a waterfall.
 *
 * Deliberately starts at zero rather than at the opening balance: a balance is
 * a running total across all time, and mixing it into a period-scoped chart
 * would imply the period's bars explain the whole figure. What this shows is
 * the period's own movement and what it nets to.
 *
 * Scoped to the first reported currency — the bars are only comparable within
 * one currency (BR-07), and stacking two would draw a meaningless total.
 */
export function CashFlowCard({ income, expense, transferredIn, transferredOut }: CashFlowCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const currency = income[0]?.currency ?? expense[0]?.currency;
  if (currency === undefined) return null;

  const amountIn = amountFor(income, currency);
  const amountOut = amountFor(expense, currency);
  const movedIn = amountFor(transferredIn, currency);
  const movedOut = amountFor(transferredOut, currency);
  const net = subtract(add(amountIn, movedIn), add(amountOut, movedOut));

  // Every bar is sized against the largest single figure in the series, so the
  // ratios stay in scaled-bigint space until they become plain layout numbers.
  const scale = [amountIn, amountOut, movedIn, movedOut, net < ZERO ? subtract(ZERO, net) : net].reduce(
    (largest, value) => maxOf(largest, value),
    ZERO,
  );
  if (scale === ZERO) return null;

  const share = (value: typeof ZERO) => percentageOf(value, scale);

  const points: WaterfallPoint[] = [
    { label: t('dashboard.income'), value: share(amountIn), kind: 'start' },
    { label: t('dashboard.expenses'), value: share(amountOut), kind: 'decrease' },
    ...(movedIn > ZERO ? [{ label: t('dashboard.inShort'), value: share(movedIn), kind: 'increase' as const }] : []),
    ...(movedOut > ZERO ? [{ label: t('dashboard.outShort'), value: share(movedOut), kind: 'decrease' as const }] : []),
    { label: t('dashboard.net'), value: 0, kind: 'end' },
  ];

  return (
    <View style={{ gap: theme.spacing.sm }} testID="dashboard-cash-flow">
      <Text variant="label" tone="muted">
        {t('dashboard.cashFlow')}
      </Text>
      <WaterfallChart points={points} testID="dashboard-cash-flow-chart" />
    </View>
  );
}

function amountFor(totals: readonly CurrencyTotal[], currency: string) {
  const match = totals.find((total) => total.currency === currency);
  return match === undefined ? ZERO : parseMoney(match.amount);
}
