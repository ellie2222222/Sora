import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Calendar, Clock, CreditCard, Pencil, Tag, Trash2, User, UsersRound, X } from 'lucide-react-native';
import { TransactionStatus, TransactionType, type TransactionResponse } from '@sora/contracts';

import { BottomSheetModal, Button, CategoryAvatar, ConfirmDialog, Money, Text } from '@/components';
import { useTheme, useWallets } from '@/app/providers';
import { useDeleteTransactionMutation } from '@/app/store';
import { formatDay, formatTimeOfDay, messageOf } from '@/utils';

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
  const [deleteTransaction, { isLoading: isDeleting }] = useDeleteTransactionMutation();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (!transaction) return null;

  const category = transaction.category;
  const fromAcc = transaction.fromAccount;
  const toAcc = transaction.toAccount;
  const isDeleted = transaction.status === TransactionStatus.DELETED;
  const isEditable = !isDeleted && permissions.canWrite;

  const title = transaction.description || category?.name || transaction.type;
  const tint = category?.color ?? theme.colors.primary;

  async function handleDelete() {
    if (!transaction) return;
    setDeleteError(null);
    try {
      await deleteTransaction({ transactionId: transaction.id }).unwrap();
      setConfirmingDelete(false);
      onClose();
    } catch (err) {
      setDeleteError(messageOf(err, t));
    }
  }

  return (
    <>
    <BottomSheetModal visible={visible} onClose={onClose} title={t('transactions.detailTitle', { defaultValue: 'Transaction details' })}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: theme.spacing.xl }}
      >
        <View className="items-center" style={{ marginTop: theme.spacing.xl, marginBottom: theme.spacing.xxl }}>
          <View style={{ marginBottom: theme.spacing.lg }}>
            <CategoryAvatar
              categoryIcon={category?.icon}
              categoryName={category?.name}
              transactionType={transaction.type}
              tint={tint}
              size={40}
            />
          </View>

          <Text variant="heading" style={{ fontSize: 20, textAlign: 'center', marginBottom: theme.spacing.xs }}>
            {title}
          </Text>

          <Money
            amount={transaction.amount}
            currency={transaction.currency}
            type={transaction.type}
            variant="heading"
          />

          {isDeleted ? (
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
                {t('transactions.cancelled', { defaultValue: 'Deleted' })}
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
              label={t('transactions.fromLabel', { defaultValue: 'From' })}
              value={`${fromAcc.name} (${fromAcc.walletName})`}
            />
          ) : null}

          {toAcc !== null ? (
            <DetailRow
              icon={<CreditCard size={18} color={theme.colors.textMuted} />}
              label={
                transaction.type === TransactionType.INCOME
                  ? t('transactions.accountLabel', { defaultValue: 'Account' })
                  : t('transactions.toLabel', { defaultValue: 'To' })
              }
              value={`${toAcc.name} (${toAcc.walletName})`}
            />
          ) : null}

          <DetailRow
            icon={<Calendar size={18} color={theme.colors.textMuted} />}
            label={t('transactions.transactionDateLabel', { defaultValue: 'Transaction date' })}
            value={formatDay(transaction.transactionDate.slice(0, 10))}
          />

          <DetailRow
            icon={<Clock size={18} color={theme.colors.textMuted} />}
            label={t('transactions.createdDateLabel', { defaultValue: 'Created date' })}
            value={`${formatDay(transaction.createdAt.slice(0, 10))} ${formatTimeOfDay(transaction.createdAt)}`}
          />

          <DetailRow
            icon={<User size={18} color={theme.colors.textMuted} />}
            label={t('transactions.recordedByLabel', { defaultValue: 'Recorded by' })}
            value={transaction.createdBy.displayName}
          />

          {transaction.isCrossWallet ? (
            <DetailRow
              icon={<UsersRound size={18} color={theme.colors.primary} />}
              label={t('transactions.crossWalletLabel', { defaultValue: 'Cross-wallet' })}
              value={t('transactions.crossWalletNotice', {
                defaultValue: 'This moves money into another wallet. It will appear in their ledger too.',
              })}
            />
          ) : null}
        </View>

        {deleteError !== null ? <Text tone="danger">{deleteError}</Text> : null}

        {isEditable ? (
          <View style={{ gap: theme.spacing.sm, marginTop: 28 }}>
            {onEdit ? (
              <Button
                label={t('transactions.editTransaction', { defaultValue: 'Edit transaction' })}
                icon={Pencil}
                variant="secondary"
                onPress={() => {
                  onClose();
                  onEdit(transaction);
                }}
                fullWidth
              />
            ) : null}
            <Button
              label={t('transactions.cancelTransaction', { defaultValue: 'Delete transaction' })}
              icon={Trash2}
              variant="danger-outline"
              onPress={() => setConfirmingDelete(true)}
              fullWidth
            />
          </View>
        ) : null}
      </ScrollView>
    </BottomSheetModal>
    <ConfirmDialog
      visible={confirmingDelete}
      title={t('transactions.cancelConfirmTitle', { defaultValue: 'Delete this transaction?' })}
      message={t('transactions.cancelConfirmBody', {
        defaultValue: "This removes it from your list and reverses its effect on your balances and budgets. This can't be undone.",
      })}
      confirmLabel={t('transactions.cancelTransaction', { defaultValue: 'Delete transaction' })}
      destructive
      loading={isDeleting}
      onConfirm={handleDelete}
      onCancel={() => setConfirmingDelete(false)}
    />
    </>
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
    <View className="flex-row items-center" style={{ minHeight: 44 }}>
      <View style={{ width: 32, alignItems: 'center' }}>
        {icon}
      </View>
      <View className="flex-1" style={{ marginLeft: theme.spacing.md }}>
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
