import { Plus } from 'lucide-react-native';
import { FlatList, Pressable, View } from 'react-native';
import type { ContributionResponse } from '@sora/contracts';

import { Card, ErrorState, Money, ProgressBar, Text } from '../../../components/index.ts';
import { SkeletonList } from '../../../components/Skeleton.tsx';
import { useTheme } from '../../../app/providers/ThemeProvider.tsx';
import { useWallets } from '../../../app/providers/WalletProvider.tsx';
import { useGetGoalQuery, useListGoalContributionsQuery } from '../../../app/store/api/goalsApi.ts';
import { formatDay } from '../../../utils/date.ts';
import type { AppStackScreenProps } from '../../../app/navigation/types.ts';

export function GoalDetailScreen({ route, navigation }: AppStackScreenProps<'GoalDetail'>) {
  const theme = useTheme();
  const { goalId } = route.params;
  const { permissions } = useWallets();

  const goal = useGetGoalQuery(goalId);
  const contributions = useListGoalContributionsQuery(goalId);

  if (goal.isLoading) return <SkeletonList rows={4} />;
  if (goal.isError) return <ErrorState error={goal.error} onRetry={() => void goal.refetch()} />;

  const data = goal.data;
  if (data === undefined) return null;

  return (
    <FlatList<ContributionResponse>
      testID="goal-detail"
      data={contributions.data ?? []}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: theme.spacing.md, gap: theme.spacing.sm }}
      ListHeaderComponent={
        <Card style={{ marginBottom: theme.spacing.md }}>
          <Text variant="title">{data.name}</Text>
          {data.description !== null ? (
            <Text tone="muted" style={{ marginTop: theme.spacing.xs }}>
              {data.description}
            </Text>
          ) : null}

          <View style={{ flexDirection: 'row', gap: theme.spacing.xs, marginTop: theme.spacing.md }}>
            <Money amount={data.currentAmount} currency={data.currency} variant="heading" />
            <Text variant="heading" tone="muted">
              /
            </Text>
            <Money amount={data.targetAmount} currency={data.currency} variant="heading" style={{ opacity: 0.6 }} />
          </View>

          <ProgressBar percentage={data.progressPercentage} tone="income" height={10} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: theme.spacing.sm }}>
            <Money amount={data.remaining} currency={data.currency} variant="caption" />
            {data.targetDate !== null ? (
              <Text variant="caption" tone="muted">
                Target: {formatDay(data.targetDate)}
              </Text>
            ) : null}
          </View>

          {permissions.canWrite ? (
            <Pressable
              testID="goal-detail-add-contribution"
              onPress={() => navigation.navigate('AddContribution', { goalId })}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.xs,
                marginTop: theme.spacing.md,
                alignSelf: 'flex-start',
              }}
            >
              <Plus size={16} color={theme.colors.primary} />
              <Text tone="default" weight="semibold">
                Add contribution
              </Text>
            </Pressable>
          ) : null}

          <Text variant="label" tone="muted" style={{ marginTop: theme.spacing.lg }}>
            Contribution history
          </Text>
        </Card>
      }
      ListEmptyComponent={<Text tone="faint">No contributions yet.</Text>}
      renderItem={({ item }) => <ContributionRow contribution={item} />}
    />
  );
}

function ContributionRow({ contribution }: { contribution: ContributionResponse }) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: theme.spacing.xs,
      }}
    >
      <View>
        <Text>{contribution.accountName}</Text>
        <Text variant="caption" tone="muted">
          {formatDay(contribution.contributionDate.slice(0, 10))}
          {contribution.note !== null ? ` · ${contribution.note}` : ''}
        </Text>
      </View>
      <Money amount={contribution.amount} currency={contribution.currency} weight="semibold" />
    </View>
  );
}
