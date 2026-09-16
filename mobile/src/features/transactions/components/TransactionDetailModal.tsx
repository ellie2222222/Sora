import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Calendar, Clock, CreditCard, Tag, User, UsersRound, X } from 'lucide-react-native';
import { TransactionStatus, type TransactionResponse } from '@sora/contracts';

import { BottomSheetModal, Button, CategoryAvatar, Money, Text } from '@/components';
import { useTheme, useWallets } from '@/app/providers';
import { useCancelTransactionMutation } from '@/app/store';
import { formatDay, formatTimeOfDay } from '../../../utils/date';
import { messageOf } from '../../../utils/errors';

export interface TransactionDetailModalProps {
  visible: boolean;
  transaction: TransactionResponse | null;
  onClose: () => void;
  onEdit?: (transaction: TransactionResponse) => void;
}

export function TransactionDetailModal({
  visible,
  transaction,
  onClose,
  onEdit,
}: TransactionDetailModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { permissions } = useWallets();
  const [cancelTransaction, { isLoading: isCancelling }] = useCancelTransactionMutation();
  const [cancelError, setCancelError] = useState<string | null>(null);

  if (!transaction) return null;

  const category = transaction.category;
  const fromAcc = transaction.fromAccount;
  const toAcc = transaction.toAccount;
  const isCancelled = transaction.status === TransactionStatus.CANCELLED;
  const isEditable = !isCancelled && permissions.canWrite;

  const title = transaction.description || category?.name || transaction.type;
  const tint = category?.color ?? theme.colors.primary;

  async function handleCancel() {
    if (!transaction) return;
    setCancelError(null);
    try {
      await cancelTransaction({ transactionId: transaction.id }).unwrap();
      onClose();
    } catch (err) {
      setCancelError(messageOf(err, t));
    }
  }

  return (
    <BottomSheetModal visible={visible} onClose={onClose} title={t('transactions.detailTitle', { defaultValue: 'Transaction Details' })}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.xl }}
      >
        <View className="items-center" style={{ gap: theme.spacing.xs, paddingTop: theme.spacing.xs }}>
          <View style={{ marginBottom: theme.spacing.xs }}>
            <CategoryAvatar
              categoryIcon={category?.icon}
              categoryName={category?.name}
              transactionType={transaction.type}
              tint={tint}
              size={48}
            />
          </View>

          <Text variant="heading" style={{ fontSize: 20, textAlign: 'center' }}>
            {title}
          </Text>

          <Money
            amount={transaction.amount}
            currency={transaction.currency}
            type={transaction.type}
            variant="heading"
          />

          {isCancelled ? (
            <View
              style={{
                backgroundColor: theme.colors.dangerMuted,
                paddingHorizontal: theme.spacing.md,
                paddingVertical: 4,
                borderRadius: theme.radius.pill,
                marginTop: theme.spacing.xs,
              }}
            >
              <Text tone="danger" weight="semibold" variant="caption">
                {t('transactions.cancelled', { defaultValue: 'Cancelled' })}
              </Text>
            </View>
          ) : null}
        </View>

        <View
          style={{
            backgroundColor: theme.colors.surfaceMuted,
            borderRadius: theme.radius.md,
            padding: theme.spacing.md,
            gap: theme.spacing.md,
          }}
        >
          {category !== null ? (
            <DetailRow
              icon={<Tag size={18} color={theme.colors.textMuted} />}
              label={t('categories.categoryLabel', { defaultValue: 'Category' })}
              value={category.name}
            />
          ) : null}

          {fromAcc !== null ? (
            <DetailRow
              icon={<CreditCard size={18} color={theme.colors.textMuted} />}
              label={t('transactions.fromLabel', { defaultValue: 'From Account' })}
              value={`${fromAcc.name} (${fromAcc.walletName})`}
            />
          ) : null}

          {toAcc !== null ? (
            <DetailRow
              icon={<CreditCard size={18} color={theme.colors.textMuted} />}
              label={t('transactions.toLabel', { defaultValue: 'To Account' })}
              value={`${toAcc.name} (${toAcc.walletName})`}
            />
          ) : null}

          <DetailRow
            icon={<Calendar size={18} color={theme.colors.textMuted} />}
            label={t('transactions.transactionDateLabel', { defaultValue: 'Transaction Date' })}
            value={`${formatDay(transaction.transactionDate.slice(0, 10))} ${formatTimeOfDay(transaction.transactionDate)}`}
          />

          <DetailRow
            icon={<Clock size={18} color={theme.colors.textMuted} />}
            label={t('transactions.createdDateLabel', { defaultValue: 'Created Date' })}
            value={`${formatDay(transaction.createdAt.slice(0, 10))} ${formatTimeOfDay(transaction.createdAt)}`}
          />

          <DetailRow
            icon={<User size={18} color={theme.colors.textMuted} />}
            label={t('transactions.recordedByLabel', { defaultValue: 'Recorded By' })}
            value={transaction.createdBy.displayName}
          />

          {transaction.isCrossWallet ? (
            <DetailRow
              icon={<UsersRound size={18} color={theme.colors.primary} />}
              label={t('home.crossWallet', { defaultValue: 'Cross Wallet' })}
              value={t('transactions.crossWalletNotice', { defaultValue: 'Cross-wallet transaction' })}
            />
          ) : null}
        </View>

        {cancelError !== null ? <Text tone="danger">{cancelError}</Text> : null}

        {isEditable ? (
          <View style={{ gap: theme.spacing.sm }}>
            {onEdit ? (
              <Button
                label={t('transactions.editTransaction', { defaultValue: 'Edit details' })}
                variant="secondary"
                onPress={() => {
                  onClose();
                  onEdit(transaction);
                }}
                fullWidth
              />
            ) : null}
            <Button
              label={t('transactions.cancelTransaction', { defaultValue: 'Cancel transaction' })}
              variant="danger-outline"
              onPress={handleCancel}
              loading={isCancelling}
              fullWidth
            />
          </View>
        ) : null}
      </ScrollView>
    </BottomSheetModal>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  const theme = useTheme();

  return (
    <View className="flex-row items-center" style={{ gap: theme.spacing.sm }}>
      {icon}
      <View className="flex-1">
        <Text variant="caption" tone="muted">
          {label}
        </Text>
        <Text weight="medium" style={{ fontSize: 14, marginTop: 1 }}>
          {value}
        </Text>
      </View>
    </View>
  );
}
