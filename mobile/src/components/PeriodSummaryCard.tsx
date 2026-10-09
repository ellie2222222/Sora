import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutAnimation, View } from 'react-native';
import {
  amountInCurrency,
  formatMoney,
  largestCurrencyTotal,
  subtract,
  TransactionType,
  ZERO,
  type CurrencyTotal,
  type TransactionResponse,
} from '@sora/contracts';

import { useTheme } from '@/app/providers';
import { sumByTransactionType } from '@/utils';
import { Card } from './Card.tsx';
import { Money } from './Money.tsx';
import { OtherCurrencies, type OtherCurrencyRow } from './OtherCurrencies.tsx';
import { Text } from './Text.tsx';

export interface PeriodSummaryCardProps {
  transactions: readonly TransactionResponse[];
  filterType?: 'ALL' | TransactionType;
  testID?: string;
}

type Totals = Record<'income' | 'expense' | 'transfer', CurrencyTotal[]>;

/**
 * The period's largest currency as the headline block, any other currency as a compact line beneath.
 * Expenses leads, large and unsigned, because that is what a user scanning this screen wants first.
 */
export function PeriodSummaryCard({ transactions, filterType = 'ALL', testID }: PeriodSummaryCardProps) {
  const theme = useTheme();

  useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, [filterType]);

  const totals: Totals = {
    income: sumByTransactionType(transactions, 'INCOME'),
    expense: sumByTransactionType(transactions, 'EXPENSE'),
    transfer: sumByTransactionType(transactions, 'TRANSFER'),
  };

  const shownTotals =
    filterType === 'ALL'
      ? [...totals.income, ...totals.expense]
      : filterType === TransactionType.INCOME
        ? totals.income
        : filterType === TransactionType.EXPENSE
          ? totals.expense
          : totals.transfer;
  const currency = largestCurrencyTotal(shownTotals)?.currency;
  if (currency === undefined) return null;

  const otherRows: OtherCurrencyRow[] = [...new Set(shownTotals.map((total) => total.currency))]
    .filter((code) => code !== currency)
    .map((code) => ({
      currency: code,
      figures:
        filterType === TransactionType.TRANSFER
          ? [{ amount: amountInCurrency(totals.transfer, code), color: theme.colors.transfer }]
          : [
              ...(filterType !== TransactionType.EXPENSE ? [{ amount: amountInCurrency(totals.income, code), type: TransactionType.INCOME }] : []),
              ...(filterType !== TransactionType.INCOME ? [{ amount: amountInCurrency(totals.expense, code), type: TransactionType.EXPENSE }] : []),
            ],
    }));

  return (
    <Card elevated testID={testID} style={{ gap: theme.spacing.md }}>
      <CurrencyBlock currency={currency} filterType={filterType} totals={totals} transactions={transactions} />
      <OtherCurrencies rows={otherRows} testID={testID === undefined ? undefined : `${testID}-other-currencies`} />
    </Card>
  );
}

