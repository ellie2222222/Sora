import { useMemo } from 'react';
import { Plus } from 'lucide-react-native';
import { FlatList, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { ContributionResponse } from '@sora/contracts';

import { useModal, useTheme, useWallets } from '@/app/providers';
import { Card, ListLoadMoreFooter, Money, ProgressBar, SkeletonList, StateView, Text } from '@/components';
import { useGetGoalQuery, useListGoalContributionsInfiniteQuery } from '@/app/store';
import { canLoadMore, flattenPages, formatDay, isNetworkError } from '@/utils';
import type { AppStackScreenProps } from '@/app/navigation';

export function GoalDetailScreen({ route, navigation: _navigation }: AppStackScreenProps<'GoalDetail'>) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { openModal } = useModal();
  const { goalId } = route.params;
  const { permissions, isLoading: walletsLoading } = useWallets();

  const goal = useGetGoalQuery(goalId);
  const contributions = useListGoalContributionsInfiniteQuery(goalId);
  const contributionItems = useMemo(() => flattenPages(contributions.data?.pages), [contributions.data]);

  const renderContent = () => {
    if (goal.isLoading || walletsLoading) {
      return (
        <View style={{ padding: theme.spacing.md }}>
          <SkeletonList rows={4} />
        </View>
      );
    }
    if (goal.isError && !isNetworkError(goal.error)) {
      return (
        <View style={{ padding: theme.spacing.md }}>
          <StateView variant="error" error={goal.error} retryAction={() => void goal.refetch()} />
        </View>
      );
    }

    const data = goal.data;
    if (data === undefined) {
      return (
        <View style={{ padding: theme.spacing.md }}>
          <StateView variant="error" error={new Error(t('goals.goalNotFound', 'Goal not found'))} />
        </View>
      );
    }

    return (
      <FlatList<ContributionResponse>
        testID="screen-goal-detail"
        data={contributionItems}
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

            <View className="flex-row" style={{ gap: theme.spacing.xs, marginTop: theme.spacing.md }}>
              <Money amount={data.currentAmount} currency={data.currency} variant="heading" />
              <Text variant="heading" tone="muted">
                /
              </Text>
              <Money amount={data.targetAmount} currency={data.currency} variant="heading" style={{ opacity: 0.6 }} />
            </View>

            <ProgressBar percentage={data.progressPercentage} tone="income" height={10} />

            <View className="flex-row justify-between" style={{ marginTop: theme.spacing.sm }}>
              <Money amount={data.remaining} currency={data.currency} variant="caption" />
              {data.targetDate !== null ? (
                <Text variant="caption" tone="muted">
                  {t('goals.target', 'Target')}: {formatDay(data.targetDate)}
                </Text>
              ) : null}
            </View>

            {permissions.canWrite ? (
              <Pressable
                testID="btn-add-contribution"
                onPress={() => openModal('AddContribution', { goalId })}
                className="flex-row items-center self-start"
                style={{
                  gap: theme.spacing.xs,
                  marginTop: theme.spacing.md,
                }}
              >
                <Plus size={16} color={theme.colors.primary} />
                <Text tone="default" weight="semibold">
                  {t('goals.addContribution', 'Add contribution')}
                </Text>
              </Pressable>
            ) : null}

            <Text variant="label" tone="muted" style={{ marginTop: theme.spacing.lg }}>
              {t('goals.contributionHistory', 'Contribution history')}
            </Text>
          </Card>
        }
        ListEmptyComponent={<Text tone="faint">{t('goals.noContributionsYet', 'No contributions yet.')}</Text>}
        renderItem={({ item }) => <ContributionRow contribution={item} />}
        onEndReached={() => {
          if (canLoadMore(contributions)) void contributions.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          <ListLoadMoreFooter
            isFetchingNextPage={contributions.isFetchingNextPage}
            hasNextPage={contributions.hasNextPage}
            isError={contributions.isError}
            onRetry={() => void contributions.fetchNextPage()}
            testID="goal-detail-contributions-footer"
          />
        }
      />
    );
  };

  return (
    <View className="flex-1" style={{ backgroundColor: theme.colors.background }}>
      {renderContent()}
    </View>
  );
}

function ContributionRow({ contribution }: { contribution: ContributionResponse }) {
  const theme = useTheme();

  return (
    <View
      className="flex-row justify-between"
      style={{
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
