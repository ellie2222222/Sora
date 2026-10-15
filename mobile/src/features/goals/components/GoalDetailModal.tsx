import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react-native';
import { FlatList, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { GoalStatus, type ContributionResponse } from '@sora/contracts';

import { useModal, useTheme, useToast, useWallets } from '@/app/providers';
import { BottomSheetModal, Button, Card, ListLoadMoreFooter, Money, ProgressBar, Skeleton, StateView, Text } from '@/components';
import { useGetGoalQuery, useListGoalContributionsInfiniteQuery } from '@/app/store';
import { canLoadMore, dayOfInstant, flattenPages, formatDay, isNetworkError, currentView } from '@/utils';
import { CancelGoalDialog } from './CancelGoalDialog.tsx';
import { GoalEditCard } from './GoalEditCard.tsx';

export interface GoalDetailModalProps {
  goalId: string | null;
  onClose: () => void;
}

export function GoalDetailModal({ goalId, onClose }: GoalDetailModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { openModal } = useModal();
  const { permissions, isLoading: walletsLoading, wallets, timeZone: activeTimeZone } = useWallets();
  const { showToast } = useToast();
  const [cancelling, setCancelling] = useState(false);
  const goal = useGetGoalQuery(goalId as string, { skip: !goalId });
  const shownGoal = currentView(goal, goalId !== null);
  const timeZone = wallets.find((wallet) => wallet.id === shownGoal.data?.walletId)?.timeZone ?? activeTimeZone;
  const contributions = useListGoalContributionsInfiniteQuery(goalId as string, { skip: !goalId });
  const shownContributions = currentView(contributions, goalId !== null);
  const contributionItems = useMemo(() => flattenPages(shownContributions.data?.pages), [shownContributions.data]);

  const renderContent = () => {
    if (shownGoal.loading || walletsLoading) {
      return <GoalDetailSkeleton />;
    }
    if (goal.isError && !isNetworkError(goal.error)) {
      return (
        <View style={{ padding: theme.spacing.md }}>
          <StateView variant="error" error={goal.error} retryAction={() => void goal.refetch()} />
        </View>
      );
    }

    const data = shownGoal.data;
    if (data === undefined) {
      return (
        <View style={{ padding: theme.spacing.md }}>
          <StateView variant="error" error={new Error(t('goals.goalNotFound', "Couldn't find this goal"))} />
        </View>
      );
    }

    const canEdit = permissions.canWrite && data.status === GoalStatus.ACTIVE;

    return (
      <FlatList<ContributionResponse>
        testID="screen-goal-detail"
        data={contributionItems}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: theme.spacing.md, gap: theme.spacing.sm }}
        ListHeaderComponent={
          <>
            {canEdit ? <GoalEditCard key={data.id} goal={data} onCancelGoal={() => setCancelling(true)} /> : null}
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
                <Money amount={data.targetAmount} currency={data.currency} variant="heading" style={{ opacity: theme.opacity.muted }} />
              </View>

              <ProgressBar percentage={data.progressPercentage} tone="income" height={theme.sizes.progressBar.lg} />

              <View className="flex-row justify-between" style={{ marginTop: theme.spacing.sm }}>
                <Money amount={data.remaining} currency={data.currency} variant="caption" />
                {data.targetDate !== null ? (
                  <Text variant="caption" tone="muted">
                    {t('goals.target', 'Target')}: {formatDay(data.targetDate)}
                  </Text>
                ) : null}
              </View>

              {permissions.canWrite ? (
                <Button
                  testID="btn-add-contribution"
                  label={t('goals.addContribution', 'Add contribution')}
                  icon={Plus}
                  variant="secondary"
                  size="sm"
                  onPress={() => openModal('AddContribution', { goalId: goalId as string, parent: { onClose } })}
                  style={{ marginTop: theme.spacing.md }}
                />
              ) : null}

              <Text variant="label" tone="muted" style={{ marginTop: theme.spacing.lg }}>
                {t('goals.contributionHistory', 'Contribution history')}
              </Text>
            </Card>
          </>
        }
        ListEmptyComponent={
          shownContributions.loading ? null : contributions.isError ? (
            <StateView variant="error" error={contributions.error} retryAction={() => void contributions.refetch()} />
          ) : (
            <Text tone="faint">{t('goals.noContributionsYet', 'No contributions yet.')}</Text>
          )
        }
        renderItem={({ item }) => <ContributionItem contribution={item} timeZone={timeZone} />}
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
    <BottomSheetModal visible={goalId !== null} onClose={onClose} title={t('goals.detailTitle', 'Goal')}>
      <View style={{ flex: 1, minHeight: theme.sizes.sheetBodyMinHeight }}>
        {renderContent()}
      </View>
      <CancelGoalDialog
        goalId={cancelling ? goalId : null}
        onCancel={() => setCancelling(false)}
        onCancelled={() => {
          setCancelling(false);
          onClose();
        }}
        onError={(message) => {
          setCancelling(false);
          showToast(message, 'error');
        }}
      />
    </BottomSheetModal>
  );
}

