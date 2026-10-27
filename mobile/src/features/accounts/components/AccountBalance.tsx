import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { AccountResponse } from '@sora/contracts';

import { Money, Text, type MoneyProps } from '@/components';
import { useTheme } from '@/app/providers';
import { cardBalanceOf } from '../accountBalance.ts';

/** An account's balance as it is read: a credit card in debt as the amount owed, labelled, never as a minus. */
export function AccountBalance({
  account,
  ...moneyProps
}: { account: Pick<AccountResponse, 'type' | 'balance' | 'currency'> } & Omit<MoneyProps, 'amount' | 'currency'>) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { amount, owed } = cardBalanceOf(account);
  const money = <Money amount={amount} currency={account.currency} {...moneyProps} />;
  if (!owed) return money;

  return (
    <View className="flex-row items-baseline" style={{ gap: theme.spacing.xs }}>
      <Text variant="caption" tone="muted">
        {t('accounts.owed')}
      </Text>
      {money}
    </View>
  );
}
