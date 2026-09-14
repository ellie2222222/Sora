import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { TransactionStatus, TransactionType, CategoryType, type TransactionResponse, type UpdateTransactionRequest } from '@sora/contracts';

import { BottomSheetModal, Button, Input, StateView, Text } from '../../../components';
import { SkeletonList } from '../../../components/Skeleton';
import { useTheme } from '../../../app/providers/ThemeProvider';
import { CategoryPicker } from '../../categories/components/CategoryPicker';
import { useGetTransactionQuery, useUpdateTransactionMutation } from '../../../app/store/api/transactionsApi';
import { dayOfInstant, replaceDay } from '../../../utils/date';
import { messageOf } from '../../../utils/errors';
import type { AppStackScreenProps } from '../../../app/navigation/types';


const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function EditTransactionScreen({ route, navigation }: AppStackScreenProps<'EditTransaction'>) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { transactionId } = route.params;

  const transaction = useGetTransactionQuery(transactionId);
  const [updateTransaction, { isLoading: isSaving }] = useUpdateTransactionMutation();

  const [description, setDescription] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [dayError, setDayError] = useState<string | undefined>(undefined);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const data = transaction.data;

  const descriptionValue = description ?? data?.description ?? '';
  const dayValue = day ?? (data !== undefined ? dayOfInstant(data.transactionDate) : '');
  const categoryValue = categoryId ?? data?.category?.id ?? null;
  const referenceValue = reference ?? data?.reference ?? '';
  const categoryWalletId = data?.fromAccount?.walletId ?? data?.toAccount?.walletId;

  async function handleSubmit(current: TransactionResponse) {
    setSubmitError(null);

    if (!DAY_PATTERN.test(dayValue)) {
      setDayError(t('transactions.dayPatternError', 'Use YYYY-MM-DD'));
      return;
    }
    setDayError(undefined);

    const body: UpdateTransactionRequest = {};
    if (descriptionValue !== (current.description ?? '')) {
      body.description = descriptionValue === '' ? null : descriptionValue;
    }
    if (dayValue !== dayOfInstant(current.transactionDate)) {
      body.transactionDate = replaceDay(current.transactionDate, dayValue);
    }
    if (categoryValue !== null && categoryValue !== (current.category?.id ?? null)) {
      body.categoryId = categoryValue;
    }
    if (referenceValue !== (current.reference ?? '')) {
      body.reference = referenceValue === '' ? null : referenceValue;
    }

    if (Object.keys(body).length === 0) {
      navigation.goBack();
      return;
    }

    try {
      await updateTransaction({ transactionId, body }).unwrap();
      navigation.goBack();
    } catch (error) {
      setSubmitError(messageOf(error, t));
    }
  }

  const renderContent = () => {
    if (transaction.isLoading) return <SkeletonList rows={4} />;
    if (transaction.isError) {
      return <StateView variant="error" error={transaction.error} retryAction={() => void transaction.refetch()} testID="edit-transaction-error" />;
    }

    if (data === undefined) {
      return <StateView variant="error" error={new Error(t('transactions.transactionNotFound', 'Transaction not found'))} testID="edit-transaction-not-found" />;
    }

    if (data.status === TransactionStatus.CANCELLED) {
      return (
        <View style={{ padding: theme.spacing.lg, alignItems: 'center', justifyContent: 'center' }}>
          <Text tone="muted" style={{ textAlign: 'center' }}>
            {t('transactions.cancelledNotice', { defaultValue: 'A cancelled transaction cannot be edited. Record a new one instead.' })}
          </Text>
        </View>
      );
    }

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.xl }}
      >
        <Text variant="caption" tone="muted">
          {t('transactions.immutableFieldsNotice', { defaultValue: 'Amount, type and accounts cannot be changed. Cancel and re-record to correct those.' })}
        </Text>

        <Input
          testID="edit-transaction-description"
          label={t('transactions.note', { defaultValue: 'Note' })}
          value={descriptionValue}
          onChangeText={setDescription}
        />

        <Input
          testID="edit-transaction-date"
          label={t('transactions.date', { defaultValue: 'Date' })}
          placeholder="YYYY-MM-DD"
          value={dayValue}
          onChangeText={setDay}
          error={dayError}
        />

        {data.type !== TransactionType.TRANSFER && categoryWalletId !== undefined ? (
          <CategoryPicker
            testID="edit-transaction-category"
            walletId={categoryWalletId}
            type={data.type === TransactionType.INCOME ? CategoryType.INCOME : CategoryType.EXPENSE}
            value={categoryValue}
            onChange={setCategoryId}
          />
        ) : null}

        <Input
          testID="edit-transaction-reference"
          label={t('transactions.reference', { defaultValue: 'Reference' })}
          value={referenceValue}
          onChangeText={setReference}
        />

        {submitError !== null ? <Text tone="danger">{submitError}</Text> : null}

        <Button
          testID="edit-transaction-submit"
          label={t('common.save', { defaultValue: 'Save' })}
          onPress={() => void handleSubmit(data)}
          loading={isSaving}
          fullWidth
        />
      </ScrollView>
    );
  };

  return (
    <BottomSheetModal visible={true} onClose={() => navigation.goBack()} title={t('transactions.editTransaction')}>
      {renderContent()}
    </BottomSheetModal>
  );
}
