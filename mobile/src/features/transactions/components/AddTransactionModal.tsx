import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { TransactionType, CategoryType } from '@sora/contracts';

import { BottomSheetModal, Button, DateField, Input, Text } from '@/components';
import { useTheme, useWallets } from '@/app/providers';
import { AccountPicker } from '../../accounts/components/AccountPicker.tsx';
import { CategoryPicker } from '../../categories/components/CategoryPicker.tsx';
import { messageOf } from '../../../utils/errors';
import { dayOfInstant, nowInstant, replaceDay } from '../../../utils/date';
import {
  emptyDraft,
  fieldsForType,
  primaryAccountOf,
  setPrimaryAccount,
  switchType,
  validateDraft,
} from '../../../utils/transactionForm';
import { useCreateTransactionMutation } from '@/app/store';

export interface AddTransactionModalProps {
  visible: boolean;
  onClose: () => void;
}

export function AddTransactionModal({ visible, onClose }: AddTransactionModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { activeWallet, permissions } = useWallets();
  const [createTransaction, { isLoading: isSubmitting }] = useCreateTransactionMutation();

  const [draft, setDraft] = useState(() => emptyDraft({ currency: 'VND', transactionDate: nowInstant() }));
  const [amountText, setAmountText] = useState('');
  const [toAccountWalletId, setToAccountWalletId] = useState<string | undefined>(undefined);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const walletId = activeWallet?.id;
  const fields = fieldsForType(draft.type);
  const primaryAccount = primaryAccountOf(draft);

  const TYPES: { type: TransactionType; label: string }[] = [
    { type: TransactionType.EXPENSE, label: t('transactions.filterExpense', { defaultValue: 'Expense' }) },
    { type: TransactionType.INCOME, label: t('transactions.filterIncome', { defaultValue: 'Income' }) },
    { type: TransactionType.TRANSFER, label: t('transactions.filterTransfer', { defaultValue: 'Transfer' }) },
  ];

  useEffect(() => {
    if (visible) {
      setDraft(emptyDraft({ currency: 'VND', transactionDate: nowInstant() }));
      setAmountText('');
      setToAccountWalletId(undefined);
      setFieldErrors({});
      setSubmitError(null);
    }
  }, [visible, walletId]);

  const crossWallet =
    draft.type === TransactionType.TRANSFER && toAccountWalletId !== undefined && toAccountWalletId !== walletId;

  if (!permissions.canWrite) {
    return (
      <BottomSheetModal visible={visible} onClose={onClose} title={t('home.addTransaction')}>
        <View className="items-center justify-center" style={{ padding: theme.spacing.lg }}>
          <Text tone="muted" style={{ textAlign: 'center' }}>
            {t('transactions.viewOnlyNotice', {
              defaultValue: 'You have view-only access to this wallet and cannot record transactions.',
            })}
          </Text>
        </View>
      </BottomSheetModal>
    );
  }

  async function handleSubmit() {
    setSubmitError(null);
    const withAmount = { ...draft, amount: amountText };
    const result = validateDraft(withAmount);

    if (!result.ok) {
      const next: Record<string, string> = {};
      for (const issue of result.issues) next[issue.path] = issue.message;
      setFieldErrors(next);
      return;
    }

    setFieldErrors({});
    try {
      await createTransaction(result.payload).unwrap();
      onClose();
    } catch (error) {
      setSubmitError(messageOf(error, t));
    }
  }

  return (
    <BottomSheetModal visible={visible} onClose={onClose} title={t('home.addTransaction')}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.xl }}
      >
        <View className="flex-row" style={{ gap: theme.spacing.sm }}>
          {TYPES.map(({ type, label }) => (
            <Button
              key={type}
              testID={`transaction-type-${type}`}
              label={label}
              variant={draft.type === type ? 'primary' : 'secondary'}
              onPress={() => setDraft((current) => switchType(current, type))}
              style={{ flex: 1 }}
            />
          ))}
        </View>

        <Input
          testID="transaction-amount"
          label={t('transactions.amount', { defaultValue: 'Amount' })}
          keyboardType="decimal-pad"
          value={amountText}
          onChangeText={setAmountText}
          error={fieldErrors.amount}
        />

        <DateField
          testID="transaction-date"
          label={t('transactions.date', { defaultValue: 'Date' })}
          value={dayOfInstant(draft.transactionDate)}
          onChange={(day) => setDraft((current) => ({ ...current, transactionDate: replaceDay(current.transactionDate, day) }))}
        />

        {fields.fromAccount && draft.type !== TransactionType.TRANSFER ? (
          <AccountPicker
            testID="transaction-from-account"
            label={t('accounts.accountLabel', { defaultValue: 'Account' })}
            walletId={walletId}
            value={primaryAccount}
            onChange={(accountId) => setDraft((current) => setPrimaryAccount(current, accountId))}
            error={fieldErrors.fromAccountId}
          />
        ) : null}

        {fields.toAccount && draft.type !== TransactionType.TRANSFER ? (
          <AccountPicker
            testID="transaction-to-account"
            label={t('accounts.accountLabel', { defaultValue: 'Account' })}
            walletId={walletId}
            value={primaryAccount}
            onChange={(accountId) => setDraft((current) => setPrimaryAccount(current, accountId))}
            error={fieldErrors.toAccountId}
          />
        ) : null}

        {draft.type === TransactionType.TRANSFER ? (
          <>
            <AccountPicker
              testID="transaction-from-account"
              label={t('transactions.fromLabel', { defaultValue: 'From' })}
              walletId={walletId}
              value={draft.fromAccountId}
              onChange={(accountId) => setDraft((current) => ({ ...current, fromAccountId: accountId }))}
              error={fieldErrors.fromAccountId}
            />
            <AccountPicker
              testID="transaction-to-account"
              label={t('transactions.toLabel', { defaultValue: 'To' })}
              value={draft.toAccountId}
              onChange={(accountId, pickedWalletId) => {
                setDraft((current) => ({ ...current, toAccountId: accountId }));
                setToAccountWalletId(pickedWalletId);
              }}
              error={fieldErrors.toAccountId}
            />
            {crossWallet ? (
              <View
                style={{
                  backgroundColor: theme.colors.warningMuted,
                  borderRadius: theme.radius.md,
                  padding: theme.spacing.sm,
                }}
              >
                <Text variant="caption" tone="muted">
                  {t('transactions.crossWalletNotice', {
                    defaultValue: 'This moves money into another wallet. It will appear in their ledger too.',
                  })}
                </Text>
              </View>
            ) : null}
          </>
        ) : null}

        {fields.category && walletId !== undefined ? (
          <CategoryPicker
            testID="transaction-category"
            walletId={walletId}
            type={draft.type === TransactionType.INCOME ? CategoryType.INCOME : CategoryType.EXPENSE}
            value={draft.categoryId}
            onChange={(categoryId) => setDraft((current) => ({ ...current, categoryId }))}
            error={fieldErrors.categoryId}
          />
        ) : null}

        <Input
          testID="transaction-description"
          label={t('transactions.note', { defaultValue: 'Note' })}
          value={draft.description}
          onChangeText={(text) => setDraft((current) => ({ ...current, description: text }))}
        />

        {submitError !== null ? <Text tone="danger">{submitError}</Text> : null}

        <Button
          testID="transaction-submit"
          label={t('common.save', { defaultValue: 'Save' })}
          onPress={handleSubmit}
          loading={isSubmitting}
          fullWidth
        />
      </ScrollView>
    </BottomSheetModal>
  );
}
