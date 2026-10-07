import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutAnimation, View } from 'react-native';
import { formatMoney, parseMoney, subtract, TransactionType, ZERO, type TransactionResponse } from '@sora/contracts';

import { useTheme } from '@/app/providers';
import { sumByTransactionType } from '@/utils';
import { Card } from './Card.tsx';
import { Money } from './Money.tsx';
import { Text } from './Text.tsx';

export interface PeriodSummaryCardProps {
  transactions: readonly TransactionResponse[];
  filterType?: 'ALL' | TransactionType;
  testID?: string;
}

/**
 * One block per currency present in the period. Expenses is the headline
 * figure (large, unsigned) since that's what a user scanning this screen
 * wants first; income and net cash flow sit below as secondary rows, so the
 * period, day-heading, and per-transaction totals each read as one number
 * instead of competing ones.
 */
export function PeriodSummaryCard({ transactions, filterType = 'ALL', testID }: PeriodSummaryCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, [filterType]);

  const income = sumByTransactionType(transactions, 'INCOME');
  const expense = sumByTransactionType(transactions, 'EXPENSE');
  const transfer = sumByTransactionType(transactions, 'TRANSFER');

  const allCurrencies = new Set<string>();
  if (filterType === 'ALL' || filterType === TransactionType.INCOME) income.forEach((c) => allCurrencies.add(c.currency));
  if (filterType === 'ALL' || filterType === TransactionType.EXPENSE) expense.forEach((c) => allCurrencies.add(c.currency));
  if (filterType === TransactionType.TRANSFER) transfer.forEach((c) => allCurrencies.add(c.currency));

  if (allCurrencies.size === 0) return null;

  const currencies = Array.from(allCurrencies);

  return (
    <Card elevated testID={testID} style={{ gap: theme.spacing.md }}>
      {currencies.map((currency) => {
        const incomeAmount = income.find((c) => c.currency === currency)?.amount ?? formatMoney(ZERO);
        const expenseAmount = expense.find((c) => c.currency === currency)?.amount ?? formatMoney(ZERO);
        const transferAmount = transfer.find((c) => c.currency === currency)?.amount ?? formatMoney(ZERO);
        const netAmount = formatMoney(subtract(parseMoney(incomeAmount), parseMoney(expenseAmount)));
        
        const curTransactions = transactions.filter(t => t.currency === currency);

        if (filterType === 'ALL') {
          return (
            <View key={currency} style={{ gap: theme.spacing.sm }}>
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
            ? formatMoney(parseMoney(expenseAmount) / BigInt(curTransactions.length))
            : formatMoney(ZERO);

          return (
            <View key={currency} style={{ gap: theme.spacing.sm }}>
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
            ? formatMoney(parseMoney(incomeAmount) / BigInt(curTransactions.length))
            : formatMoney(ZERO);

          return (
            <View key={currency} style={{ gap: theme.spacing.sm }}>
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

        if (filterType === TransactionType.TRANSFER) {
          const uniqueAccounts = new Set(
            curTransactions.flatMap((t) => {
              const accs = [];
              if (t.fromAccount) accs.push(t.fromAccount.id);
              if (t.toAccount) accs.push(t.toAccount.id);
              return accs;
            })
          ).size;

          return (
            <View key={currency} style={{ gap: theme.spacing.sm }}>
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

        return null;
      })}
    </Card>
  );
}
