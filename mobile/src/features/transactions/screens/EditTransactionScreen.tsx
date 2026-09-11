import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import type { TransactionResponse, UpdateTransactionRequest } from '@sora/contracts';

import { Button, ErrorState, Input, Text } from '../../../components/index.ts';
import { SkeletonList } from '../../../components/Skeleton.tsx';
import { useTheme } from '../../../app/providers/ThemeProvider.tsx';
import { CategoryPicker } from '../../categories/components/CategoryPicker.tsx';
import { useGetTransactionQuery, useUpdateTransactionMutation } from '../../../app/store/api/transactionsApi.ts';
import { dayOfInstant, replaceDay } from '../../../utils/date.ts';
import { messageOf } from '../../../utils/errors.ts';
import type { AppStackScreenProps } from '../../../app/navigation/types.ts';

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Corrects the four mutable fields of a transaction (§11.4).
 *
 * Amount, type and the accounts are deliberately absent rather than disabled:
 * they are immutable server-side (BR-03) because every balance, budget figure
 * and goal total derives from them, and the correction path for a wrong amount
 * is cancel-then-recreate, which leaves both rows visible.
 */
export function EditTransactionScreen({ route, navigation }: AppStackScreenProps<'EditTransaction'>) {
  const theme = useTheme();
  const { transactionId } = route.params;

  const transaction = useGetTransactionQuery(transactionId);
  const [updateTransaction, { isLoading: isSaving }] = useUpdateTransactionMutation();

  const [description, setDescription] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [dayError, setDayError] = useState<string | undefined>(undefined);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (transaction.isLoading) return <SkeletonList rows={4} />;
  if (transaction.isError) {
    return <ErrorState error={transaction.error} onRetry={() => void transaction.refetch()} testID="edit-transaction-error" />;
  }

  const data = transaction.data;
  if (data === undefined) return null;

  if (data.status === 'CANCELLED') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.xl }}>
        <Text tone="muted" style={{ textAlign: 'center' }}>
          A cancelled transaction cannot be edited. Record a new one instead.
        </Text>
      </View>
    );
  }

  // Each field falls back to the loaded value until the user touches it, so an
  // untouched field stays out of the request body entirely.
  const descriptionValue = description ?? data.description ?? '';
  const dayValue = day ?? dayOfInstant(data.transactionDate);
  const categoryValue = categoryId ?? data.category?.id ?? null;
  const referenceValue = reference ?? data.reference ?? '';

  const categoryWalletId = data.fromAccount?.walletId ?? data.toAccount?.walletId;

  // Takes the loaded record as a parameter: this is a hoisted declaration, so
  // the `data === undefined` narrowing above does not reach inside it.
  async function handleSubmit(current: TransactionResponse) {
    setSubmitError(null);

    if (!DAY_PATTERN.test(dayValue)) {
      setDayError('Use YYYY-MM-DD');
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

    // The schema refuses an empty body ("Nothing to update"), and there is
    // nothing to report if the user changed nothing.
    if (Object.keys(body).length === 0) {
      navigation.goBack();
      return;
    }

    try {
      await updateTransaction({ transactionId, body }).unwrap();
      navigation.goBack();
    } catch (error) {
      setSubmitError(messageOf(error));
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: theme.spacing.md, gap: theme.spacing.md }}>
      <Text variant="caption" tone="muted">
        Amount, type and accounts cannot be changed. Cancel and re-record to correct those.
      </Text>

      <Input
        testID="edit-transaction-description"
        label="Note"
        value={descriptionValue}
        onChangeText={setDescription}
      />

      <Input
        testID="edit-transaction-date"
        label="Date"
        placeholder="YYYY-MM-DD"
        value={dayValue}
        onChangeText={setDay}
        error={dayError}
      />

      {data.type !== 'TRANSFER' && categoryWalletId !== undefined ? (
        <CategoryPicker
          testID="edit-transaction-category"
          walletId={categoryWalletId}
          type={data.type === 'INCOME' ? 'INCOME' : 'EXPENSE'}
          value={categoryValue}
          onChange={setCategoryId}
        />
      ) : null}

      <Input
        testID="edit-transaction-reference"
        label="Reference"
        value={referenceValue}
        onChangeText={setReference}
      />

      {submitError !== null ? <Text tone="danger">{submitError}</Text> : null}

      <Button
        testID="edit-transaction-submit"
        label="Save changes"
        onPress={() => void handleSubmit(data)}
        loading={isSaving}
        fullWidth
      />
    </ScrollView>
  );
}
