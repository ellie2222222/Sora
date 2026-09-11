import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { BUDGET_PERIOD_TYPES, type BudgetPeriodType } from '@sora/contracts';

import { Button, Input, Text } from '../../../components/index.ts';
import { useTheme } from '../../../app/providers/ThemeProvider.tsx';
import { useWallets } from '../../../app/providers/WalletProvider.tsx';
import { CategoryPicker } from '../../categories/components/CategoryPicker.tsx';
import { useCreateBudgetMutation } from '../../../app/store/api/budgetsApi.ts';
import { messageOf } from '../../../utils/errors.ts';
import { addMonths, endOfMonth, startOfMonth, today } from '../../../utils/date.ts';
import type { AppStackScreenProps } from '../../../app/navigation/types.ts';

const PERIOD_LABEL: Record<BudgetPeriodType, string> = {
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  CUSTOM: 'Custom',
};

export function AddBudgetScreen({ navigation }: AppStackScreenProps<'AddBudget'>) {
  const theme = useTheme();
  const { activeWallet } = useWallets();
  const [createBudget, { isLoading: isCreating }] = useCreateBudgetMutation();

  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [periodType, setPeriodType] = useState<BudgetPeriodType>('MONTHLY');
  const [error, setError] = useState<string | null>(null);

  const walletId = activeWallet?.id;

  async function handleSubmit() {
    setError(null);
    if (categoryId === null) {
      setError('Choose a category first.');
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
      navigation.goBack();
    } catch (submitError) {
      setError(messageOf(submitError));
    }
  }

  if (walletId === undefined) return null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={{ padding: theme.spacing.md, gap: theme.spacing.md }}>
        <Input testID="add-budget-name" label="Name" placeholder="e.g. Food August" value={name} onChangeText={setName} />

        <CategoryPicker
          testID="add-budget-category"
          walletId={walletId}
          type="EXPENSE"
          value={categoryId}
          onChange={setCategoryId}
        />

        <Input testID="add-budget-amount" label="Amount" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />

        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="label" tone="muted">
            Period
          </Text>
          <View style={{ flexDirection: 'row', gap: theme.spacing.xs }}>
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
          label="Create budget"
          onPress={handleSubmit}
          loading={isCreating}
          fullWidth
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