function ContributionItem({ contribution, timeZone }: { contribution: ContributionResponse; timeZone: string }) {
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
          {formatDay(dayOfInstant(contribution.contributionDate, timeZone))}
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
        <Skeleton width={theme.sizes.skeletonWidth.xxl} height={theme.sizes.skeletonLine.title} />
        <View style={{ marginTop: theme.spacing.xs }}>
          <Skeleton width="80%" height={theme.sizes.skeletonLine.body} />
        </View>

        <View className="flex-row" style={{ gap: theme.spacing.xs, marginTop: theme.spacing.md }}>
          <Skeleton width={theme.sizes.skeletonWidth.xl} height={theme.sizes.skeletonLine.display} />
          <Skeleton width={theme.sizes.skeletonWidth.xxs} height={theme.sizes.skeletonLine.display} />
          <Skeleton width={theme.sizes.skeletonWidth.md} height={theme.sizes.skeletonLine.display} />
        </View>

        <View style={{ marginTop: theme.spacing.sm }}>
          <Skeleton width="100%" height={theme.sizes.progressBar.lg} radius={theme.radius.pill} />
        </View>

        <View className="flex-row justify-between" style={{ marginTop: theme.spacing.sm }}>
          <Skeleton width={theme.sizes.skeletonWidth.md} height={theme.sizes.skeletonLine.caption} />
          <Skeleton width={theme.sizes.skeletonWidth.lg} height={theme.sizes.skeletonLine.caption} />
        </View>

        <View
          className="flex-row items-center self-start"
          style={{
            gap: theme.spacing.xs,
            marginTop: theme.spacing.md,
          }}
        >
          <Skeleton width={theme.iconSize.md} height={theme.iconSize.md} radius={theme.radius.pill} />
          <Skeleton width={theme.sizes.skeletonWidth.lg} height={theme.sizes.skeletonLine.body} />
        </View>

        <View style={{ marginTop: theme.spacing.lg }}>
          <Skeleton width={theme.sizes.skeletonWidth.xl} height={theme.sizes.skeletonLine.label} />
        </View>
      </Card>

      {Array.from({ length: 4 }).map((_, i) => (
        <View
          key={i}
          className="flex-row justify-between"
          style={{ paddingVertical: theme.spacing.xs }}
        >
          <View style={{ gap: theme.spacing.xs }}>
            <Skeleton width={theme.sizes.skeletonWidth.lg} height={theme.sizes.skeletonLine.body} />
            <Skeleton width={theme.sizes.skeletonWidth.xxl} height={theme.sizes.skeletonLine.caption} />
          </View>
          <Skeleton width={theme.sizes.skeletonWidth.sm} height={theme.sizes.skeletonLine.body} />
        </View>
      ))}
    </View>
  );
}
