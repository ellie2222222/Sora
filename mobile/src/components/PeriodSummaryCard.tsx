import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { formatMoney, parseMoney, subtract, TransactionType, ZERO, type TransactionResponse } from '@sora/contracts';

import { useTheme } from '@/app/providers';
import { sumByTransactionType } from '@/utils';
import { Card } from './Card.tsx';
import { Money } from './Money.tsx';
import { Text } from './Text.tsx';

export interface PeriodSummaryCardProps {
  transactions: readonly TransactionResponse[];
  testID?: string;
}

/**
 * One block per currency present in the period. Expenses is the headline
 * figure (large, unsigned) since that's what a user scanning this screen
 * wants first; income and net cash flow sit below as secondary rows, so the
 * period, day-heading, and per-transaction totals each read as one number
 * instead of competing ones.
 */
export function PeriodSummaryCard({ transactions, testID }: PeriodSummaryCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const income = sumByTransactionType(transactions, 'INCOME');
  const expense = sumByTransactionType(transactions, 'EXPENSE');
  if (income.length === 0 && expense.length === 0) return null;

  const currencies = Array.from(new Set([...income.map((c) => c.currency), ...expense.map((c) => c.currency)]));

  return (
    <Card elevated testID={testID} style={{ gap: theme.spacing.md }}>
      {currencies.map((currency) => {
        const incomeAmount = income.find((c) => c.currency === currency)?.amount ?? formatMoney(ZERO);
        const expenseAmount = expense.find((c) => c.currency === currency)?.amount ?? formatMoney(ZERO);
        const netAmount = formatMoney(subtract(parseMoney(incomeAmount), parseMoney(expenseAmount)));

        return (
          <View key={currency} style={{ gap: theme.spacing.sm }}>
            <View>
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

            <View
              style={{
                gap: theme.spacing.xs,
                paddingTop: theme.spacing.sm,
                borderTopWidth: 1,
                borderTopColor: theme.colors.border,
              }}
            >
              <View className="flex-row justify-between">
                <Text variant="label" tone="muted">
                  {t('transactions.incomeLabel', { defaultValue: 'Income' })}
                </Text>
                <Money
                  amount={incomeAmount}
                  currency={currency}
                  type={TransactionType.INCOME}
                  showSign={false}
                  formatOptions={{ signDisplay: 'never' }}
                  variant="label"
                />
              </View>
              <View className="flex-row justify-between">
                <Text variant="label" tone="muted">
                  {t('transactions.netCashFlow', { defaultValue: 'Net cash flow' })}
                </Text>
                {/* No `type` here: netAmount already carries its own sign (subtract can go
                    negative), so EXPENSE/INCOME would double-negate it via Money's own logic. */}
                <Money amount={netAmount} currency={currency} variant="label" weight="semibold" />
              </View>
            </View>
          </View>
        );
      })}
    </Card>
  );
}
