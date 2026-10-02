import { useMemo } from 'react';
import { Plus } from 'lucide-react-native';
import { FlatList, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { ContributionResponse } from '@sora/contracts';

import { useModal, useTheme, useWallets } from '@/app/providers';
import { BottomSheetModal, Card, ListLoadMoreFooter, Money, ProgressBar, Skeleton, StateView, Text } from '@/components';
import { useGetGoalQuery, useListGoalContributionsInfiniteQuery } from '@/app/store';
import { canLoadMore, flattenPages, formatDay, isNetworkError } from '@/utils';

export interface GoalDetailModalProps {
  goalId: string | null;
  onClose: () => void;
}

export function GoalDetailModal({ goalId, onClose }: GoalDetailModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { openModal } = useModal();
  const { permissions, isLoading: walletsLoading } = useWallets();
  const goal = useGetGoalQuery(goalId as string, { skip: !goalId });
  const contributions = useListGoalContributionsInfiniteQuery(goalId as string, { skip: !goalId });
  const contributionItems = useMemo(() => flattenPages(contributions.data?.pages), [contributions.data]);

  const renderContent = () => {
    if (goal.isLoading || walletsLoading) {
      return <GoalDetailSkeleton />;
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
                onPress={() => openModal('AddContribution', { goalId: goalId as string })}
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
        renderItem={({ item }) => <ContributionItem contribution={item} />}
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
    <BottomSheetModal visible={goalId !== null} onClose={onClose} title={t('goals.detailTitle', 'Goal Details')}>
      <View style={{ flex: 1, minHeight: 400 }}>
        {renderContent()}
      </View>
    </BottomSheetModal>
  );
}

function ContributionItem({ contribution }: { contribution: ContributionResponse }) {
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

function GoalDetailSkeleton() {
  const theme = useTheme();

  return (
    <View style={{ padding: theme.spacing.md, gap: theme.spacing.sm }}>
      <Card style={{ marginBottom: theme.spacing.md }}>
        <Skeleton width={150} height={24} />
        <View style={{ marginTop: theme.spacing.xs }}>
          <Skeleton width="80%" height={16} />
        </View>

        <View className="flex-row" style={{ gap: theme.spacing.xs, marginTop: theme.spacing.md }}>
          <Skeleton width={120} height={32} />
          <Skeleton width={20} height={32} />
          <Skeleton width={80} height={32} />
        </View>

        <View style={{ marginTop: theme.spacing.sm }}>
          <Skeleton width="100%" height={10} radius={5} />
        </View>

        <View className="flex-row justify-between" style={{ marginTop: theme.spacing.sm }}>
          <Skeleton width={80} height={16} />
          <Skeleton width={100} height={16} />
        </View>

        <View
          className="flex-row items-center self-start"
          style={{
            gap: theme.spacing.xs,
            marginTop: theme.spacing.md,
          }}
        >
          <Skeleton width={16} height={16} radius={8} />
          <Skeleton width={100} height={16} />
        </View>

        <View style={{ marginTop: theme.spacing.lg }}>
          <Skeleton width={120} height={16} />
        </View>
      </Card>

      {Array.from({ length: 4 }).map((_, i) => (
        <View
          key={i}
          className="flex-row justify-between"
          style={{ paddingVertical: theme.spacing.xs }}
        >
          <View style={{ gap: theme.spacing.xs }}>
            <Skeleton width={100} height={16} />
            <Skeleton width={140} height={14} />
          </View>
          <Skeleton width={60} height={16} />
        </View>
      ))}
    </View>
  );
}
