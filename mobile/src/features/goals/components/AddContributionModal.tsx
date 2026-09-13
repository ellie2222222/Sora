import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { BottomSheetModal, Button, Input, SkeletonList, StateView, Text } from '../../../components';
import { useTheme } from '../../../app/providers/ThemeProvider';
import { AccountPicker } from '../../accounts/components/AccountPicker';
import { CategoryPicker } from '../../categories/components/CategoryPicker';
import { useAddContributionMutation, useGetGoalQuery } from '../../../app/store/api/goalsApi';
import { messageOf } from '../../../utils/errors';
import { nowInstant } from '../../../utils/date';

export interface AddContributionModalProps {
  visible: boolean;
  goalId?: string;
  onClose: () => void;
}

export function AddContributionModal({ visible, goalId, onClose }: AddContributionModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const goal = useGetGoalQuery(goalId ?? '', { skip: !visible || !goalId });
  const [addContribution, { isLoading: isSubmitting }] = useAddContributionMutation();

  const [accountId, setAccountId] = useState<string | null>(null);
  const [walletId, setWalletId] = useState<string | undefined>(undefined);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [recordAsTransaction, setRecordAsTransaction] = useState(true);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setAccountId(null);
      setWalletId(undefined);
      setAmount('');
      setNote('');
      setRecordAsTransaction(true);
      setCategoryId(null);
      setError(null);
    }
  }, [visible, goalId]);

  if (!visible || !goalId) return null;

  if (goal.isLoading) {
    return (
      <BottomSheetModal visible={visible} onClose={onClose} title={t('goals.addContribution')}>
        <SkeletonList rows={4} />
      </BottomSheetModal>
    );
  }

  if (goal.isError) {
    return (
      <BottomSheetModal visible={visible} onClose={onClose} title={t('goals.addContribution')}>
        <StateView variant="error" error={goal.error} retryAction={() => void goal.refetch()} testID="add-contribution-error" />
      </BottomSheetModal>
    );
  }

  if (goal.data === undefined) return null;

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
        goalId: goalId as string,
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
      onClose();
    } catch (submitError) {
      setError(messageOf(submitError));
    }
  }

  return (
    <BottomSheetModal visible={visible} onClose={onClose} title={t('goals.addContribution')}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.xl }}
      >
        <Input testID="add-contribution-amount" label={t('transactions.amount', { defaultValue: 'Amount' })} keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />

        <AccountPicker
          testID="add-contribution-account"
          label={t('goals.fromAccount', { defaultValue: 'From account' })}
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
            <Text weight="medium">{t('goals.recordAsExpense', { defaultValue: 'Record as an expense' })}</Text>
            <Text variant="caption" tone="muted">
              {t('goals.recordAsExpenseHelp', { defaultValue: 'Moves the money out of the account now. Leave unchecked to just mark progress toward the goal without recording a transaction.' })}
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
    </BottomSheetModal>
  );
}
