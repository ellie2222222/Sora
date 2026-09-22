import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react-native';
import type { CurrencyTotal } from '@sora/contracts';

import { Money, Text } from '@/components';
import { useTheme } from '@/app/providers';

export interface DashboardKpisProps {
  income: CurrencyTotal[];
  expense: CurrencyTotal[];
  net: CurrencyTotal[];
  transferredIn: CurrencyTotal[];
  transferredOut: CurrencyTotal[];
  /** Null when income was zero, so a rate would divide by nothing. */
  savingsRate: number | null;
}

/**
 * The period's headline figures.
 *
 * Transfers get their own row rather than sitting beside income/expense: they
 * are a different kind of number (BR-06 keeps them out of both), and putting
 * them in the same row invites reading them as a third component of net.
 */
export function DashboardKpis({
  income,
  expense,
  net,
  transferredIn,
  transferredOut,
  savingsRate,
}: DashboardKpisProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const hasTransfers = transferredIn.length > 0 || transferredOut.length > 0;

  return (
    <View style={{ gap: theme.spacing.md }}>
      <View className="flex-row justify-between">
        <Figure label={t('dashboard.income')} total={income[0]} testID="dashboard-kpi-income" />
        <Figure label={t('dashboard.expenses')} total={expense[0]} testID="dashboard-kpi-expense" />
        <Figure label={t('dashboard.net')} total={net[0]} testID="dashboard-kpi-net" />
      </View>

      {savingsRate !== null ? (
        <Text variant="caption" tone={savingsRate >= 0 ? 'muted' : 'danger'} testID="dashboard-kpi-savings-rate">
          {savingsRate >= 0
            ? t('dashboard.savingsRate', { rate: savingsRate })
            : t('dashboard.negativeSavingsRate', { rate: Math.abs(savingsRate) })}
        </Text>
      ) : null}

      {hasTransfers ? (
        <View
          className="flex-row justify-between"
          style={{
            paddingTop: theme.spacing.sm,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
          }}
          testID="dashboard-transfers"
        >
          <TransferFigure
            label={t('dashboard.transferredIn')}
            total={transferredIn[0]}
            icon={ArrowDownLeft}
            color={theme.colors.income}
          />
          <TransferFigure
            label={t('dashboard.transferredOut')}
            total={transferredOut[0]}
            icon={ArrowUpRight}
            color={theme.colors.expense}
          />
        </View>
      ) : null}
    </View>
  );
}

function Figure({ label, total, testID }: { label: string; total: CurrencyTotal | undefined; testID: string }) {
  return (
    <View testID={testID}>
      <Text variant="label" tone="muted">
        {label}
      </Text>
      {total !== undefined ? (
        <Money amount={total.amount} currency={total.currency} variant="title" weight="bold" />
      ) : (
        <Text tone="faint">—</Text>
      )}
    </View>
  );
}

function TransferFigure({
  label,
  total,
  icon: Icon,
  color,
}: {
  label: string;
  total: CurrencyTotal | undefined;
  icon: typeof ArrowDownLeft;
  color: string;
}) {
  const theme = useTheme();

  return (
    <View className="flex-row items-center" style={{ gap: theme.spacing.xs }}>
      <Icon size={14} color={color} strokeWidth={2} />
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      {total !== undefined ? (
        <Money amount={total.amount} currency={total.currency} variant="caption" weight="semibold" />
      ) : (
        <Text variant="caption" tone="faint">
          —
        </Text>
      )}
    </View>
  );
}
