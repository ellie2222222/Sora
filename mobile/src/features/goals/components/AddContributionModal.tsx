import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { isPositive, MoneyError, parseMoney } from '@sora/contracts';

import { BottomSheetModal, Button, DateField, Input, MoneyInput, SkeletonList, StateView, Text } from '@/components';
import { useTheme } from '@/app/providers';
import { AccountPicker } from '../../accounts/components/AccountPicker.tsx';
import { CategoryPicker } from '../../categories/components/CategoryPicker.tsx';
import { useAddContributionMutation, useGetGoalQuery } from '@/app/store';
import { isNetworkError, messageOf } from '../../../utils/errors';
import { instantOfDay, today } from '../../../utils/date';

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
  const [contributionDay, setContributionDay] = useState(today());
  const [note, setNote] = useState('');
  const [recordAsTransaction, setRecordAsTransaction] = useState(true);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setAccountId(null);
      setWalletId(undefined);
      setAmount('');
      setContributionDay(today());
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

  if (goal.isError && !isNetworkError(goal.error)) {
    return (
      <BottomSheetModal visible={visible} onClose={onClose} title={t('goals.addContribution')}>
        <StateView variant="error" error={goal.error} retryAction={() => void goal.refetch()} testID="add-contribution-error" />
      </BottomSheetModal>
    );
  }

  const goalData = goal.data;
  if (goalData === undefined) return null;

  async function handleSubmit() {
    if (!goalData) return;
    setError(null);
    if (accountId === null) {
      setError(t('goals.chooseAccountError', { defaultValue: 'Choose which account this comes from.' }));
      return;
    }
    try {
      if (!isPositive(parseMoney(amount))) {
        setError(t('goals.validAmountError', { defaultValue: 'Enter a valid amount greater than zero.' }));
        return;
      }
    } catch (parseError) {
      if (parseError instanceof MoneyError) {
        setError(t('goals.validAmountError', { defaultValue: 'Enter a valid amount greater than zero.' }));
        return;
      }
      throw parseError;
    }
    try {
      await addContribution({
        goalId: goalId!,
        body: {
          accountId,
          amount,
          currency: goalData.currency,
          contributionDate: instantOfDay(contributionDay),
          note: note.trim() || undefined,
          recordAsTransaction,
          categoryId: recordAsTransaction ? (categoryId ?? undefined) : undefined,
        },
      }).unwrap();
      onClose();
    } catch (submitError) {
      setError(messageOf(submitError, t));
    }
  }

  return (
    <BottomSheetModal visible={visible} onClose={onClose} title={t('goals.addContribution')}>
      <ScrollView contentContainerStyle={{ gap: theme.spacing.md }}>
        <AccountPicker
          testID="add-contribution-account"
          label={t('goals.fromAccount', { defaultValue: 'From Account' })}
          value={accountId}
          onChange={(id, selectedWalletId) => {
            setAccountId(id);
            setWalletId(selectedWalletId);
          }}
        />

        <MoneyInput
          testID="add-contribution-amount"
          label={t('transactions.amount')}
          value={amount}
          onChangeValue={setAmount}
        />

        <DateField
          testID="add-contribution-date"
          label={t('transactions.date', { defaultValue: 'Date' })}
          value={contributionDay}
          onChange={setContributionDay}
        />

        <Pressable
          testID="add-contribution-record-tx"
          onPress={() => setRecordAsTransaction((prev) => !prev)}
          className="flex-row items-center"
          style={{ gap: theme.spacing.sm }}
        >
          <View
            className="w-[20px] h-[20px] items-center justify-center border-[1.5px]"
            style={{
              borderRadius: theme.radius.sm,
              borderColor: recordAsTransaction ? theme.colors.primary : theme.colors.border,
              backgroundColor: recordAsTransaction ? theme.colors.primary : 'transparent',
            }}
          >
            {recordAsTransaction ? <Check size={14} color={theme.colors.onPrimary} /> : null}
          </View>
          <View className="flex-1">
            <Text weight="medium">
              {t('goals.recordAsExpense', { defaultValue: 'Record as expense transaction' })}
            </Text>
            <Text variant="caption" tone="muted">
              {t('goals.recordAsExpenseHelp', {
                defaultValue:
                  'Moves the money out of the account now. Leave unchecked to just mark progress toward the goal without recording a transaction.',
              })}
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

        <Input
          testID="add-contribution-note"
          label={t('goals.noteOptional', { defaultValue: 'Note (optional)' })}
          value={note}
          onChangeText={setNote}
        />

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
