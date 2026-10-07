import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react-native';
import { FlatList, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { GoalStatus, type ContributionResponse } from '@sora/contracts';

import { useModal, useTheme, useToast, useWallets } from '@/app/providers';
import { BottomSheetModal, Button, Card, closeOpenSwipeRow, ListLoadMoreFooter, MutationConfirmDialog, Money, ProgressBar, Skeleton, StateView, SwipeableRow, Text } from '@/components';
import { useGetGoalQuery, useListGoalContributionsInfiniteQuery, useRemoveContributionMutation } from '@/app/store';
import { canLoadMore, dayOfInstant, flattenPages, formatDay, isNetworkError } from '@/utils';
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
  const [removing, setRemoving] = useState<ContributionResponse | null>(null);
  const [removeContribution] = useRemoveContributionMutation();
  const goal = useGetGoalQuery(goalId as string, { skip: !goalId });
  const timeZone = wallets.find((wallet) => wallet.id === goal.data?.walletId)?.timeZone ?? activeTimeZone;
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
        ListEmptyComponent={<Text tone="faint">{t('goals.noContributionsYet', 'No contributions yet.')}</Text>}
        onScrollBeginDrag={closeOpenSwipeRow}
        renderItem={({ item }) => (
          <SwipeableRow
            backgroundColor={theme.colors.surfaceElevated}
            actions={
              permissions.canWrite
                ? [{ key: 'delete', label: t('common.delete'), icon: Trash2, tone: 'danger', onPress: () => setRemoving(item), testID: 'btn-delete-contribution' }]
                : []
            }
          >
            <ContributionItem contribution={item} timeZone={timeZone} onRemove={permissions.canWrite ? () => setRemoving(item) : undefined} />
          </SwipeableRow>
        )}
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
      <MutationConfirmDialog
        visible={removing !== null}
        title={t('goals.removeContributionTitle')}
        message={
          removing?.transactionId != null ? t('goals.removeContributionBacked') : t('goals.removeContributionEarmark')
        }
        confirmLabel={t('common.delete')}
        run={() => removeContribution({ goalId: removing!.goalId, contributionId: removing!.id }).unwrap()}
        onCancel={() => setRemoving(null)}
        onDone={() => setRemoving(null)}
        onError={(message) => {
          setRemoving(null);
          showToast(message, 'error');
        }}
      />
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

function ContributionItem({ contribution, timeZone, onRemove }: { contribution: ContributionResponse; timeZone: string; onRemove?: () => void }) {
  const theme = useTheme();
  const { t } = useTranslation();

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
      <View className="flex-row items-center" style={{ gap: theme.spacing.sm }}>
        <Money amount={contribution.amount} currency={contribution.currency} weight="semibold" />
        {onRemove !== undefined ? (
          <Pressable
            testID={`btn-delete-contribution-${contribution.id}`}
            accessibilityRole="button"
            accessibilityLabel={t('goals.deleteContribution')}
            hitSlop={(theme.sizes.touchTarget - theme.iconSize.md) / 2}
            onPress={onRemove}
          >
            <Trash2 size={theme.iconSize.md} color={theme.colors.textFaint} />
          </Pressable>
        ) : null}
      </View>
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
