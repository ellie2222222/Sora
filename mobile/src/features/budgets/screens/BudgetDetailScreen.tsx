import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { BudgetStatus } from '@sora/contracts';
import { Button, Card, ConfirmDialog, Input, KeyboardDockProvider, Money, MoneyInput, ProgressBar, SkeletonList, StateView, Text } from '@/components';
import { useTheme, useWallets } from '@/app/providers';
import {
  useArchiveBudgetMutation,
  useGetBudgetQuery,
  useUpdateBudgetMutation,
} from '@/app/store';
import { isNetworkError, messageOf } from '../../../utils/errors.ts';
import type { AppStackScreenProps } from '@/app/navigation';

export function BudgetDetailScreen({ route, navigation }: AppStackScreenProps<'BudgetDetail'>) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { budgetId } = route.params;
  const { permissions } = useWallets();

  const budget = useGetBudgetQuery(budgetId);
  const [updateBudget, { isLoading: isSaving }] = useUpdateBudgetMutation();
  const [archiveBudget] = useArchiveBudgetMutation();

  const [name, setName] = useState<string | null>(null);
  const [amount, setAmount] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleSave(current: { name: string; amount: string }) {
    setActionError(null);
    const nameValue = name ?? current.name;
    const amountValue = amount ?? current.amount;
    try {
      await updateBudget({
        budgetId,
        body: {
          ...(nameValue !== current.name ? { name: nameValue } : {}),
          ...(amountValue !== current.amount ? { amount: amountValue } : {}),
        },
      }).unwrap();
    } catch (error) {
      setActionError(messageOf(error, t));
    }
  }

  async function handleConfirmArchive() {
    setActionError(null);
    try {
      await archiveBudget(budgetId).unwrap();
      setArchiving(false);
      navigation.goBack();
    } catch (error) {
      setActionError(messageOf(error, t));
    }
  }

  const renderContent = () => {
    if (budget.isLoading) return <SkeletonList rows={3} />;
    if (budget.isError && !isNetworkError(budget.error)) {
      return <StateView variant="error" error={budget.error} retryAction={() => void budget.refetch()} />;
    }

    const data = budget.data;
    if (data === undefined) {
      return <StateView variant="error" error={new Error(t('budgets.budgetNotFound', 'Budget not found'))} />;
    }

    const canEdit = permissions.canWrite && data.status === BudgetStatus.ACTIVE;
    const nameValue = name ?? data.name;
    const amountValue = amount ?? data.amount;
    const isDirty = nameValue !== data.name || amountValue !== data.amount;

    return (
      <>
        <Card>
          <Text variant="title">{data.name}</Text>
          <Text tone="muted" style={{ marginBottom: theme.spacing.sm }}>
            {data.category.name} · {data.startDate} to {data.endDate}
          </Text>

          <ProgressBar percentage={data.usagePercentage} danger={data.isOverBudget} height={12} />

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
              {t('common.archive', 'Archived')}
            </Text>
          ) : null}
        </Card>

        {canEdit ? (
          <Card style={{ gap: theme.spacing.sm }}>
            <Text variant="label" tone="muted">
              {t('budgets.editBudget', 'Edit budget')}
            </Text>
            <Input testID="budget-detail-name" label={t('categories.name', 'Name')} value={nameValue} onChangeText={setName} />
            <MoneyInput
              testID="budget-detail-amount"
              label={t('transactions.amount', 'Amount')}
              value={amountValue}
              onChangeValue={setAmount}
            />

            {actionError !== null ? <Text tone="danger">{actionError}</Text> : null}

            <Button
              testID="budget-detail-save"
              label={t('common.save', 'Save')}
              onPress={() => void handleSave(data)}
              loading={isSaving}
              disabled={!isDirty}
              fullWidth
            />
            <Button
              testID="budget-detail-archive"
              label={t('budgets.archiveBudget', 'Archive budget')}
              variant="danger"
              onPress={() => setArchiving(true)}
              fullWidth
            />
          </Card>
        ) : null}
      </>
    );
  };

  return (
    <KeyboardDockProvider>
      <View style={{ flex: 1, padding: theme.spacing.md, gap: theme.spacing.md }}>
        {renderContent()}

        <ConfirmDialog
          visible={archiving}
          title={t('budgets.archiveConfirmTitle', 'Archive this budget?')}
          message={t('budgets.archiveConfirmMessage', 'It stops tracking new spending. Past figures stay visible.')}
          confirmLabel={t('common.archive', 'Archive')}
          destructive
          onConfirm={() => void handleConfirmArchive()}
          onCancel={() => setArchiving(false)}
        />
      </View>
    </KeyboardDockProvider>
  );
}
