import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Ban, Save } from 'lucide-react-native';
import { updateGoalSchema, type GoalResponse } from '@sora/contracts';

import { Button, Card, DateField, Input, MoneyInput, Text } from '@/components';
import { useTheme, useToast } from '@/app/providers';
import { useUpdateGoalMutation } from '@/app/store';
import { issueMessagesByPath, messageOf } from '@/utils';
import { goalChanges } from '../goalChanges.ts';

export interface GoalEditCardProps {
  /** Render with `key={goal.id}` so a different goal starts from its own values. */
  goal: GoalResponse;
  onCancelGoal: () => void;
}

/** Name, description, target and deadline; currency stays fixed (§13.4) because contributions are recorded in it. */
export function GoalEditCard({ goal, onCancelGoal }: GoalEditCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [updateGoal, { isLoading: isSaving }] = useUpdateGoalMutation();

  const [name, setName] = useState(goal.name);
  const [description, setDescription] = useState(goal.description ?? '');
  const [targetAmount, setTargetAmount] = useState(goal.targetAmount);
  const [targetDate, setTargetDate] = useState<string | null>(goal.targetDate);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  const changes = goalChanges(goal, { name, description, targetAmount, targetDate });
  const isDirty = Object.keys(changes).length > 0;

  function edit<T>(set: (value: T) => void) {
    return (value: T) => {
      set(value);
      setSaveError(null);
    };
  }

  async function handleSave() {
    setSaveError(null);
    const parsed = updateGoalSchema.safeParse(changes);
    if (!parsed.success) {
      setFieldErrors(issueMessagesByPath(parsed.error.issues));
      return;
    }
    setFieldErrors({});
    try {
      await updateGoal({ goalId: goal.id, body: parsed.data }).unwrap();
      showToast(t('toast.goalUpdated'), 'success');
    } catch (error) {
      setSaveError(messageOf(error, t));
    }
  }

  return (
    <Card style={{ gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
      <Text variant="label" tone="muted">
        {t('goals.editGoal')}
      </Text>
      <Input testID="input-goal-name" label={t('common.name')} value={name} onChangeText={edit(setName)} error={fieldErrors.name} />
      <Input
        testID="input-goal-description"
        label={t('goals.description')}
        value={description}
        onChangeText={edit(setDescription)}
        error={fieldErrors.description}
      />
      <MoneyInput
        testID="input-goal-target-amount"
        label={t('goals.target', 'Target')}
        value={targetAmount}
        onChangeValue={edit(setTargetAmount)}
        error={fieldErrors.targetAmount}
      />
      <DateField
        testID="input-goal-target-date"
        label={t('goals.deadline', 'Deadline')}
        value={targetDate}
        onChange={edit(setTargetDate)}
        onClear={() => edit(setTargetDate)(null)}
        placeholder={t('goals.noTargetDate', 'Not set')}
        error={fieldErrors.targetDate}
      />

      {saveError !== null ? <Text tone="danger">{saveError}</Text> : null}

      <Button
        testID="btn-submit-goal"
        label={t('common.save', 'Save')}
        icon={Save}
        onPress={() => void handleSave()}
        loading={isSaving}
        disabled={!isDirty}
        fullWidth
      />
      {/* Not btn-cancel-goal: that id is the add-goal sheet's Cancel (NC-04). */}
      <Button
        testID="btn-cancel-goal-status"
        label={t('goals.cancelGoal')}
        icon={Ban}
        variant="danger"
        onPress={onCancelGoal}
        fullWidth
      />
    </Card>
  );
}
