import { ScrollView, View } from 'react-native';

import { Card, ErrorState, Money, Text } from '../../../components/index.ts';
import { SkeletonList } from '../../../components/Skeleton.tsx';
import { useTheme } from '../../../app/providers/ThemeProvider.tsx';
import { useAccount } from '../hooks/useAccounts.ts';
import type { AppStackScreenProps } from '../../../app/navigation/types.ts';

export function AccountDetailScreen({ route, navigation }: AppStackScreenProps<'AccountDetail'>) {
  const theme = useTheme();
  const { accountId } = route.params;

  const account = useAccount(accountId);

  if (account.isLoading) return <SkeletonList rows={3} />;
  if (account.isError) return <ErrorState error={account.error} onRetry={() => void account.refetch()} />;

  const data = account.data;
  if (data === undefined) return null;

  return (
    <ScrollView contentContainerStyle={{ padding: theme.spacing.md, gap: theme.spacing.md }}>
      <Card>
        <Text variant="title">{data.name}</Text>
        <Money amount={data.balance} currency={data.currency} variant="heading" style={{ marginTop: theme.spacing.xs }} />
      </Card>

      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        <Card style={{ flex: 1 }}>
          <Text variant="label" tone="muted">
            Income
          </Text>
          <Money amount={data.totalIncome} currency={data.currency} type="INCOME" variant="title" />
        </Card>
        <Card style={{ flex: 1 }}>
          <Text variant="label" tone="muted">
            Expenses
          </Text>
          <Money amount={data.totalExpense} currency={data.currency} type="EXPENSE" variant="title" />
        </Card>
      </View>

      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        <Card style={{ flex: 1 }}>
          <Text variant="label" tone="muted">
            Transferred in
          </Text>
          <Money amount={data.transferredIn} currency={data.currency} variant="body" />
        </Card>
        <Card style={{ flex: 1 }}>
          <Text variant="label" tone="muted">
            Transferred out
          </Text>
          <Money amount={data.transferredOut} currency={data.currency} variant="body" />
        </Card>
      </View>

      <Text
        tone="muted"
        onPress={() =>
          navigation.navigate('Main', { screen: 'Transactions', params: { accountId } })
        }
      >
        View {data.transactionCount} transaction{data.transactionCount === 1 ? '' : 's'} →
      </Text>
    </ScrollView>
  );
}
