import { ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Card, Money, StateView, Text } from '../../../components/index.ts';
import { SkeletonList } from '../../../components/Skeleton.tsx';
import { useTheme } from '../../../app/providers/ThemeProvider.tsx';
import { useGetAccountQuery } from '../../../app/store/api/accountsApi.ts';
import type { AppStackScreenProps } from '../../../app/navigation/types.ts';

export function AccountDetailScreen({ route, navigation }: AppStackScreenProps<'AccountDetail'>) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { accountId } = route.params;

  const account = useGetAccountQuery(accountId);

  const renderContent = () => {
    if (account.isLoading) return <SkeletonList rows={3} />;
    if (account.isError) {
      return <StateView variant="error" error={account.error} retryAction={() => void account.refetch()} />;
    }

    const data = account.data;
    if (data === undefined) {
      return <StateView variant="error" error={new Error(t('accounts.accountNotFound', 'Account not found'))} />;
    }

    return (
      <>
        <Card>
          <Text variant="title">{data.name}</Text>
          <Money amount={data.balance} currency={data.currency} variant="heading" style={{ marginTop: theme.spacing.xs }} />
        </Card>

        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <Card style={{ flex: 1 }}>
            <Text variant="label" tone="muted">
              {t('home.income')}
            </Text>
            <Money amount={data.totalIncome} currency={data.currency} type="INCOME" variant="title" />
          </Card>
          <Card style={{ flex: 1 }}>
            <Text variant="label" tone="muted">
              {t('home.expenses')}
            </Text>
            <Money amount={data.totalExpense} currency={data.currency} type="EXPENSE" variant="title" />
          </Card>
        </View>

        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <Card style={{ flex: 1 }}>
            <Text variant="label" tone="muted">
              {t('accounts.transferredIn')}
            </Text>
            <Money amount={data.transferredIn} currency={data.currency} variant="body" />
          </Card>
          <Card style={{ flex: 1 }}>
            <Text variant="label" tone="muted">
              {t('accounts.transferredOut')}
            </Text>
            <Money amount={data.transferredOut} currency={data.currency} variant="body" />
          </Card>
        </View>

        <Text
          tone="muted"
          onPress={() => navigation.navigate('Transactions', { accountId })}
        >
          {t('accounts.viewTransactions', { count: data.transactionCount })}
        </Text>
      </>
    );
  };

  return (
    <ScrollView contentContainerStyle={{ padding: theme.spacing.md, gap: theme.spacing.md }}>
      {renderContent()}
    </ScrollView>
  );
}
