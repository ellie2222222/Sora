import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { MemberSpendSlice } from '@sora/contracts';

import { amountInCurrency, largestCurrencyTotal, maxOf, parseMoney, percentageOf, ZERO } from '@sora/contracts';

import { Money, ProgressBar, SectionLabel, Text } from '@/components';
import { useTheme } from '@/app/providers';

export interface MemberSplitProps {
  members: MemberSpendSlice[];
}

/**
 * Who spent what on a shared wallet. Renders nothing for a single member, where "you: 100%" is noise;
 * gated on the data rather than a members query, so it costs no extra request.
 */
export function MemberSplit({ members }: MemberSplitProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  if (members.length < 2) return null;

  // Bars compare members in one currency, against the biggest spender in it rather than a cross-member
  // sum: members can record in different currencies, and no figure may mix them (BR-07).
  const currency = largestCurrencyTotal(members.flatMap((member) => member.expense))?.currency;
  const leader = currency === undefined ? ZERO : members.reduce((max, member) => maxOf(max, amountInCurrency(member.expense, currency)), ZERO);

  return (
    <View style={{ gap: theme.spacing.sm }} testID="dashboard-member-split">
      <SectionLabel>{t('dashboard.whoSpentWhat')}</SectionLabel>

      {members.map((member) => {
        // A member who spent only in another currency still shows that figure, but no bar: it shares no scale.
        const expense = member.expense.find((total) => total.currency === currency) ?? largestCurrencyTotal(member.expense);
        const income = member.income.find((total) => total.currency === currency) ?? largestCurrencyTotal(member.income);
        const relative = expense === undefined || expense.currency !== currency ? 0 : percentageOf(parseMoney(expense.amount), leader);

        return (
          <View key={member.userId} style={{ gap: theme.spacing.xxs }} testID={`dashboard-member-${member.userId}`}>
            <View className="flex-row items-center justify-between">
              <Text numberOfLines={1} style={{ flexShrink: 1 }}>
                {member.displayName}
              </Text>
              {expense !== undefined ? (
                <Money amount={expense.amount} currency={expense.currency} variant="caption" weight="semibold" />
              ) : (
                <Text variant="caption" tone="faint">
                  —
                </Text>
              )}
            </View>

            <ProgressBar percentage={Math.max(0, Math.min(100, relative))} tone="expense" height={theme.sizes.progressBar.sm} />

            {income !== undefined ? (
              <Text variant="caption" tone="muted">
                {t('dashboard.memberEarned')}{' '}
                <Money amount={income.amount} currency={income.currency} variant="caption" />
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
