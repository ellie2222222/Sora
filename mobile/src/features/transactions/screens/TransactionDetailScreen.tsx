import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { TransactionStatus } from '@sora/contracts';
import { useModal } from '../../../app/providers/ModalProvider';
import { Button, Card, Money, StateView, Text } from '../../../components/index';
import { SkeletonList } from '../../../components/Skeleton';
import { useTheme } from '../../../app/providers/ThemeProvider';
import { useWallets } from '../../../app/providers/WalletProvider';
import { useCancelTransactionMutation, useGetTransactionQuery } from '../../../app/store/api/transactionsApi';
import { formatDay, formatTimeOfDay } from '../../../utils/date';
import { messageOf } from '../../../utils/errors';
import type { AppStackScreenProps } from '../../../app/navigation/types';

export function TransactionDetailScreen({ route, navigation }: AppStackScreenProps<'TransactionDetail'>) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { openModal } = useModal();
  const { transactionId } = route.params;

  const { permissions } = useWallets();

  const transaction = useGetTransactionQuery(transactionId);
  const [cancelTransaction, { isLoading: isCancelling }] = useCancelTransactionMutation();
  const [error, setError] = useState<string | null>(null);

  const typeLabels = {
    INCOME: t('transactions.filterIncome', 'Income'),
    EXPENSE: t('transactions.filterExpense', 'Expense'),
    TRANSFER: t('transactions.filterTransfer', 'Transfer'),
  };

  async function handleCancel() {
    setError(null);
    try {
      await cancelTransaction({ transactionId }).unwrap();
      navigation.goBack();
    } catch (submitError) {
      setError(messageOf(submitError));
    }
  }

  const renderContent = () => {
    if (transaction.isLoading) return <SkeletonList rows={3} />;
    if (transaction.isError) {
      return <StateView variant="error" error={transaction.error} retryAction={() => void transaction.refetch()} />;
    }

    const data = transaction.data;
    if (data === undefined) {
      return <StateView variant="error" error={new Error(t('transactions.transactionNotFound', 'Transaction not found'))} />;
    }

    const isEditable = data.status === TransactionStatus.COMPLETED && permissions.canWrite;

    return (
      <>
        <Card>
          <Text variant="label" tone="muted">
            {typeLabels[data.type]}
            {data.isCrossWallet ? ` · ${t('home.crossWallet', 'cross-wallet')}` : ''}
          </Text>
          <Money amount={data.amount} currency={data.currency} type={data.type} variant="heading" formatOptions={{ signDisplay: 'always' }} />

          {data.description !== null ? <Text style={{ marginTop: theme.spacing.sm }}>{data.description}</Text> : null}

          <Text tone="muted" style={{ marginTop: theme.spacing.sm }}>
            {formatDay(data.transactionDate.slice(0, 10))} {formatTimeOfDay(data.transactionDate)}
          </Text>

          {data.category !== null ? <Text tone="muted">{t('categories.categoryLabel', 'Category')}: {data.category.name}</Text> : null}
          {data.fromAccount !== null ? (
            <Text tone="muted">
              {t('transactions.fromLabel', 'From')}: {data.fromAccount.name} ({data.fromAccount.walletName})
            </Text>
          ) : null}
          {data.toAccount !== null ? (
            <Text tone="muted">
              {t('transactions.toLabel', 'To')}: {data.toAccount.name} ({data.toAccount.walletName})
            </Text>
          ) : null}
          <Text tone="muted">{t('transactions.recordedBy', 'Recorded by {{name}}', { name: data.createdBy.displayName })}</Text>

          {data.status === TransactionStatus.CANCELLED ? (
            <Text tone="danger" weight="semibold" style={{ marginTop: theme.spacing.sm }}>
              {t('transactions.cancelled', 'Cancelled')}
            </Text>
          ) : null}
        </Card>

        {error !== null ? <Text tone="danger">{error}</Text> : null}

        {isEditable ? (
          <Button
            testID="transaction-detail-edit"
            label={t('transactions.editTransaction', 'Edit details')}
            variant="secondary"
            onPress={() => openModal('EditTransaction', { transactionId })}
            fullWidth
          />
        ) : null}

        {isEditable ? (
          <Button
            testID="transaction-detail-cancel"
            label={t('transactions.cancelTransaction', 'Cancel transaction')}
            variant="danger"
            onPress={handleCancel}
            loading={isCancelling}
            fullWidth
          />
        ) : null}
      </>
    );
  };

  return (
    <View style={{ padding: theme.spacing.md, gap: theme.spacing.md }}>
      {renderContent()}
    </View>
  );
}
