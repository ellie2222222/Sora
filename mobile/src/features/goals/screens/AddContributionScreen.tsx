import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { BottomSheetModal, Button, Input, Text } from '../../../components';
import { useTheme } from '../../../app/providers/ThemeProvider';
import { AccountPicker } from '../../accounts/components/AccountPicker';
import { CategoryPicker } from '../../categories/components/CategoryPicker';
import { useAddContributionMutation, useGetGoalQuery } from '../../../app/store/api/goalsApi';
import { messageOf } from '../../../utils/errors';
import { nowInstant } from '../../../utils/date';
import type { AppStackScreenProps } from '../../../app/navigation/types';


export function AddContributionScreen({ route, navigation }: AppStackScreenProps<'AddContribution'>) {
  const theme = useTheme();
  const { t } = useTranslation();
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

  async function handleSubmit() {
    setError(null);
    if (accountId === null) {
      setError(t('goals.chooseAccountError', { defaultValue: 'Choose which account this comes from.' }));
      return;
    }
    if (recordAsTransaction && categoryId === null) {
      setError(t('goals.chooseCategoryError', { defaultValue: 'Choose a category for the expense this creates.' }));
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
      setError(messageOf(submitError, t));
    }
  }

  const renderContent = () => {
    if (goal.isLoading) {
      return (
        <View style={{ padding: theme.spacing.lg, alignItems: 'center' }}>
          <Text tone="muted">{t('common.loading', 'Loading...')}</Text>
        </View>
      );
    }
    if (goal.isError || goal.data === undefined) {
      return (
        <View style={{ padding: theme.spacing.lg, alignItems: 'center' }}>
          <Text tone="danger">{t('common.error', 'An error occurred.')}</Text>
        </View>
      );
    }

    const goalData = goal.data;

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.xl }}
      >
        <Input testID="add-contribution-amount" label={t('transactions.amount', { defaultValue: 'Amount' })} keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />

        <AccountPicker
          testID="add-contribution-account"
          label={t('goals.fromAccount', { defaultValue: 'From account' })}
          walletId={goalData.walletId}
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
            <Text weight="medium">{t('goals.recordAsExpense', { defaultValue: 'Record as an expense' })}</Text>
            <Text variant="caption" tone="muted">
              {t('goals.recordAsExpenseHelp', { defaultValue: 'Moves the money out of the account now. Leave unchecked to just mark progress toward the goal without recording a transaction.' })}
            </Text>
          </View>
        </Pressable>

        {recordAsTransaction ? (
          <CategoryPicker
            testID="add-contribution-category"
            walletId={walletId ?? goalData.walletId}
            type="EXPENSE"
            value={categoryId}
            onChange={setCategoryId}
          />
        ) : null}

        <Input testID="add-contribution-note" label={t('goals.noteOptional', { defaultValue: 'Note (optional)' })} value={note} onChangeText={setNote} />

        {error !== null ? <Text tone="danger">{error}</Text> : null}

        <Button
          testID="add-contribution-submit"
          label={t('goals.addContribution')}
          onPress={handleSubmit}
          loading={isSubmitting}
          fullWidth
        />
      </ScrollView>
    );
  };

  return (
    <BottomSheetModal visible={true} onClose={() => navigation.goBack()} title={t('goals.addContribution')}>
      {renderContent()}
    </BottomSheetModal>
  );
}
