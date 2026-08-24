import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';

import { Button, Input, Text } from '../../../components/index.ts';
import { useTheme } from '../../../app/providers/ThemeProvider.tsx';
import { useWallets } from '../../../app/providers/WalletProvider.tsx';
import { messageOf } from '../../../utils/errors.ts';
import { useCreateGoal } from '../hooks/useGoals.ts';
import type { AppStackScreenProps } from '../../../app/navigation/types.ts';

export function AddGoalScreen({ navigation }: AppStackScreenProps<'AddGoal'>) {
  const theme = useTheme();
  const { activeWallet } = useWallets();
  const createGoal = useCreateGoal();

  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (activeWallet === null) return null;

  async function handleSubmit() {
    // Re-checked here, not just at the top of the component: TS does not carry
    // a closed-over const's narrowing into a nested function body, and this
    // guard also protects against activeWallet becoming null between renders
    // (e.g. the wallet was archived) if this closure outlives that render.
    if (activeWallet === null) return;

    setError(null);
    try {
      await createGoal.mutateAsync({
        walletId: activeWallet.id,
        name,
        targetAmount,
        currency: activeWallet.balances[0]?.currency ?? 'VND',
        targetDate: targetDate.trim().length > 0 ? targetDate.trim() : null,
      });
      navigation.goBack();
    } catch (submitError) {
      setError(messageOf(submitError));
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={{ padding: theme.spacing.md, gap: theme.spacing.md }}>
        <Input testID="add-goal-name" label="Name" placeholder="e.g. New Laptop" value={name} onChangeText={setName} />
        <Input
          testID="add-goal-target"
          label="Target amount"
          keyboardType="decimal-pad"
          value={targetAmount}
          onChangeText={setTargetAmount}
        />
        <Input
          testID="add-goal-date"
          label="Target date (optional)"
          placeholder="YYYY-MM-DD"
          value={targetDate}
          onChangeText={setTargetDate}
        />

        {error !== null ? <Text tone="danger">{error}</Text> : null}

        <Button
          testID="add-goal-submit"
          label="Create goal"
          onPress={handleSubmit}
          loading={createGoal.isPending}
          disabled={name.trim().length === 0}
          fullWidth
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
