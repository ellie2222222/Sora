import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, ErrorState, Money, Text } from '../../../components/index.ts';
import { SkeletonList } from '../../../components/Skeleton.tsx';
import { useTheme } from '../../../app/providers/ThemeProvider.tsx';
import { useWallets } from '../../../app/providers/WalletProvider.tsx';
import { useCancelTransactionMutation, useGetTransactionQuery } from '../../../app/store/api/transactionsApi.ts';
import { formatDay, formatTimeOfDay } from '../../../utils/date.ts';
import { messageOf } from '../../../utils/errors.ts';
import type { AppStackScreenProps } from '../../../app/navigation/types.ts';

const TYPE_LABEL = { INCOME: 'Income', EXPENSE: 'Expense', TRANSFER: 'Transfer' } as const;

export function TransactionDetailScreen({ route, navigation }: AppStackScreenProps<'TransactionDetail'>) {
  const theme = useTheme();
  const { transactionId } = route.params;

  const { permissions } = useWallets();

  const transaction = useGetTransactionQuery(transactionId);
  const [cancelTransaction, { isLoading: isCancelling }] = useCancelTransactionMutation();
  const [error, setError] = useState<string | null>(null);

  if (transaction.isLoading) return <SkeletonList rows={3} />;
  if (transaction.isError) return <ErrorState error={transaction.error} onRetry={() => void transaction.refetch()} />;

  const data = transaction.data;
  if (data === undefined) return null;

  // A cancelled transaction accepts neither an edit nor a second cancel (§11.4).
  const isEditable = data.status === 'COMPLETED' && permissions.canWrite;

  async function handleCancel() {
    setError(null);
    try {
      await cancelTransaction({ transactionId }).unwrap();
      navigation.goBack();
    } catch (submitError) {
      setError(messageOf(submitError));
    }
  }

  return (
    <View style={{ padding: theme.spacing.md, gap: theme.spacing.md }}>
      <Card>
        <Text variant="label" tone="muted">
          {TYPE_LABEL[data.type]}
          {data.isCrossWallet ? ' · Cross-wallet' : ''}
        </Text>
        <Money amount={data.amount} currency={data.currency} type={data.type} variant="heading" formatOptions={{ signDisplay: 'always' }} />

        {data.description !== null ? <Text style={{ marginTop: theme.spacing.sm }}>{data.description}</Text> : null}

        <Text tone="muted" style={{ marginTop: theme.spacing.sm }}>
          {formatDay(data.transactionDate.slice(0, 10))} at {formatTimeOfDay(data.transactionDate)}
        </Text>

        {data.category !== null ? <Text tone="muted">Category: {data.category.name}</Text> : null}
        {data.fromAccount !== null ? (
          <Text tone="muted">
            From: {data.fromAccount.name} ({data.fromAccount.walletName})
          </Text>
        ) : null}
        {data.toAccount !== null ? (
          <Text tone="muted">
            To: {data.toAccount.name} ({data.toAccount.walletName})
          </Text>
        ) : null}
        <Text tone="muted">Recorded by {data.createdBy.displayName}</Text>

        {data.status === 'CANCELLED' ? (
          <Text tone="danger" weight="semibold" style={{ marginTop: theme.spacing.sm }}>
            Cancelled
          </Text>
        ) : null}
      </Card>

      {error !== null ? <Text tone="danger">{error}</Text> : null}

      {isEditable ? (
        <Button
          testID="transaction-detail-edit"
          label="Edit details"
          variant="secondary"
          onPress={() => navigation.navigate('EditTransaction', { transactionId })}
          fullWidth
        />
      ) : null}

      {isEditable ? (
        <Button
          testID="transaction-detail-cancel"
          label="Cancel transaction"
          variant="danger"
          onPress={handleCancel}
          loading={isCancelling}
          fullWidth
        />
      ) : null}
    </View>
  );
}
