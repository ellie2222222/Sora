import { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';

import { BottomSheetModal, Button, DateField, Input, MoneyInput, StateView, Text } from '@/components';
import { useTheme, useWallets } from '@/app/providers';
import { useCreateGoalMutation } from '@/app/store';
import { messageOf } from '../../../utils/errors';

export interface AddGoalModalProps {
  visible: boolean;
  onClose: () => void;
}

export function AddGoalModal({ visible, onClose }: AddGoalModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { activeWallet } = useWallets();
  const [createGoal, { isLoading: isCreating }] = useCreateGoalMutation();

  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetDate, setTargetDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setName('');
      setTargetAmount('');
      setTargetDate(null);
      setError(null);
    }
  }, [visible]);

  if (!visible) return null;

  if (activeWallet === null) {
    return (
      <BottomSheetModal visible={visible} onClose={onClose} title={t('goals.newGoal')}>
        <StateView variant="informational" title={t('wallets.selectWalletFirst', 'Select a wallet first')} testID="add-goal-unselected" />
      </BottomSheetModal>
    );
  }

  async function handleSubmit() {
    if (activeWallet === null) return;

    setError(null);
    try {
      await createGoal({
        walletId: activeWallet.id,
        name,
        targetAmount,
        currency: activeWallet.balances[0]?.currency ?? 'VND',
        targetDate,
      }).unwrap();
      onClose();
    } catch (submitError) {
      setError(messageOf(submitError, t));
    }
  }

  return (
    <BottomSheetModal visible={visible} onClose={onClose} title={t('goals.newGoal')}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.xl }}
      >
        <Input testID="add-goal-name" label={t('categories.name', { defaultValue: 'Name' })} placeholder={t('goals.namePlaceholder', 'e.g. New Laptop')} value={name} onChangeText={setName} />
        <MoneyInput
          testID="add-goal-target"
          label={t('goals.targetAmount', { defaultValue: 'Target amount' })}
          value={targetAmount}
          onChangeValue={setTargetAmount}
        />
        <DateField
          testID="add-goal-date"
          label={t('goals.targetDateOptional', { defaultValue: 'Target date (optional)' })}
          placeholder={t('goals.noTargetDate', { defaultValue: 'Not set' })}
          value={targetDate}
          onChange={setTargetDate}
          onClear={() => setTargetDate(null)}
        />

        {error !== null ? <Text tone="danger">{error}</Text> : null}

        <Button
          testID="add-goal-submit"
          label={t('goals.newGoal')}
          onPress={handleSubmit}
          loading={isCreating}
          disabled={name.trim().length === 0}
          fullWidth
        />
      </ScrollView>
    </BottomSheetModal>
  );
}