function CurrencyBlock({
  currency,
  filterType,
  totals,
  transactions,
}: {
  currency: string;
  filterType: 'ALL' | TransactionType;
  totals: Totals;
  transactions: readonly TransactionResponse[];
}) {
  const theme = useTheme();
  const { t } = useTranslation();

  const income = amountInCurrency(totals.income, currency);
  const expense = amountInCurrency(totals.expense, currency);
  const incomeAmount = formatMoney(income);
  const expenseAmount = formatMoney(expense);
  const transferAmount = formatMoney(amountInCurrency(totals.transfer, currency));
  const netAmount = formatMoney(subtract(income, expense));

  const curTransactions = transactions.filter(t => t.currency === currency);

  if (filterType === 'ALL') {
    return (
      <View style={{ gap: theme.spacing.sm }}>
        <View className="flex-row">
          <View style={{ flex: 1, gap: theme.spacing.xxs }}>
            <Text variant="caption" tone="muted">
              {t('transactions.expensesLabel', { defaultValue: 'Expenses' })}
            </Text>
            <Money
              amount={expenseAmount}
              currency={currency}
              type={TransactionType.EXPENSE}
              showSign={false}
              formatOptions={{ signDisplay: 'never' }}
              variant="heading"
              weight="bold"
            />
          </View>
          <View style={{ flex: 1, gap: theme.spacing.xxs }}>
            <Text variant="caption" tone="muted">
              {t('transactions.incomeLabel', { defaultValue: 'Income' })}
            </Text>
            <Money
              amount={incomeAmount}
              currency={currency}
              type={TransactionType.INCOME}
              showSign={false}
              formatOptions={{ signDisplay: 'never' }}
              variant="heading"
              weight="bold"
            />
          </View>
        </View>

        <View
          style={{
            gap: theme.spacing.xxs,
            paddingTop: theme.spacing.sm,
            borderTopWidth: theme.borderWidth.thin,
            borderTopColor: theme.colors.border,
          }}
        >
          <Text variant="caption" tone="muted">
            {t('transactions.netCashFlow', { defaultValue: 'Net cash flow' })}
          </Text>
          <Money amount={netAmount} currency={currency} variant="label" weight="semibold" />
        </View>
      </View>
    );
  }

  if (filterType === TransactionType.EXPENSE) {
    const avg = curTransactions.length > 0
      ? formatMoney(expense / BigInt(curTransactions.length))
      : formatMoney(ZERO);

    return (
      <View style={{ gap: theme.spacing.sm }}>
        <View style={{ gap: theme.spacing.xxs }}>
          <Text variant="caption" tone="muted">
            {t('transactions.totalExpenses', { defaultValue: 'Total expenses' })}
          </Text>
          <Money
            amount={expenseAmount}
            currency={currency}
            type={TransactionType.EXPENSE}
            showSign={false}
            formatOptions={{ signDisplay: 'never' }}
            variant="heading"
            weight="bold"
          />
        </View>

        <View
          style={{
            gap: theme.spacing.xs,
            paddingTop: theme.spacing.sm,
            borderTopWidth: theme.borderWidth.thin,
            borderTopColor: theme.colors.border,
          }}
        >
          <View className="flex-row justify-between">
            <Text variant="label" tone="muted">
              {t('transactions.transactions', { defaultValue: 'Transactions' })}
            </Text>
            <Text variant="label">{curTransactions.length}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text variant="label" tone="muted">
              {t('transactions.average', { defaultValue: 'Average expense' })}
            </Text>
            <Money amount={avg} currency={currency} showSign={false} formatOptions={{ signDisplay: 'never' }} variant="label" />
          </View>
        </View>
      </View>
    );
  }

  if (filterType === TransactionType.INCOME) {
    const avg = curTransactions.length > 0
      ? formatMoney(income / BigInt(curTransactions.length))
      : formatMoney(ZERO);

    return (
      <View style={{ gap: theme.spacing.sm }}>
        <View style={{ gap: theme.spacing.xxs }}>
          <Text variant="caption" tone="muted">
            {t('transactions.totalIncome', { defaultValue: 'Total income' })}
          </Text>
          <Money
            amount={incomeAmount}
            currency={currency}
            type={TransactionType.INCOME}
            showSign={false}
            formatOptions={{ signDisplay: 'never' }}
            variant="heading"
            weight="bold"
          />
        </View>

        <View
          style={{
            gap: theme.spacing.xs,
            paddingTop: theme.spacing.sm,
            borderTopWidth: theme.borderWidth.thin,
            borderTopColor: theme.colors.border,
          }}
        >
          <View className="flex-row justify-between">
            <Text variant="label" tone="muted">
              {t('transactions.transactions', { defaultValue: 'Transactions' })}
            </Text>
            <Text variant="label">{curTransactions.length}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text variant="label" tone="muted">
              {t('transactions.averageIncome', { defaultValue: 'Average income' })}
            </Text>
            <Money amount={avg} currency={currency} showSign={false} formatOptions={{ signDisplay: 'never' }} variant="label" />
          </View>
        </View>
      </View>
    );
  }

  const uniqueAccounts = new Set(
    curTransactions.flatMap((t) => {
      const accs = [];
      if (t.fromAccount) accs.push(t.fromAccount.id);
      if (t.toAccount) accs.push(t.toAccount.id);
      return accs;
    })
  ).size;

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={{ gap: theme.spacing.xxs }}>
        <Text variant="caption" tone="muted">
          {t('transactions.totalTransferred', { defaultValue: 'Total transfers' })}
        </Text>
        <Money
          amount={transferAmount}
          currency={currency}
          showSign={false}
          formatOptions={{ signDisplay: 'never' }}
          variant="heading"
          weight="bold"
          style={{ color: theme.colors.transfer }}
        />
      </View>

      <View
        style={{
          gap: theme.spacing.xs,
          paddingTop: theme.spacing.sm,
          borderTopWidth: theme.borderWidth.thin,
          borderTopColor: theme.colors.border,
        }}
      >
        <View className="flex-row justify-between">
          <Text variant="label" tone="muted">
            {t('transactions.transfers', { defaultValue: 'Transfers' })}
          </Text>
          <Text variant="label">{curTransactions.length}</Text>
        </View>
        <View className="flex-row justify-between">
          <Text variant="label" tone="muted">
            {t('transactions.accountsInvolved', { defaultValue: 'Accounts involved' })}
          </Text>
          <Text variant="label">{uniqueAccounts}</Text>
        </View>
      </View>
    </View>
  );
}
