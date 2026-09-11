import { View } from 'react-native';
import { formatMoney } from '@sora/contracts';
import type { CurrencyTotal, TransactionResponse } from '@sora/contracts';

import { useTheme } from '../app/providers/ThemeProvider.tsx';
import type { DayGroup } from '../utils/groupByDate.ts';
import { formatDayHeading } from '../utils/date.ts';
import { sumScaledByKey } from '../utils/money.ts';
import { Money } from './Money.tsx';
import { Text } from './Text.tsx';
import { TransactionRow } from './TransactionRow.tsx';

export interface TransactionListSectionProps {
  groups: DayGroup[];
  /** Shows a per-currency income/expense total next to each day's heading. */
  showDayTotals?: boolean;
}

/** Renders `groupTransactionsByDay`'s output as flat, divider-separated sections rather than one Card per transaction. */
export function TransactionListSection({ groups, showDayTotals = false }: TransactionListSectionProps) {
  const theme = useTheme();

  return (
    <View>
      {groups.map((group, index) => (
        <View key={group.day} style={{ marginTop: index === 0 ? 0 : theme.spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text variant="label" tone="muted">
              {formatDayHeading(group.day)}
            </Text>
            {showDayTotals ? <DayTotals transactions={group.transactions} /> : null}
          </View>
          <View
            style={{
              marginTop: theme.spacing.xs,
              borderTopWidth: 1,
              borderTopColor: theme.colors.border,
            }}
          >
            {group.transactions.map((transaction, rowIndex) => (
              <View
                key={transaction.id}
                style={
                  rowIndex === 0
                    ? undefined
                    : { borderTopWidth: 1, borderTopColor: theme.colors.border }
                }
              >
                <TransactionRow transaction={transaction} testID={`transaction-row-${transaction.id}`} />
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function DayTotals({ transactions }: { transactions: TransactionResponse[] }) {
  const theme = useTheme();
  const expense = sumByType(transactions, 'EXPENSE');
  if (expense.length === 0) return null;
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {expense.map((total) => (
        <Money
          key={total.currency}
          amount={total.amount}
          currency={total.currency}
          variant="caption"
          style={{ color: theme.colors.textMuted }}
        />
      ))}
    </View>
  );
}

/**
 * Per-currency totals, so a multi-currency wallet never sums across
 * currencies (BR-07); transfers are excluded (BR-06 — neither income nor
 * expense).
 */
function sumByType(transactions: TransactionResponse[], type: 'INCOME' | 'EXPENSE'): CurrencyTotal[] {
  const byCurrency = sumScaledByKey(
    transactions.filter((transaction) => transaction.type === type),
    (transaction) => transaction.currency,
    (transaction) => transaction.amount,
  );
  return Array.from(byCurrency, ([currency, amount]) => ({ currency, amount: formatMoney(amount) }));
}
