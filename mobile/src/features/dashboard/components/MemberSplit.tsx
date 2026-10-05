import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { MemberSpendSlice } from '@sora/contracts';

import { parseMoney, percentageOf } from '@sora/contracts';

import { Money, ProgressBar, Text } from '@/components';
import { useTheme } from '@/app/providers';

export interface MemberSplitProps {
  members: MemberSpendSlice[];
}

/**
 * Who spent what on a shared wallet — the headline feature's own dashboard
 * reading.
 *
 * Renders nothing for a single member: "you: 100%" is noise on a solo wallet,
 * and this is gated on the data rather than on a separate members query so it
 * costs no extra request.
 */
export function MemberSplit({ members }: MemberSplitProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  if (members.length < 2) return null;

  // Shares are computed against the largest single member's expense rather than
  // a cross-member sum: members can record in different currencies, and adding
  // those together would produce a meaningless denominator (BR-07).
  const leader = parseMoney(members[0]?.expense[0]?.amount ?? '0.0000');

  return (
    <View style={{ gap: theme.spacing.sm }} testID="dashboard-member-split">
      <Text variant="label" tone="muted">
        {t('dashboard.whoSpentWhat')}
      </Text>

      {members.map((member) => {
        const expense = member.expense[0];
        const income = member.income[0];
        const relative = expense === undefined ? 0 : percentageOf(parseMoney(expense.amount), leader);

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
