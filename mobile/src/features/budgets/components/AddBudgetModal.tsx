import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BUDGET_PERIOD_TYPES, type BudgetPeriodType } from '@sora/contracts';

import { BottomSheetModal, Button, Input, StateView, Text } from '@/components';
import { useTheme, useWallets } from '@/app/providers';
import { CategoryPicker } from '../../categories/components/CategoryPicker.tsx';
import { useCreateBudgetMutation } from '@/app/store';
import { messageOf } from '../../../utils/errors';
import { addMonths, endOfMonth, startOfMonth, today } from '../../../utils/date';

export interface AddBudgetModalProps {
  visible: boolean;
  onClose: () => void;
}

export function AddBudgetModal({ visible, onClose }: AddBudgetModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { activeWallet } = useWallets();
  const [createBudget, { isLoading: isCreating }] = useCreateBudgetMutation();

  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [periodType, setPeriodType] = useState<BudgetPeriodType>('MONTHLY');
  const [error, setError] = useState<string | null>(null);

  const walletId = activeWallet?.id;

  useEffect(() => {
    if (visible) {
      setName('');
      setCategoryId(null);
      setAmount('');
      setPeriodType('MONTHLY');
      setError(null);
    }
  }, [visible]);

  const PERIOD_LABEL: Record<BudgetPeriodType, string> = {
    WEEKLY: t('budgets.weekly', { defaultValue: 'Weekly' }),
    MONTHLY: t('budgets.monthly', { defaultValue: 'Monthly' }),
    CUSTOM: t('budgets.custom', { defaultValue: 'Custom' }),
  };

  if (!visible) return null;

  if (walletId === undefined) {
    return (
      <BottomSheetModal visible={visible} onClose={onClose} title={t('budgets.newBudget')}>
        <StateView variant="informational" title={t('wallets.selectWalletFirst', 'Select a wallet first')} testID="add-budget-unselected" />
      </BottomSheetModal>
    );
  }

  async function handleSubmit() {
    setError(null);
    if (categoryId === null) {
      setError(t('budgets.chooseCategoryFirst', { defaultValue: 'Choose a category first.' }));
      return;
    }
    if (walletId === undefined) return;

    const startDate = startOfMonth(today());
    const endDate = periodType === 'MONTHLY' ? endOfMonth(today()) : addMonths(startDate, 1);

    try {
      await createBudget({
        walletId,
        categoryId,
        name: name.trim().length > 0 ? name : `${PERIOD_LABEL[periodType]} budget`,
        amount,
        currency: activeWallet?.balances[0]?.currency ?? 'VND',
        periodType,
        startDate,
        endDate,
      }).unwrap();
      onClose();
    } catch (submitError) {
      setError(messageOf(submitError, t));
    }
  }

  return (
    <BottomSheetModal visible={visible} onClose={onClose} title={t('budgets.newBudget')}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.xl }}
      >
        <Input testID="add-budget-name" label={t('categories.name', { defaultValue: 'Name' })} placeholder={t('budgets.namePlaceholder', 'e.g. Food August')} value={name} onChangeText={setName} />

        <CategoryPicker
          testID="add-budget-category"
          walletId={walletId}
          type="EXPENSE"
          value={categoryId}
          onChange={setCategoryId}
        />

        <Input testID="add-budget-amount" label={t('transactions.amount', { defaultValue: 'Amount' })} keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />

        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="label" tone="muted">
            {t('budgets.period', { defaultValue: 'Period' })}
          </Text>
          <View className="flex-row" style={{ gap: theme.spacing.xs }}>
            {BUDGET_PERIOD_TYPES.map((candidate) => (
              <Button
                key={candidate}
                label={PERIOD_LABEL[candidate]}
                size="sm"
                variant={periodType === candidate ? 'primary' : 'secondary'}
                onPress={() => setPeriodType(candidate)}
              />
            ))}
          </View>
        </View>

        {error !== null ? <Text tone="danger">{error}</Text> : null}

        <Button
          testID="add-budget-submit"
          label={t('budgets.newBudget')}
          onPress={handleSubmit}
          loading={isCreating}
          fullWidth
        />
      </ScrollView>
    </BottomSheetModal>
  );
}
