import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, Trash2 } from 'lucide-react-native';
import type { BudgetResponse } from '@sora/contracts';

import { Button, Card, Input, MoneyInput, Text } from '@/components';
import { useTheme, useToast } from '@/app/providers';
import { useUpdateBudgetMutation } from '@/app/store';
import { messageOf } from '@/utils';

export interface BudgetEditCardProps {
  /** Render with `key={budget.id}` so an unsaved edit never follows the sheet to another budget. */
  budget: BudgetResponse;
  onDelete: () => void;
  /** Set by the caller when a delete started here fails. */
  deleteError: string | null;
}

export function BudgetEditCard({ budget, onDelete, deleteError }: BudgetEditCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [updateBudget, { isLoading: isSaving }] = useUpdateBudgetMutation();

  // Null means "as saved", so the fields follow a refetch until the user types.
  const [name, setName] = useState<string | null>(null);
  const [amount, setAmount] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const nameValue = name ?? budget.name;
  const amountValue = amount ?? budget.amount;
  const isDirty = nameValue !== budget.name || amountValue !== budget.amount;
  const error = saveError ?? deleteError;

  async function handleSave() {
    setSaveError(null);
    try {
      await updateBudget({
        budgetId: budget.id,
        body: {
          ...(nameValue !== budget.name ? { name: nameValue } : {}),
          ...(amountValue !== budget.amount ? { amount: amountValue } : {}),
        },
      }).unwrap();
      setName(null);
      setAmount(null);
      showToast(t('toast.budgetUpdated'), 'success');
    } catch (saveFailure) {
      setSaveError(messageOf(saveFailure, t));
    }
  }

  return (
    <Card style={{ gap: theme.spacing.sm }}>
      <Text variant="label" tone="muted">
        {t('budgets.editBudget', 'Edit budget')}
      </Text>
      <Input
        testID="input-budget-name"
        label={t('common.name')}
        value={nameValue}
        onChangeText={(next) => {
          setName(next);
          setSaveError(null);
        }}
      />
      <MoneyInput
        testID="input-budget-amount"
        label={t('transactions.amount', 'Amount')}
        value={amountValue}
        onChangeValue={(next) => {
          setAmount(next);
          setSaveError(null);
        }}
      />

      {error !== null ? <Text tone="danger">{error}</Text> : null}

      <Button
        testID="btn-submit-budget"
        label={t('common.save', 'Save')}
        icon={Save}
        onPress={() => void handleSave()}
        loading={isSaving}
        disabled={!isDirty}
        fullWidth
      />
      <Button
        testID="btn-delete-budget"
        label={t('budgets.deleteBudget')}
        icon={Trash2}
        variant="danger-outline"
        onPress={() => {
          setSaveError(null);
          onDelete();
        }}
        fullWidth
      />
    </Card>
  );
}
