import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, ConfirmDialog, ErrorState, Input, Money, ProgressBar, Text } from '../../../components/index.ts';
import { SkeletonList } from '../../../components/Skeleton.tsx';
import { useTheme } from '../../../app/providers/ThemeProvider.tsx';
import { useWallets } from '../../../app/providers/WalletProvider.tsx';
import {
  useArchiveBudgetMutation,
  useGetBudgetQuery,
  useUpdateBudgetMutation,
} from '../../../app/store/api/budgetsApi.ts';
import { messageOf } from '../../../utils/errors.ts';
import type { AppStackScreenProps } from '../../../app/navigation/types.ts';

/**
 * Only `name`, `amount` and `status` are adjustable (§12.4). The category and
 * the window (periodType/startDate/endDate) are immutable — moving a window
 * would change which transactions the budget ever covered, which is a
 * different budget; archive and create instead.
 */
export function BudgetDetailScreen({ route, navigation }: AppStackScreenProps<'BudgetDetail'>) {
  const theme = useTheme();
  const { budgetId } = route.params;
  const { permissions } = useWallets();

  const budget = useGetBudgetQuery(budgetId);
  const [updateBudget, { isLoading: isSaving }] = useUpdateBudgetMutation();
  const [archiveBudget] = useArchiveBudgetMutation();

  const [name, setName] = useState<string | null>(null);
  const [amount, setAmount] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (budget.isLoading) return <SkeletonList rows={3} />;
  if (budget.isError) return <ErrorState error={budget.error} onRetry={() => void budget.refetch()} />;

  const data = budget.data;
  if (data === undefined) return null;

  const canEdit = permissions.canWrite && data.status === 'ACTIVE';
  const nameValue = name ?? data.name;
  const amountValue = amount ?? data.amount;
  const isDirty = nameValue !== data.name || amountValue !== data.amount;

  // Takes the loaded record as a parameter: this is a hoisted declaration, so
  // the `data === undefined` narrowing above does not reach inside it.
  async function handleSave(current: { name: string; amount: string }) {
    setActionError(null);
    try {
      await updateBudget({
        budgetId,
        body: {
          ...(nameValue !== current.name ? { name: nameValue } : {}),
          ...(amountValue !== current.amount ? { amount: amountValue } : {}),
        },
      }).unwrap();
    } catch (error) {
      setActionError(messageOf(error));
    }
  }

  async function handleConfirmArchive() {
    setActionError(null);
    try {
      await archiveBudget(budgetId).unwrap();
      setArchiving(false);
      navigation.goBack();
    } catch (error) {
      setActionError(messageOf(error));
    }
  }

  return (
    <View style={{ padding: theme.spacing.md, gap: theme.spacing.md }}>
      <Card>
        <Text variant="title">{data.name}</Text>
        <Text tone="muted" style={{ marginBottom: theme.spacing.sm }}>
          {data.category.name} · {data.startDate} to {data.endDate}
        </Text>

        <ProgressBar percentage={data.usagePercentage} danger={data.isOverBudget} height={12} />

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: theme.spacing.md }}>
          <View>
            <Text variant="label" tone="muted">
              Spent
            </Text>
            <Money amount={data.spent} currency={data.currency} variant="title" />
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text variant="label" tone="muted">
              {data.isOverBudget ? 'Over by' : 'Remaining'}
            </Text>
            <Money amount={data.remaining} currency={data.currency} variant="title" />
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: theme.spacing.xs, marginTop: theme.spacing.sm }}>
          <Text variant="caption" tone="muted">
            Planned:
          </Text>
          <Money amount={data.amount} currency={data.currency} variant="caption" />
        </View>

        {data.status === 'ARCHIVED' ? (
          <Text tone="muted" weight="semibold" style={{ marginTop: theme.spacing.sm }}>
            Archived
          </Text>
        ) : null}
      </Card>

      {canEdit ? (
        <Card style={{ gap: theme.spacing.sm }}>
          <Text variant="label" tone="muted">
            Edit budget
          </Text>
          <Input testID="budget-detail-name" label="Name" value={nameValue} onChangeText={setName} />
          <Input
            testID="budget-detail-amount"
            label="Amount"
            keyboardType="decimal-pad"
            value={amountValue}
            onChangeText={setAmount}
          />

          {actionError !== null ? <Text tone="danger">{actionError}</Text> : null}

          <Button
            testID="budget-detail-save"
            label="Save changes"
            onPress={() => void handleSave(data)}
            loading={isSaving}
            disabled={!isDirty}
            fullWidth
          />
          <Button
            testID="budget-detail-archive"
            label="Archive budget"
            variant="danger"
            onPress={() => setArchiving(true)}
            fullWidth
          />
        </Card>
      ) : null}

      <ConfirmDialog
        visible={archiving}
        title="Archive this budget?"
        message="It stops tracking new spending. Past figures stay visible."
        confirmLabel="Archive"
        destructive
        onConfirm={() => void handleConfirmArchive()}
        onCancel={() => setArchiving(false)}
      />
    </View>
  );
}
