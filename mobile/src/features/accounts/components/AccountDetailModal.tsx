import { ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Card, Money, Skeleton, StateView, Text } from '@/components';
import { useTheme } from '@/app/providers';
import { useGetAccountQuery } from '@/app/store';
import { isNetworkError } from '@/utils';
import type { AppStackScreenProps } from '@/app/navigation';

function AccountDetailSkeleton() {
  const theme = useTheme();
  return (
    <>
      <Card>
        <Skeleton width="40%" height={24} />
        <View style={{ marginTop: theme.spacing.xs }}>
          <Skeleton width="60%" height={32} />
        </View>
      </Card>

      <View className="flex-row" style={{ gap: theme.spacing.md }}>
        <Card style={{ flex: 1 }}>
          <Skeleton width="50%" height={16} />
          <View style={{ marginTop: theme.spacing.xs }}>
            <Skeleton width="80%" height={24} />
          </View>
        </Card>
        <Card style={{ flex: 1 }}>
          <Skeleton width="50%" height={16} />
          <View style={{ marginTop: theme.spacing.xs }}>
            <Skeleton width="80%" height={24} />
          </View>
        </Card>
      </View>

      <View className="flex-row" style={{ gap: theme.spacing.md }}>
        <Card style={{ flex: 1 }}>
          <Skeleton width="50%" height={16} />
          <View style={{ marginTop: theme.spacing.xs }}>
            <Skeleton width="70%" height={20} />
          </View>
        </Card>
        <Card style={{ flex: 1 }}>
          <Skeleton width="50%" height={16} />
          <View style={{ marginTop: theme.spacing.xs }}>
            <Skeleton width="70%" height={20} />
          </View>
        </Card>
      </View>

      <Skeleton width="40%" height={20} />
    </>
  );
}

export function AccountDetailScreen({ route, navigation }: AppStackScreenProps<'AccountDetail'>) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { accountId } = route.params;

  const account = useGetAccountQuery(accountId);

  const renderContent = () => {
    if (account.isLoading) return <AccountDetailSkeleton />;
    if (account.isError && !isNetworkError(account.error)) {
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

        <View className="flex-row" style={{ gap: theme.spacing.md }}>
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

        <View className="flex-row" style={{ gap: theme.spacing.md }}>
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
