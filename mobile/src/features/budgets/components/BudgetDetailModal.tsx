import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { BudgetStatus } from '@sora/contracts';
import { BottomSheetModal, Card, Money, ProgressBar, Skeleton, StateView, Text } from '@/components';
import { useTheme, useWallets } from '@/app/providers';
import { useGetBudgetQuery } from '@/app/store';
import { isNetworkError } from '@/utils';
import { ArchiveBudgetDialog } from './ArchiveBudgetDialog.tsx';
import { BudgetEditCard } from './BudgetEditCard.tsx';

export interface BudgetDetailModalProps {
  budgetId: string | null;
  onClose: () => void;
}

function BudgetDetailSkeleton() {
  const theme = useTheme();
  return (
    <Card>
      <View style={{ marginBottom: theme.spacing.xs }}><Skeleton width="40%" height={theme.sizes.skeletonLine.heading} radius={theme.radius.sm}  /></View>
      <View style={{ marginBottom: theme.spacing.sm }}><Skeleton width="60%" height={theme.sizes.skeletonLine.body} radius={theme.radius.sm}  /></View>

      <Skeleton width="100%" height={theme.sizes.progressBar.lg} radius={theme.radius.pill} />

      <View className="flex-row justify-between" style={{ marginTop: theme.spacing.md }}>
        <View>
          <View style={{ marginBottom: theme.spacing.xs }}><Skeleton width={theme.sizes.skeletonWidth.xs} height={theme.sizes.skeletonLine.label} radius={theme.radius.sm}  /></View>
          <Skeleton width={theme.sizes.skeletonWidth.md} height={theme.sizes.skeletonLine.heading} radius={theme.radius.sm} />
        </View>
        <View className="items-end">
          <View style={{ marginBottom: theme.spacing.xs }}><Skeleton width={theme.sizes.skeletonWidth.sm} height={theme.sizes.skeletonLine.label} radius={theme.radius.sm}  /></View>
          <Skeleton width={theme.sizes.skeletonWidth.md} height={theme.sizes.skeletonLine.heading} radius={theme.radius.sm} />
        </View>
      </View>

      <View className="flex-row" style={{ gap: theme.spacing.xs, marginTop: theme.spacing.sm }}>
        <Skeleton width={theme.sizes.skeletonWidth.sm} height={theme.sizes.skeletonLine.label} radius={theme.radius.sm} />
        <Skeleton width={theme.sizes.skeletonWidth.md} height={theme.sizes.skeletonLine.label} radius={theme.radius.sm} />
      </View>
    </Card>
  );
}

export function BudgetDetailModal({ budgetId, onClose }: BudgetDetailModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { permissions, isLoading: walletsLoading } = useWallets();

  const budget = useGetBudgetQuery(budgetId as string, { skip: !budgetId });

  const [archiving, setArchiving] = useState(false);
  // Tagged with its budget: the sheet stays mounted, and one budget's failure must not show on the next.
  const [archiveError, setArchiveError] = useState<{ budgetId: string; message: string } | null>(null);

  const renderContent = () => {
    if (budget.isLoading || walletsLoading) return <BudgetDetailSkeleton />;
    if (budget.isError && !isNetworkError(budget.error)) {
      return <StateView variant="error" error={budget.error} retryAction={() => void budget.refetch()} />;
    }

    const data = budget.data;
    if (data === undefined) {
      return <StateView variant="error" error={new Error(t('budgets.budgetNotFound', 'Budget not found'))} />;
    }

    const canEdit = permissions.canWrite && data.status === BudgetStatus.ACTIVE;

    return (
      <>
        <Card>
          <Text variant="title">{data.name}</Text>
          <Text tone="muted" style={{ marginBottom: theme.spacing.sm }}>
            {data.category?.name ?? t('budgets.overall', { defaultValue: 'Overall' })} · {t('budgets.dateRange', { start: data.startDate, end: data.endDate })}
          </Text>

          <ProgressBar percentage={data.usagePercentage} danger={data.isOverBudget} height={theme.sizes.progressBar.lg} />

          <View className="flex-row justify-between" style={{ marginTop: theme.spacing.md }}>
            <View>
              <Text variant="label" tone="muted">
                {t('budgets.spent', 'Spent')}
              </Text>
              <Money amount={data.spent} currency={data.currency} variant="title" />
            </View>
            <View className="items-end">
              <Text variant="label" tone="muted">
                {data.isOverBudget ? t('budgets.overBy', 'Over by') : t('budgets.remaining', 'Remaining')}
              </Text>
              <Money amount={data.remaining} currency={data.currency} variant="title" />
            </View>
          </View>

          <View className="flex-row" style={{ gap: theme.spacing.xs, marginTop: theme.spacing.sm }}>
            <Text variant="caption" tone="muted">
              {t('budgets.planned', 'Planned:')}
            </Text>
            <Money amount={data.amount} currency={data.currency} variant="caption" />
          </View>

          {data.status === BudgetStatus.ARCHIVED ? (
            <Text tone="muted" weight="semibold" style={{ marginTop: theme.spacing.sm }}>
              {t('common.archived', 'Archived')}
            </Text>
          ) : null}
        </Card>

        {canEdit ? (
          <BudgetEditCard
            key={data.id}
            budget={data}
            archiveError={archiveError?.budgetId === data.id ? archiveError.message : null}
            onArchive={() => {
              setArchiveError(null);
              setArchiving(true);
            }}
          />
        ) : null}
      </>
    );
  };

  return (
    <BottomSheetModal
      visible={budgetId !== null}
      onClose={onClose}
      title={t('budgets.detailTitle', 'Budget detail')}
      testID="budget-detail-modal"
    >
      {/* Scrolls so Save stays reachable above the docked amount keypad. */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.md }}
      >
        {renderContent()}
      </ScrollView>
      <ArchiveBudgetDialog
        budgetId={archiving ? budgetId : null}
        onCancel={() => setArchiving(false)}
        onArchived={() => {
          setArchiving(false);
          onClose();
        }}
        onError={(message) => {
          setArchiving(false);
          if (budgetId !== null) setArchiveError({ budgetId, message });
        }}
      />
    </BottomSheetModal>
  );
}
