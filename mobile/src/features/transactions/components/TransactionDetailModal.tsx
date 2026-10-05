import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Calendar, Clock, CreditCard, Pencil, Tag, Trash2, User, UsersRound } from 'lucide-react-native';
import { TransactionStatus, TransactionType, type TransactionResponse } from '@sora/contracts';

import { BottomSheetModal, Button, CategoryAvatar, Money, Text } from '@/components';
import { useTheme, useWallets } from '@/app/providers';
import { formatDay, formatTimeOfDay } from '@/utils';
import { DeleteTransactionDialog } from './DeleteTransactionDialog.tsx';

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
              size={theme.sizes.badge.lg}
            />
          </View>

          <Text variant="heading" style={{ fontSize: theme.fontSize.xl, textAlign: 'center', marginBottom: theme.spacing.xs }}>
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
                paddingVertical: theme.spacing.xs,
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
              icon={<Tag size={theme.iconSize.lg} color={theme.colors.textMuted} />}
              label={t('categories.categoryLabel', { defaultValue: 'Category' })}
              value={category.name}
            />
          ) : null}

          {fromAcc !== null ? (
            <DetailRow
              icon={<CreditCard size={theme.iconSize.lg} color={theme.colors.textMuted} />}
              label={t('transactions.fromLabel', { defaultValue: 'From' })}
              value={`${fromAcc.name} (${fromAcc.walletName})`}
            />
          ) : null}

          {toAcc !== null ? (
            <DetailRow
              icon={<CreditCard size={theme.iconSize.lg} color={theme.colors.textMuted} />}
              label={
                transaction.type === TransactionType.INCOME
                  ? t('transactions.accountLabel', { defaultValue: 'Account' })
                  : t('transactions.toLabel', { defaultValue: 'To' })
              }
              value={`${toAcc.name} (${toAcc.walletName})`}
            />
          ) : null}

          <DetailRow
            icon={<Calendar size={theme.iconSize.lg} color={theme.colors.textMuted} />}
            label={t('transactions.transactionDateLabel', { defaultValue: 'Transaction date' })}
            value={formatDay(transaction.transactionDate.slice(0, 10))}
          />

          <DetailRow
            icon={<Clock size={theme.iconSize.lg} color={theme.colors.textMuted} />}
            label={t('transactions.createdDateLabel', { defaultValue: 'Created date' })}
            value={`${formatDay(transaction.createdAt.slice(0, 10))} ${formatTimeOfDay(transaction.createdAt)}`}
          />

          <DetailRow
            icon={<User size={theme.iconSize.lg} color={theme.colors.textMuted} />}
            label={t('transactions.recordedByLabel', { defaultValue: 'Recorded by' })}
            value={transaction.createdBy.displayName}
          />

          {transaction.isCrossWallet ? (
            <DetailRow
              icon={<UsersRound size={theme.iconSize.lg} color={theme.colors.primary} />}
              label={t('transactions.crossWalletLabel', { defaultValue: 'Cross-wallet' })}
              value={t('transactions.crossWalletNotice', {
                defaultValue: 'This moves money into another wallet. It will appear in their ledger too.',
              })}
            />
          ) : null}
        </View>

        {deleteError !== null ? <Text tone="danger">{deleteError}</Text> : null}

        {isEditable ? (
          <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.xl }}>
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
              onPress={() => {
                setDeleteError(null);
                setConfirmingDelete(true);
              }}
              fullWidth
            />
          </View>
        ) : null}
      </ScrollView>
    </BottomSheetModal>
    <DeleteTransactionDialog
      transaction={confirmingDelete ? transaction : null}
      onCancel={() => setConfirmingDelete(false)}
      onDeleted={() => {
        setConfirmingDelete(false);
        onClose();
      }}
      onError={(message) => {
        setConfirmingDelete(false);
        setDeleteError(message);
      }}
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
    <View className="flex-row items-center" style={{ minHeight: theme.sizes.touchTarget }}>
      <View style={{ width: theme.sizes.badge.sm, alignItems: 'center' }}>
        {icon}
      </View>
      <View className="flex-1" style={{ marginLeft: theme.spacing.md }}>
        <Text variant="caption" tone="muted">
          {label}
        </Text>
        <Text weight="medium" style={{ fontSize: theme.fontSize.sm, marginTop: theme.spacing.xxs }}>
          {value}
        </Text>
      </View>
    </View>
  );
}
