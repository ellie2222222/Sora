import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { Check } from 'lucide-react-native';

import { Button, Input, Text } from '../../../components/index.ts';
import { useTheme } from '../../../app/providers/ThemeProvider.tsx';
import { AccountPicker } from '../../accounts/components/AccountPicker.tsx';
import { CategoryPicker } from '../../categories/components/CategoryPicker.tsx';
import { useAddContributionMutation, useGetGoalQuery } from '../../../app/store/api/goalsApi.ts';
import { messageOf } from '../../../utils/errors.ts';
import { nowInstant } from '../../../utils/date.ts';
import type { AppStackScreenProps } from '../../../app/navigation/types.ts';

export function AddContributionScreen({ route, navigation }: AppStackScreenProps<'AddContribution'>) {
  const theme = useTheme();
  const { goalId } = route.params;
  const goal = useGetGoalQuery(goalId);
  const [addContribution, { isLoading: isSubmitting }] = useAddContributionMutation();

  const [accountId, setAccountId] = useState<string | null>(null);
  const [walletId, setWalletId] = useState<string | undefined>(undefined);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [recordAsTransaction, setRecordAsTransaction] = useState(true);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (goal.data === undefined) return null;

  async function handleSubmit() {
    setError(null);
    if (accountId === null) {
      setError('Choose which account this comes from.');
      return;
    }
    if (recordAsTransaction && categoryId === null) {
      setError('Choose a category for the expense this creates.');
      return;
    }

    try {
      await addContribution({
        goalId,
        body: {
          accountId,
          amount,
          currency: goal.data?.currency ?? 'VND',
          contributionDate: nowInstant(),
          note: note.trim().length > 0 ? note.trim() : undefined,
          recordAsTransaction,
          categoryId: recordAsTransaction && categoryId !== null ? categoryId : undefined,
        },
      }).unwrap();
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
        <Input testID="add-contribution-amount" label="Amount" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />

        <AccountPicker
          testID="add-contribution-account"
          label="From account"
          walletId={goal.data.walletId}
          value={accountId}
          onChange={(id, pickedWalletId) => {
            setAccountId(id);
            setWalletId(pickedWalletId);
          }}
        />

        <Pressable
          testID="add-contribution-record-toggle"
          onPress={() => setRecordAsTransaction((current) => !current)}
          style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.sm }}
        >
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: theme.radius.sm,
              borderWidth: 1,
              borderColor: theme.colors.border,
              backgroundColor: recordAsTransaction ? theme.colors.primary : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {recordAsTransaction ? <Check size={14} color={theme.colors.onPrimary} /> : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text weight="medium">Record as an expense</Text>
            <Text variant="caption" tone="muted">
              Moves the money out of the account now. Leave unchecked to just mark progress
              toward the goal without recording a transaction.
            </Text>
          </View>
        </Pressable>

        {recordAsTransaction ? (
          <CategoryPicker
            testID="add-contribution-category"
            walletId={walletId ?? goal.data.walletId}
            type="EXPENSE"
            value={categoryId}
            onChange={setCategoryId}
          />
        ) : null}

        <Input testID="add-contribution-note" label="Note (optional)" value={note} onChangeText={setNote} />

        {error !== null ? <Text tone="danger">{error}</Text> : null}

        <Button
          testID="add-contribution-submit"
          label="Add contribution"
          onPress={handleSubmit}
          loading={isSubmitting}
          fullWidth
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
