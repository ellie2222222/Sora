import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatMoney, negate, parseMoney } from '@sora/contracts';

import { BottomSheetModal, Card, Money, ProgressBar, Skeleton, StateView, Text } from '@/components';
import { useTheme, useWallets } from '@/app/providers';
import { useGetBudgetQuery } from '@/app/store';
import { budgetPeriodLabel, isNetworkError } from '@/utils';
import { DeleteBudgetDialog } from './DeleteBudgetDialog.tsx';
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

  const [deleting, setDeleting] = useState(false);
  // Tagged with its budget: the sheet stays mounted, and one budget's failure must not show on the next.
  const [deleteError, setDeleteError] = useState<{ budgetId: string; message: string } | null>(null);

  const renderContent = () => {
    if (budget.isLoading || walletsLoading) return <BudgetDetailSkeleton />;
    if (budget.isError && !isNetworkError(budget.error)) {
      return <StateView variant="error" error={budget.error} retryAction={() => void budget.refetch()} />;
    }

    const data = budget.data;
    if (data === undefined) {
      return <StateView variant="error" error={new Error(t('budgets.budgetNotFound', "Couldn't find this budget"))} />;
    }

    const canEdit = permissions.canWrite;

    return (
      <>
        <Card>
          <Text variant="title">{data.name}</Text>
          <Text tone="muted" style={{ marginBottom: theme.spacing.sm }}>
            {data.category?.name ?? t('budgets.overall', { defaultValue: 'All expenses' })} · {budgetPeriodLabel(data)}
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
                {data.isOverBudget ? t('budgets.overBy', 'Over by') : t('budgets.remaining', 'Left')}
              </Text>
              {/* "Over by" already says which way, so the overspend shows as a plain amount. */}
              <Money amount={data.isOverBudget ? formatMoney(negate(parseMoney(data.remaining))) : data.remaining} currency={data.currency} variant="title" />
            </View>
          </View>

          <View className="flex-row" style={{ gap: theme.spacing.xs, marginTop: theme.spacing.sm }}>
            <Text variant="caption" tone="muted">
              {t('budgets.planned', 'Planned:')}
            </Text>
            <Money amount={data.amount} currency={data.currency} variant="caption" />
          </View>

        </Card>

        {canEdit ? (
          <BudgetEditCard
            key={data.id}
            budget={data}
            deleteError={deleteError?.budgetId === data.id ? deleteError.message : null}
            onDelete={() => {
              setDeleteError(null);
              setDeleting(true);
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
      title={t('budgets.detailTitle', 'Budget')}
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
      <DeleteBudgetDialog
        budgetId={deleting ? budgetId : null}
        onCancel={() => setDeleting(false)}
        onDeleted={() => {
          setDeleting(false);
          onClose();
        }}
        onError={(message) => {
          setDeleting(false);
          if (budgetId !== null) setDeleteError({ budgetId, message });
        }}
      />
    </BottomSheetModal>
  );
}
